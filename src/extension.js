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

import {
    allowedDirections,
    BlockedDirection,
    buildBarrierSpecs,
} from './barrierGeometry.js';

const DIRECTION_MASKS = Object.freeze({
    [BlockedDirection.POSITIVE_X]: Meta.BarrierDirection.POSITIVE_X,
    [BlockedDirection.NEGATIVE_X]: Meta.BarrierDirection.NEGATIVE_X,
    [BlockedDirection.POSITIVE_Y]: Meta.BarrierDirection.POSITIVE_Y,
    [BlockedDirection.NEGATIVE_Y]: Meta.BarrierDirection.NEGATIVE_Y,
});

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

        const specs = buildBarrierSpecs(
            Main.layoutManager.monitors,
            this._settings.get_int('edge-inset'),
            this._settings.get_boolean('keep-pointer-visible'));
        for (const spec of specs)
            this._addBarrier(spec);
    }

    _addBarrier(spec) {
        const barrier = new Meta.Barrier({
            backend: global.backend,
            x1: spec.x1,
            y1: spec.y1,
            x2: spec.x2,
            y2: spec.y2,
            // Mutter expects allowed directions, so allow every direction
            // except the single outward direction this barrier blocks.
            directions: allowedDirections(
                spec.blockedDirection, DIRECTION_MASKS),
            flags: Meta.BarrierFlags.NONE,
        });
        const hitId = spec.ctrlUnlocks
            ? barrier.connect('hit', (_barrier, event) =>
                this._onBarrierHit(barrier, event))
            : 0;
        this._barriers.push([barrier, hitId]);
    }

    _onBarrierHit(barrier, event) {
        const [, , modifiers] = global.get_pointer();
        if (modifiers & Clutter.ModifierType.CONTROL_MASK)
            barrier.release(event);
    }

    _clearBarriers() {
        for (const [barrier, hitId] of this._barriers ?? []) {
            if (hitId)
                barrier.disconnect(hitId);
            barrier.destroy();
        }
        this._barriers = [];
    }
}
