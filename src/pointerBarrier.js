/**
 * A deliberate border between the primary display and each secondary display.
 *
 * This uses Mutter's public Meta.Barrier API, available in GNOME 46. A pair of
 * one-way barriers at a shared monitor edge blocks crossing in both directions.
 * It is deliberately limited to primary/secondary edges: islands between two
 * secondary monitors should not unexpectedly become inaccessible.
 */

import Meta from 'gi://Meta';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class PointerBarrier {
    constructor(settings) {
        this._settings = settings;
        this._barriers = [];
        this._signals = [
            [Main.layoutManager, Main.layoutManager.connect(
                'monitors-changed', () => this._rebuild())],
            [settings, settings.connect(
                'changed::pointer-barrier-enabled', () => this._rebuild())],
        ];
        this._rebuild();
    }

    get enabled() {
        return this._settings.get_boolean('pointer-barrier-enabled');
    }

    toggle() {
        this._settings.set_boolean('pointer-barrier-enabled', !this.enabled);
        return this.enabled;
    }

    destroy() {
        this._clear();
        for (const [object, id] of this._signals)
            object.disconnect(id);
        this._signals = [];
        this._settings = null;
    }

    _rebuild() {
        this._clear();
        if (!this.enabled)
            return;

        const primary = Main.layoutManager.primaryMonitor;
        if (!primary)
            return;

        for (const monitor of Main.layoutManager.monitors) {
            if (monitor === primary)
                continue;
            this._addSharedEdge(primary, monitor);
        }
    }

    _addSharedEdge(a, b) {
        const verticalOverlap = overlap(a.y, a.y + a.height, b.y, b.y + b.height);
        const horizontalOverlap = overlap(a.x, a.x + a.width, b.x, b.x + b.width);

        if (verticalOverlap && a.x + a.width === b.x)
            this._addPair(a.x + a.width, verticalOverlap[0], a.x + a.width,
                verticalOverlap[1], Meta.BarrierDirection.POSITIVE_X,
                Meta.BarrierDirection.NEGATIVE_X);
        else if (verticalOverlap && b.x + b.width === a.x)
            this._addPair(a.x, verticalOverlap[0], a.x, verticalOverlap[1],
                Meta.BarrierDirection.POSITIVE_X, Meta.BarrierDirection.NEGATIVE_X);
        else if (horizontalOverlap && a.y + a.height === b.y)
            this._addPair(horizontalOverlap[0], a.y + a.height,
                horizontalOverlap[1], a.y + a.height,
                Meta.BarrierDirection.POSITIVE_Y, Meta.BarrierDirection.NEGATIVE_Y);
        else if (horizontalOverlap && b.y + b.height === a.y)
            this._addPair(horizontalOverlap[0], a.y, horizontalOverlap[1], a.y,
                Meta.BarrierDirection.POSITIVE_Y, Meta.BarrierDirection.NEGATIVE_Y);
    }

    _addPair(x1, y1, x2, y2, forward, backward) {
        for (const directions of [forward, backward]) {
            this._barriers.push(new Meta.Barrier({
                backend: global.backend,
                x1,
                y1,
                x2,
                y2,
                directions,
            }));
        }
    }

    _clear() {
        for (const barrier of this._barriers)
            barrier.destroy();
        this._barriers = [];
    }
}

function overlap(startA, endA, startB, endB) {
    const start = Math.max(startA, startB);
    const end = Math.min(endA, endB);
    return end > start ? [start, end] : null;
}
