/**
 * Monitor Pointer Lock
 *
 * Keep the pointer on its current monitor. Holding Ctrl while crossing a
 * shared display edge releases the barrier for that crossing.
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

        // A vertical shared edge: the monitors are side by side.
        if (vertical && first.x + first.width === second.x) {
            this._addBarrierPair(second.x, vertical[0], second.x, vertical[1],
                Meta.BarrierDirection.POSITIVE_X,
                Meta.BarrierDirection.NEGATIVE_X);
        } else if (vertical && second.x + second.width === first.x) {
            this._addBarrierPair(first.x, vertical[0], first.x, vertical[1],
                Meta.BarrierDirection.POSITIVE_X,
                Meta.BarrierDirection.NEGATIVE_X);
        // A horizontal shared edge: one monitor is above the other.
        } else if (horizontal && first.y + first.height === second.y) {
            this._addBarrierPair(horizontal[0], second.y, horizontal[1], second.y,
                Meta.BarrierDirection.POSITIVE_Y,
                Meta.BarrierDirection.NEGATIVE_Y);
        } else if (horizontal && second.y + second.height === first.y) {
            this._addBarrierPair(horizontal[0], first.y, horizontal[1], first.y,
                Meta.BarrierDirection.POSITIVE_Y,
                Meta.BarrierDirection.NEGATIVE_Y);
        }
    }

    _addBarrierPair(x1, y1, x2, y2, forward, backward) {
        for (const directions of [forward, backward]) {
            const barrier = new Meta.Barrier({
                backend: global.backend,
                x1,
                y1,
                x2,
                y2,
                directions,
            });
            barrier.connect('hit', (_barrier, event) => this._onBarrierHit(barrier, event));
            this._barriers.push(barrier);
        }
    }

    _onBarrierHit(barrier, event) {
        // `global.get_pointer()` includes the current modifier state. Releasing
        // the event lets the pointer pass through this barrier once; without
        // Ctrl, Mutter keeps it at the edge as intended.
        const [, , modifiers] = global.get_pointer();
        if (modifiers & Clutter.ModifierType.CONTROL_MASK)
            barrier.release(event);
    }

    _clearBarriers() {
        for (const barrier of this._barriers ?? [])
            barrier.destroy();
        this._barriers = [];
    }
}

function overlap(startA, endA, startB, endB) {
    const start = Math.max(startA, startB);
    const end = Math.min(endA, endB);
    return end > start ? [start, end] : null;
}
