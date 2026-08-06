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
        this._signals = [
            [Main.layoutManager, Main.layoutManager.connect(
                'monitors-changed', () => this._rebuild())],
            [this._settings, this._settings.connect(
                'changed::enabled', () => this._rebuild())],
            [this._settings, this._settings.connect(
                'changed::edge-inset', () => this._rebuild())],
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
            this._addDirectionalBarriers(
                second.x, vertical[0], vertical[1],
                Meta.BarrierDirection.NEGATIVE_X,
                Meta.BarrierDirection.POSITIVE_X,
                'x');
        } else if (vertical && second.x + second.width === first.x) {
            this._addDirectionalBarriers(
                first.x, vertical[0], vertical[1],
                Meta.BarrierDirection.NEGATIVE_X,
                Meta.BarrierDirection.POSITIVE_X,
                'x');
        // A horizontal shared edge: one monitor is above the other.
        } else if (horizontal && first.y + first.height === second.y) {
            this._addDirectionalBarriers(
                second.y, horizontal[0], horizontal[1],
                Meta.BarrierDirection.NEGATIVE_Y,
                Meta.BarrierDirection.POSITIVE_Y,
                'y');
        } else if (horizontal && second.y + second.height === first.y) {
            this._addDirectionalBarriers(
                first.y, horizontal[0], horizontal[1],
                Meta.BarrierDirection.NEGATIVE_Y,
                Meta.BarrierDirection.POSITIVE_Y,
                'y');
        }
    }

    _addDirectionalBarriers(boundary, start, end,
        towardNegative, towardPositive, axis) {
        const edgeInset = this._settings.get_int('edge-inset');
        const parallelDirections = axis === 'x'
            ? Meta.BarrierDirection.POSITIVE_Y |
                Meta.BarrierDirection.NEGATIVE_Y
            : Meta.BarrierDirection.POSITIVE_X |
                Meta.BarrierDirection.NEGATIVE_X;
        if (axis === 'x') {
            // Allow motion back into the source monitor and all motion along
            // the edge. Only the outward component is blocked.
            this._addBarrier(
                boundary - edgeInset, start,
                boundary - edgeInset, end,
                towardNegative | parallelDirections);
            this._addBarrier(
                boundary + edgeInset, start,
                boundary + edgeInset, end,
                towardPositive | parallelDirections);
        } else {
            this._addBarrier(
                start, boundary - edgeInset,
                end, boundary - edgeInset,
                towardNegative | parallelDirections);
            this._addBarrier(
                start, boundary + edgeInset,
                end, boundary + edgeInset,
                towardPositive | parallelDirections);
        }
    }

    _addBarrier(x1, y1, x2, y2, directions) {
        const barrier = new Meta.Barrier({
            backend: global.backend,
            x1,
            y1,
            x2,
            y2,
            directions,
            flags: Meta.BarrierFlags.NONE,
        });
        const hitId = barrier.connect('hit', (_barrier, event) =>
            this._onBarrierHit(barrier, event));
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
            barrier.disconnect(hitId);
            barrier.destroy();
        }
        this._barriers = [];
    }
}

function overlap(startA, endA, startB, endB) {
    const start = Math.max(startA, startB);
    const end = Math.min(endA, endB);
    return end > start ? [start, end] : null;
}
