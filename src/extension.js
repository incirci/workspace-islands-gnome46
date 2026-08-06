/**
 * Monitor Pointer Lock
 *
 * Keep the pointer on its current monitor. Holding Ctrl temporarily removes
 * the display-edge barriers, so the pointer can cross freely.
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
        this._ctrlDown = this._isCtrlDown();
        this._signals = [
            [Main.layoutManager, Main.layoutManager.connect(
                'monitors-changed', () => this._rebuild())],
            [this._settings, this._settings.connect(
                'changed::enabled', () => this._rebuild())],
        ];

        // Pointer barriers can only release the motion event that hit them.
        // Polling the modifier state lets Ctrl remove the barriers completely,
        // avoiding the edge grab that otherwise leaves the cursor one pixel
        // into the neighbouring monitor.
        this._modifierPollId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            25,
            () => this._syncModifierState());
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
        if (!this._settings.get_boolean('enabled') || this._ctrlDown)
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
            this._addBarrier(second.x, vertical[0], second.x, vertical[1],
                Meta.BarrierDirection.POSITIVE_X | Meta.BarrierDirection.NEGATIVE_X);
        } else if (vertical && second.x + second.width === first.x) {
            this._addBarrier(first.x, vertical[0], first.x, vertical[1],
                Meta.BarrierDirection.POSITIVE_X | Meta.BarrierDirection.NEGATIVE_X);
        // A horizontal shared edge: one monitor is above the other.
        } else if (horizontal && first.y + first.height === second.y) {
            this._addBarrier(horizontal[0], second.y, horizontal[1], second.y,
                Meta.BarrierDirection.POSITIVE_Y | Meta.BarrierDirection.NEGATIVE_Y);
        } else if (horizontal && second.y + second.height === first.y) {
            this._addBarrier(horizontal[0], first.y, horizontal[1], first.y,
                Meta.BarrierDirection.POSITIVE_Y | Meta.BarrierDirection.NEGATIVE_Y);
        }
    }

    _addBarrier(x1, y1, x2, y2, directions) {
        this._barriers.push(new Meta.Barrier({
            backend: global.backend,
            x1,
            y1,
            x2,
            y2,
            directions,
        }));
    }

    _isCtrlDown() {
        const [, , modifiers] = global.get_pointer();
        return Boolean(modifiers & Clutter.ModifierType.CONTROL_MASK);
    }

    _syncModifierState() {
        const ctrlDown = this._isCtrlDown();
        if (ctrlDown !== this._ctrlDown) {
            this._ctrlDown = ctrlDown;
            this._rebuild();
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
