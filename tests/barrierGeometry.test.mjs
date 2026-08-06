import assert from 'node:assert/strict';
import test from 'node:test';

import {
    allowedDirections,
    BlockedDirection as D,
    buildBarrierSpecs,
    uncoveredSegments,
} from '../src/barrierGeometry.js';

const INSET = 12;

test('allowed directions exclude only the blocked component', () => {
    const masks = {
        [D.POSITIVE_X]: 1,
        [D.POSITIVE_Y]: 2,
        [D.NEGATIVE_X]: 4,
        [D.NEGATIVE_Y]: 8,
    };

    assert.equal(allowedDirections(D.POSITIVE_X, masks), 14);
    assert.equal(allowedDirections(D.NEGATIVE_X, masks), 11);
    assert.equal(allowedDirections(D.POSITIVE_Y, masks), 13);
    assert.equal(allowedDirections(D.NEGATIVE_Y, masks), 7);
    assert.throws(() => allowedDirections('diagonal', masks), RangeError);
});

test('side-by-side monitors get closed, directional boundaries', () => {
    const left = monitor(0, 0, 1920, 1080);
    const right = monitor(1920, 0, 1920, 1080);
    const specs = buildBarrierSpecs([left, right], INSET, true);

    assertBarrier(specs, 1908, 0, 1908, 1080, D.POSITIVE_X, true);
    assertBarrier(specs, 1932, 0, 1932, 1080, D.NEGATIVE_X, true);
    assertBarrier(specs, 0, 0, 1920, 0, D.NEGATIVE_Y, false);
    assertBarrier(specs, 0, 1068, 1920, 1068, D.POSITIVE_Y, false);
    assertBarrier(specs, 3828, 0, 3828, 1080, D.POSITIVE_X, false);

    // Physical guards and endpoint caps intersect the shared barrier, leaving
    // no open top-right or bottom-right corner.
    assert.ok(hasIntersection(specs, 1908, 0));
    assert.ok(hasIntersection(specs, 1908, 1068));
});

test('outer visibility changes only bottom and right guard positions', () => {
    const single = monitor(0, 0, 1920, 1080);
    const visible = buildBarrierSpecs([single], INSET, true);
    const physical = buildBarrierSpecs([single], INSET, false);

    assertBarrier(visible, 1908, 0, 1908, 1080, D.POSITIVE_X, false);
    assertBarrier(visible, 0, 1068, 1920, 1068, D.POSITIVE_Y, false);
    assertBarrier(physical, 1920, 0, 1920, 1080, D.POSITIVE_X, false);
    assertBarrier(physical, 0, 1080, 1920, 1080, D.POSITIVE_Y, false);
    for (const specs of [visible, physical]) {
        assertBarrier(specs, 0, 0, 0, 1080, D.NEGATIVE_X, false);
        assertBarrier(specs, 0, 0, 1920, 0, D.NEGATIVE_Y, false);
    }
});

test('stacked monitors use the same directional model', () => {
    const top = monitor(0, 0, 1920, 1080);
    const bottom = monitor(0, 1080, 1920, 1080);
    const specs = buildBarrierSpecs([top, bottom], INSET, true);

    assertBarrier(specs, 0, 1068, 1920, 1068, D.POSITIVE_Y, true);
    assertBarrier(specs, 0, 1092, 1920, 1092, D.NEGATIVE_Y, true);
});

test('staggered and split-neighbor layouts have no duplicate barriers', () => {
    const left = monitor(0, 200, 1920, 1080);
    const upperRight = monitor(1920, 0, 1920, 640);
    const lowerRight = monitor(1920, 640, 1920, 800);
    const specs = buildBarrierSpecs(
        [left, upperRight, lowerRight], INSET, true);
    const keys = specs.map(spec => Object.values(spec).join(':'));

    assert.equal(new Set(keys).size, keys.length);
    assert.equal(specs.filter(spec =>
        spec.x1 === 1908 && spec.x2 === 1908 &&
        spec.y1 === 200 && spec.y2 === 1280 &&
        spec.blockedDirection === D.POSITIVE_X).length, 1);
});

test('uncovered segments merge adjacent and overlapping neighbors', () => {
    assert.deepEqual(uncoveredSegments(0, 100, []), [[0, 100]]);
    assert.deepEqual(
        uncoveredSegments(0, 100, [[60, 90], [10, 30], [25, 70]]),
        [[0, 10], [90, 100]]);
    assert.deepEqual(
        uncoveredSegments(10, 90, [[-20, 20], [80, 120]]),
        [[20, 80]]);
    assert.deepEqual(
        uncoveredSegments(0, 100, [[0, 30], [30, 100]]), []);
});

test('invalid geometry is rejected before Mutter sees it', () => {
    assert.throws(() => buildBarrierSpecs(null, INSET, true), TypeError);
    assert.throws(() => buildBarrierSpecs([], 0, true), RangeError);
    assert.throws(() => buildBarrierSpecs(
        [monitor(0, 0, 20, 20)], INSET, true), RangeError);
    assert.throws(() => buildBarrierSpecs(
        [{x: 0.5, y: 0, width: 1920, height: 1080}], INSET, true),
    TypeError);
});

