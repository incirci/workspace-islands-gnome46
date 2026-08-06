/**
 * Monitor Pointer Lock
 *
 * Keep the pointer on its current monitor. Holding Ctrl at a display edge
 * removes the barriers before the next pointer motion, so it can cross freely.
 */

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class MonitorPointerLockExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._barriers = [];
        this._modifierPollId = 0;
        this._unlockedWithCtrl = false;
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
        if (this._modifierPollId) {
            GLib.Source.remove(this._modifierPollId);
            this._modifierPollId = 0;
        }
        this._clearBarriers();

        for (const [object, signalId] of this._signals ?? [])
            object.disconnect(signalId);
        this._signals = null;
        this._settings = null;
    }

    _rebuild() {
        this._clearBarriers();
        if (!this._settings.get_boolean('enabled') || this._unlockedWithCtrl)
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

        // A vertical shared edge: the monitors are side by side. The positive
        // and negative barriers must sit on adjacent pixels, not on the same
        // coordinate. A positive-X barrier at `boundary` holds the cursor one
        // pixel *inside* the right monitor; placing it at `boundary - 1`
        // holds it on the left monitor where it belongs.
        if (vertical && first.x + first.width === second.x) {
            this._addDirectionalBarriers(
                second.x, vertical[0], vertical[1],
                Meta.BarrierDirection.POSITIVE_X,
                Meta.BarrierDirection.NEGATIVE_X,
                'x');
        } else if (vertical && second.x + second.width === first.x) {
            this._addDirectionalBarriers(
                first.x, vertical[0], vertical[1],
                Meta.BarrierDirection.POSITIVE_X,
                Meta.BarrierDirection.NEGATIVE_X,
                'x');
        // A horizontal shared edge: one monitor is above the other.
        } else if (horizontal && first.y + first.height === second.y) {
            this._addDirectionalBarriers(
                second.y, horizontal[0], horizontal[1],
                Meta.BarrierDirection.POSITIVE_Y,
                Meta.BarrierDirection.NEGATIVE_Y,
                'y');
        } else if (horizontal && second.y + second.height === first.y) {
            this._addDirectionalBarriers(
                first.y, horizontal[0], horizontal[1],
                Meta.BarrierDirection.POSITIVE_Y,
                Meta.BarrierDirection.NEGATIVE_Y,
                'y');
        }
    }

    _addDirectionalBarriers(boundary, start, end, forward, backward, axis) {
        if (axis === 'x') {
            this._addBarrier(boundary - 1, start, boundary - 1, end, forward);
            this._addBarrier(boundary, start, boundary, end, backward);
        } else {
            this._addBarrier(start, boundary - 1, end, boundary - 1, forward);
            this._addBarrier(start, boundary, end, boundary, backward);
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
        });
        barrier.connect('hit', (_barrier, event) => this._onBarrierHit(barrier, event));
        this._barriers.push(barrier);
    }

    _isCtrlDown() {
        const [, , modifiers] = global.get_pointer();
        return Boolean(modifiers & Clutter.ModifierType.CONTROL_MASK);
    }

    _onBarrierHit(barrier, event) {
        if (!this._isCtrlDown())
            return;

        // Release this motion first, then remove both directional barriers.
        // Keeping the opposite barrier alive was what trapped the pointer
        // immediately after it entered the neighbouring monitor.
        barrier.release(event);
        this._unlockedWithCtrl = true;
        this._clearBarriers();

        if (!this._modifierPollId) {
            this._modifierPollId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                25,
                () => this._waitForCtrlRelease());
        }
    }

    _waitForCtrlRelease() {
        if (!this._isCtrlDown()) {
            this._modifierPollId = 0;
            this._unlockedWithCtrl = false;
            this._rebuild();
            return GLib.SOURCE_REMOVE;
        }
        return GLib.SOURCE_CONTINUE;
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
