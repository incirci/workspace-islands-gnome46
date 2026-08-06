/**
 * Monitor Pointer Lock
 *
 * Keep the pointer on its current monitor. Holding Ctrl while crossing a
 * shared display edge releases that crossing.
 */

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class MonitorPointerLockExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._barriers = [];
        this._barrierKeys = new Set();
        this._signals = [
            [Main.layoutManager, Main.layoutManager.connect(
                'monitors-changed', () => this._rebuild())],
            [this._settings, this._settings.connect(
                'changed::enabled', () => this._rebuild())],
            [this._settings, this._settings.connect(
                'changed::edge-inset', () => this._rebuild())],
            [this._settings, this._settings.connect(
                'changed::keep-pointer-visible', () => this._rebuild())],
        ];

        this._rebuild();
        console.log(`monitor-pointer-lock: enabled (${this._barriers.length} barrier(s))`);
    }

    disable() {
        this._clearBarriers();

        for (const [object, signalId] of this._signals ?? [])
            object.disconnect(signalId);
        this._signals = null;
        this._settings = null;
    }

    _rebuild() {
        this._clearBarriers();
        if (!this._settings.get_boolean('enabled'))
            return;

        const monitors = Main.layoutManager.monitors;
        for (let first = 0; first < monitors.length; first++) {
            for (let second = first + 1; second < monitors.length; second++)
                this._addSharedEdge(monitors[first], monitors[second]);
        }

        if (this._settings.get_boolean('keep-pointer-visible'))
            this._addOuterEdgeBarriers(monitors);
    }

    _addSharedEdge(first, second) {
        const vertical = overlap(
            first.y, first.y + first.height,
            second.y, second.y + second.height);
        const horizontal = overlap(
            first.x, first.x + first.width,
            second.x, second.x + second.width);

        // Put each one-way barrier inside its source monitor. This keeps the
        // visible cursor away from the ambiguous shared boundary without
        // moving the pointer after it arrives there.
        if (vertical && first.x + first.width === second.x) {
            this._addVerticalBarriers(second.x, first, second);
        } else if (vertical && second.x + second.width === first.x) {
            this._addVerticalBarriers(first.x, second, first);
        // A horizontal shared edge: one monitor is above the other.
        } else if (horizontal && first.y + first.height === second.y) {
            this._addHorizontalBarriers(second.y, first, second);
        } else if (horizontal && second.y + second.height === first.y) {
            this._addHorizontalBarriers(first.y, second, first);
        }
    }

    _addVerticalBarriers(boundary, left, right) {
        const edgeInset = this._settings.get_int('edge-inset');
        const leftX = boundary - edgeInset;
        const rightX = boundary + edgeInset;

        this._addVerticalSideBarrier(
            leftX, left, Meta.BarrierDirection.NEGATIVE_X,
            leftX - edgeInset, leftX);
        this._addVerticalSideBarrier(
            rightX, right, Meta.BarrierDirection.POSITIVE_X,
            rightX, rightX + edgeInset);
    }

    _addHorizontalBarriers(boundary, top, bottom) {
        const edgeInset = this._settings.get_int('edge-inset');
        const topY = boundary - edgeInset;
        const bottomY = boundary + edgeInset;

        this._addHorizontalSideBarrier(
            topY, top, Meta.BarrierDirection.NEGATIVE_Y,
            topY - edgeInset, topY);
        this._addHorizontalSideBarrier(
            bottomY, bottom, Meta.BarrierDirection.POSITIVE_Y,
            bottomY, bottomY + edgeInset);
    }

    _addVerticalSideBarrier(x, monitor, inward, capStart, capEnd) {
        const vertical = Meta.BarrierDirection.POSITIVE_Y |
            Meta.BarrierDirection.NEGATIVE_Y;
        const horizontal = Meta.BarrierDirection.POSITIVE_X |
            Meta.BarrierDirection.NEGATIVE_X;
        const bottom = monitor.y + monitor.height;

        // The main barrier covers the complete source-monitor side. The two
        // perpendicular caps prevent diagonal motion around either endpoint.
        this._addBarrier(
            x, monitor.y, x, bottom,
            inward | vertical);
        this._addBarrier(
            capStart, monitor.y, capEnd, monitor.y,
            Meta.BarrierDirection.POSITIVE_Y | horizontal,
            false);
        this._addBarrier(
            capStart, bottom, capEnd, bottom,
            Meta.BarrierDirection.NEGATIVE_Y | horizontal,
            false);
    }

    _addHorizontalSideBarrier(y, monitor, inward, capStart, capEnd) {
        const horizontal = Meta.BarrierDirection.POSITIVE_X |
            Meta.BarrierDirection.NEGATIVE_X;
        const vertical = Meta.BarrierDirection.POSITIVE_Y |
            Meta.BarrierDirection.NEGATIVE_Y;
        const right = monitor.x + monitor.width;

        this._addBarrier(
            monitor.x, y, right, y,
            inward | horizontal);
        this._addBarrier(
            monitor.x, capStart, monitor.x, capEnd,
            Meta.BarrierDirection.POSITIVE_X | vertical,
            false);
        this._addBarrier(
            right, capStart, right, capEnd,
            Meta.BarrierDirection.NEGATIVE_X | vertical,
            false);
    }

    _addOuterEdgeBarriers(monitors) {
        const edgeInset = this._settings.get_int('edge-inset');
        const verticalParallel = Meta.BarrierDirection.POSITIVE_Y |
            Meta.BarrierDirection.NEGATIVE_Y;
        const horizontalParallel = Meta.BarrierDirection.POSITIVE_X |
            Meta.BarrierDirection.NEGATIVE_X;

        for (const monitor of monitors) {
            const right = monitor.x + monitor.width;
            const bottom = monitor.y + monitor.height;
            const coveredRight = [];
            const coveredBottom = [];

            for (const other of monitors) {
                if (other === monitor)
                    continue;

                if (right === other.x) {
                    const span = overlap(
                        monitor.y, bottom,
                        other.y, other.y + other.height);
                    if (span)
                        coveredRight.push(span);
                }

                if (bottom === other.y) {
                    const span = overlap(
                        monitor.x, right,
                        other.x, other.x + other.width);
                    if (span)
                        coveredBottom.push(span);
                }
            }

            for (const [start, end] of uncoveredSegments(
                monitor.y, bottom, coveredRight)) {
                this._addBarrier(
                    right - edgeInset, start,
                    right - edgeInset, end,
                    Meta.BarrierDirection.NEGATIVE_X | verticalParallel,
                    false);
            }

            for (const [start, end] of uncoveredSegments(
                monitor.x, right, coveredBottom)) {
                this._addBarrier(
                    start, bottom - edgeInset,
                    end, bottom - edgeInset,
                    Meta.BarrierDirection.NEGATIVE_Y | horizontalParallel,
                    false);
            }
        }
    }

    _addBarrier(x1, y1, x2, y2, directions, ctrlUnlocks = true) {
        const key = `${x1}:${y1}:${x2}:${y2}:${directions}:${ctrlUnlocks}`;
        if (this._barrierKeys.has(key))
            return;
        this._barrierKeys.add(key);

        const barrier = new Meta.Barrier({
            backend: global.backend,
            x1,
            y1,
            x2,
            y2,
            directions,
            flags: Meta.BarrierFlags.NONE,
        });
        const hitId = ctrlUnlocks
            ? barrier.connect('hit', (_barrier, event) =>
                this._onBarrierHit(barrier, event))
            : 0;
        this._barriers.push([barrier, hitId]);
    }

    _isCtrlDown() {
        const [, , modifiers] = global.get_pointer();
        return Boolean(modifiers & Clutter.ModifierType.CONTROL_MASK);
    }

    _onBarrierHit(barrier, event) {
        // Keep every barrier installed. Ctrl releases only this crossing;
        // without Ctrl, Mutter holds the pointer and allows motion back into
        // the monitor it came from.
        if (this._isCtrlDown())
            barrier.release(event);
    }

    _clearBarriers() {
        for (const [barrier, hitId] of this._barriers ?? []) {
            if (hitId)
                barrier.disconnect(hitId);
            barrier.destroy();
        }
        this._barriers = [];
        this._barrierKeys?.clear();
    }
}

function overlap(startA, endA, startB, endB) {
    const start = Math.max(startA, startB);
    const end = Math.min(endA, endB);
    return end > start ? [start, end] : null;
}

function uncoveredSegments(start, end, covered) {
    const merged = covered
        .map(([coveredStart, coveredEnd]) => [
            Math.max(start, coveredStart),
            Math.min(end, coveredEnd),
        ])
        .filter(([coveredStart, coveredEnd]) => coveredEnd > coveredStart)
        .sort((first, second) => first[0] - second[0])
        .reduce((result, segment) => {
            const previous = result.at(-1);
            if (previous && segment[0] <= previous[1])
                previous[1] = Math.max(previous[1], segment[1]);
            else
                result.push(segment);
            return result;
        }, []);

    const uncovered = [];
    let position = start;
    for (const [coveredStart, coveredEnd] of merged) {
        if (coveredStart > position)
            uncovered.push([position, coveredStart]);
        position = Math.max(position, coveredEnd);
    }
    if (position < end)
        uncovered.push([position, end]);
    return uncovered;
}
