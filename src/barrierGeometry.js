/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Taner Incirci
 */

export const BlockedDirection = Object.freeze({
    POSITIVE_X: 'positive-x',
    NEGATIVE_X: 'negative-x',
    POSITIVE_Y: 'positive-y',
    NEGATIVE_Y: 'negative-y',
});

export function allowedDirections(blockedDirection, directionMasks) {
    const blockedMask = directionMasks[blockedDirection];
    if (blockedMask === undefined)
        throw new RangeError(`unknown blocked direction: ${blockedDirection}`);

    const allDirections = Object.values(directionMasks)
        .reduce((all, direction) => all | direction, 0);
    return allDirections & ~blockedMask;
}

export function buildBarrierSpecs(monitors, edgeInset, keepPointerVisible) {
    validateInputs(monitors, edgeInset);

    const barriers = [];
    const keys = new Set();
    const add = (x1, y1, x2, y2, blockedDirection,
        ctrlUnlocks = true) => {
        const barrier = {
            x1,
            y1,
            x2,
            y2,
            blockedDirection,
            ctrlUnlocks,
        };
        const key = Object.values(barrier).join(':');
        if (!keys.has(key)) {
            keys.add(key);
            barriers.push(barrier);
        }
    };

    for (let first = 0; first < monitors.length; first++) {
        for (let second = first + 1; second < monitors.length; second++)
            addSharedBarriers(monitors[first], monitors[second], edgeInset, add);
    }

    addPhysicalEdgeBarriers(monitors, edgeInset, keepPointerVisible, add);
    return barriers;
}

function addSharedBarriers(first, second, inset, add) {
    const verticalOverlap = overlap(
        first.y, first.y + first.height,
        second.y, second.y + second.height);
    const horizontalOverlap = overlap(
        first.x, first.x + first.width,
        second.x, second.x + second.width);

    if (verticalOverlap && first.x + first.width === second.x)
        addVerticalPair(second.x, first, second, inset, add);
    else if (verticalOverlap && second.x + second.width === first.x)
        addVerticalPair(first.x, second, first, inset, add);
    else if (horizontalOverlap && first.y + first.height === second.y)
        addHorizontalPair(second.y, first, second, inset, add);
    else if (horizontalOverlap && second.y + second.height === first.y)
        addHorizontalPair(first.y, second, first, inset, add);
}

function addVerticalPair(boundary, left, right, inset, add) {
    const leftX = boundary - inset;
    const rightX = boundary + inset;

    addVerticalSide(leftX, left, BlockedDirection.POSITIVE_X,
        leftX - inset, leftX, add);
    addVerticalSide(rightX, right, BlockedDirection.NEGATIVE_X,
        rightX, rightX + inset, add);
}

function addHorizontalPair(boundary, top, bottom, inset, add) {
    const topY = boundary - inset;
    const bottomY = boundary + inset;

    addHorizontalSide(topY, top, BlockedDirection.POSITIVE_Y,
        topY - inset, topY, add);
    addHorizontalSide(bottomY, bottom, BlockedDirection.NEGATIVE_Y,
        bottomY, bottomY + inset, add);
}

function addVerticalSide(x, monitor, blockedDirection,
    capStart, capEnd, add) {
    const bottom = monitor.y + monitor.height;

    add(x, monitor.y, x, bottom, blockedDirection);
    add(capStart, monitor.y, capEnd, monitor.y,
        BlockedDirection.NEGATIVE_Y, false);
    add(capStart, bottom, capEnd, bottom,
        BlockedDirection.POSITIVE_Y, false);
}

function addHorizontalSide(y, monitor, blockedDirection,
    capStart, capEnd, add) {
    const right = monitor.x + monitor.width;

    add(monitor.x, y, right, y, blockedDirection);
    add(monitor.x, capStart, monitor.x, capEnd,
        BlockedDirection.NEGATIVE_X, false);
    add(right, capStart, right, capEnd,
        BlockedDirection.POSITIVE_X, false);
}

function addPhysicalEdgeBarriers(monitors, inset, keepPointerVisible, add) {
    for (const monitor of monitors) {
        const left = monitor.x;
        const right = monitor.x + monitor.width;
        const top = monitor.y;
        const bottom = monitor.y + monitor.height;
        const covered = sharedSideSegments(monitor, monitors);

        for (const [start, end] of uncoveredSegments(
            top, bottom, covered.left)) {
            add(left, start, left, end,
                BlockedDirection.NEGATIVE_X, false);
        }
        for (const [start, end] of uncoveredSegments(
            top, bottom, covered.right)) {
            const x = keepPointerVisible ? right - inset : right;
            add(x, start, x, end,
                BlockedDirection.POSITIVE_X, false);
        }
        for (const [start, end] of uncoveredSegments(
            left, right, covered.top)) {
            add(start, top, end, top,
                BlockedDirection.NEGATIVE_Y, false);
        }
        for (const [start, end] of uncoveredSegments(
            left, right, covered.bottom)) {
            const y = keepPointerVisible ? bottom - inset : bottom;
            add(start, y, end, y,
                BlockedDirection.POSITIVE_Y, false);
        }
    }
}

function sharedSideSegments(monitor, monitors) {
    const left = monitor.x;
    const right = monitor.x + monitor.width;
    const top = monitor.y;
    const bottom = monitor.y + monitor.height;
    const covered = {left: [], right: [], top: [], bottom: []};

    for (const other of monitors) {
        if (other === monitor)
            continue;

        const otherRight = other.x + other.width;
        const otherBottom = other.y + other.height;
        if (left === otherRight)
            addOverlap(covered.left, top, bottom, other.y, otherBottom);
        if (right === other.x)
            addOverlap(covered.right, top, bottom, other.y, otherBottom);
        if (top === otherBottom)
            addOverlap(covered.top, left, right, other.x, otherRight);
        if (bottom === other.y)
            addOverlap(covered.bottom, left, right, other.x, otherRight);
    }

    return covered;
}

function addOverlap(target, startA, endA, startB, endB) {
    const segment = overlap(startA, endA, startB, endB);
    if (segment)
        target.push(segment);
}

function overlap(startA, endA, startB, endB) {
    const start = Math.max(startA, startB);
    const end = Math.min(endA, endB);
    return end > start ? [start, end] : null;
}

export function uncoveredSegments(start, end, covered) {
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

function validateInputs(monitors, edgeInset) {
    if (!Array.isArray(monitors))
        throw new TypeError('monitors must be an array');
    if (!Number.isInteger(edgeInset) || edgeInset < 1)
        throw new RangeError('edgeInset must be a positive integer');

    for (const monitor of monitors) {
        for (const property of ['x', 'y', 'width', 'height']) {
            if (!Number.isInteger(monitor[property]))
                throw new TypeError(`monitor ${property} must be an integer`);
        }
        if (monitor.width <= edgeInset * 2 ||
            monitor.height <= edgeInset * 2)
            throw new RangeError('edgeInset is too large for a monitor');
    }
}