test('randomized high-speed motion cannot leave a monitor without a barrier', () => {
    const layouts = [
        [monitor(0, 0, 1920, 1080), monitor(1920, 0, 1920, 1080)],
        [monitor(0, 0, 1920, 1080), monitor(0, 1080, 1920, 1080)],
        [monitor(0, 200, 1920, 1080), monitor(1920, 0, 2560, 1440)],
        [
            monitor(0, 540, 1920, 1080),
            monitor(1920, 0, 1920, 1080),
            monitor(1920, 1080, 1920, 1080),
        ],
    ];
    const random = seededRandom(0x5eed1234);

    for (const monitors of layouts) {
        const specs = buildBarrierSpecs(monitors, INSET, true);
        for (const source of monitors) {
            for (let sample = 0; sample < 2500; sample++) {
                const start = {
                    x: randomBetween(random,
                        source.x + INSET + 1,
                        source.x + source.width - INSET - 1),
                    y: randomBetween(random,
                        source.y + INSET + 1,
                        source.y + source.height - INSET - 1),
                };
                const target = randomOutsidePoint(random, source);
                assert.ok(specs.some(spec => blocksSegment(spec, start, target)),
                    `unblocked path: ${JSON.stringify({source, start, target})}`);
            }
        }
    }
});

test('ordinary Ctrl crossings encounter only unlockable barriers', () => {
    const pairs = [
        [monitor(0, 0, 1920, 1080), monitor(1920, 0, 2560, 1440)],
        [monitor(0, 0, 1920, 1080), monitor(0, 1080, 1920, 1200)],
    ];
    const random = seededRandom(0xc7a1c7a1);

    for (const monitors of pairs) {
        const specs = buildBarrierSpecs(monitors, INSET, true);
        const [first, second] = monitors;
        for (let sample = 0; sample < 1000; sample++) {
            const vertical = first.x + first.width === second.x;
            const sharedStart = vertical
                ? Math.max(first.y, second.y)
                : Math.max(first.x, second.x);
            const sharedEnd = vertical
                ? Math.min(first.y + first.height, second.y + second.height)
                : Math.min(first.x + first.width, second.x + second.width);
            const along = randomBetween(random, sharedStart + 1, sharedEnd - 1);
            const start = vertical
                ? {x: first.x + first.width - INSET - 20, y: along}
                : {x: along, y: first.y + first.height - INSET - 20};
            const target = vertical
                ? {x: second.x + INSET + 20, y: along}
                : {x: along, y: second.y + INSET + 20};
            const blocking = specs.filter(spec =>
                blocksSegment(spec, start, target));

            assert.ok(blocking.length > 0);
            assert.ok(blocking.every(spec => spec.ctrlUnlocks),
                `Ctrl path met permanent barrier: ${JSON.stringify(blocking)}`);
        }
    }
});

function monitor(x, y, width, height) {
    return {x, y, width, height};
}

function assertBarrier(specs, x1, y1, x2, y2,
    blockedDirection, ctrlUnlocks) {
    assert.ok(specs.some(spec =>
        spec.x1 === x1 && spec.y1 === y1 &&
        spec.x2 === x2 && spec.y2 === y2 &&
        spec.blockedDirection === blockedDirection &&
        spec.ctrlUnlocks === ctrlUnlocks),
    `missing barrier ${JSON.stringify({
        x1, y1, x2, y2, blockedDirection, ctrlUnlocks,
    })}`);
}

function hasIntersection(specs, x, y) {
    return specs.filter(spec => pointOnSegment({x, y}, spec)).length >= 2;
}

function pointOnSegment(point, segment) {
    return point.x >= Math.min(segment.x1, segment.x2) &&
        point.x <= Math.max(segment.x1, segment.x2) &&
        point.y >= Math.min(segment.y1, segment.y2) &&
        point.y <= Math.max(segment.y1, segment.y2) &&
        cross(
            segment.x2 - segment.x1,
            segment.y2 - segment.y1,
            point.x - segment.x1,
            point.y - segment.y1) === 0;
}

function blocksSegment(barrier, start, target) {
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const movesBlockedDirection =
        (barrier.blockedDirection === D.POSITIVE_X && dx > 0) ||
        (barrier.blockedDirection === D.NEGATIVE_X && dx < 0) ||
        (barrier.blockedDirection === D.POSITIVE_Y && dy > 0) ||
        (barrier.blockedDirection === D.NEGATIVE_Y && dy < 0);
    return movesBlockedDirection && segmentsIntersect(
        start.x, start.y, target.x, target.y,
        barrier.x1, barrier.y1, barrier.x2, barrier.y2);
}

function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const rX = bx - ax;
    const rY = by - ay;
    const sX = dx - cx;
    const sY = dy - cy;
    const denominator = cross(rX, rY, sX, sY);
    if (denominator === 0)
        return false;

    const cax = cx - ax;
    const cay = cy - ay;
    const t = cross(cax, cay, sX, sY) / denominator;
    const u = cross(cax, cay, rX, rY) / denominator;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function cross(ax, ay, bx, by) {
    return ax * by - ay * bx;
}

function randomOutsidePoint(random, source) {
    const side = Math.floor(random() * 4);
    const distance = randomBetween(random, 1, Math.max(source.width, source.height) * 2);
    if (side === 0) {
        return {
            x: source.x - distance,
            y: randomBetween(random, source.y - source.height, source.y + source.height * 2),
        };
    } else if (side === 1) {
        return {
            x: source.x + source.width + distance,
            y: randomBetween(random, source.y - source.height, source.y + source.height * 2),
        };
    } else if (side === 2) {
        return {
            x: randomBetween(random, source.x - source.width, source.x + source.width * 2),
            y: source.y - distance,
        };
    }
    return {
        x: randomBetween(random, source.x - source.width, source.x + source.width * 2),
        y: source.y + source.height + distance,
    };
}

function randomBetween(random, minimum, maximum) {
    return minimum + random() * (maximum - minimum);
}

function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}
