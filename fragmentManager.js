import { config } from './config.js';
import { ctx } from './dom.js';
import { state } from './state.js';

const randomDrift = (glyphWidth) => (Math.random() - 0.5) * glyphWidth * 0.6;

const ensureFragment = (cluster, slot) => {
  const key = slot.key;
  let fragment = cluster.fragments.get(key);
  if (fragment) {
    return fragment;
  }

  const glyphWidth = state.metrics.glyphWidth;
  const spawnX =
    cluster.x + slot.index * glyphWidth + randomDrift(glyphWidth);
  const spawnY = cluster.y;

  fragment = {
    id: key,
    ch: slot.ch,
    x: spawnX,
    y: spawnY,
    vx: (Math.random() - 0.5) * 8,
    vy: config.baseRiseSpeed,
    opacity: 1,
    linguistic: slot.isFinal ? 'FINAL' : 'PARTIAL',
    motion: 'RISING',
    slotIndex: slot.index,
    targetX: cluster.x + slot.index * glyphWidth,
    targetY: cluster.railY,
    version: cluster.version,
  };

  cluster.fragments.set(key, fragment);
  return fragment;
};

const updateFragmentAlignment = (fragment, cluster, slot) => {
  const glyphWidth = state.metrics.glyphWidth;
  fragment.slotIndex = slot.index;
  fragment.targetX = cluster.x + slot.index * glyphWidth;
  fragment.targetY = cluster.railY;
  fragment.ch = slot.ch;
  fragment.linguistic = slot.isFinal ? 'FINAL' : 'PARTIAL';
};

const dissolveFragment = (fragment) => {
  if (fragment.linguistic === 'FINAL') {
    fragment.motion = 'LOCKED';
    return;
  }
  if (fragment.linguistic !== 'SUPERSEDED') {
    fragment.linguistic = 'SUPERSEDED';
    fragment.motion = 'DISSOLVED';
  }
};

const clampToRail = (fragment) => {
  fragment.y = fragment.targetY;
  fragment.x = fragment.targetX ?? fragment.x;
  fragment.motion = fragment.linguistic === 'FINAL' ? 'LOCKED' : 'AT_RAIL';
  fragment.vy = 0;
};

const updatePartialAtRail = (fragment, seconds) => {
  const targetX = fragment.targetX ?? fragment.x;
  const deltaX = targetX - fragment.x;

  if (Math.abs(deltaX) <= 1) {
    fragment.x = targetX;
    fragment.motion = 'AT_RAIL';
    return;
  }

  fragment.motion = 'REFLOWING';
  const direction = deltaX > 0 ? 1 : -1;
  fragment.x +=
    direction *
    state.metrics.glyphWidth *
    config.lateralSpeed *
    seconds;

  if (
    (direction > 0 && fragment.x >= targetX) ||
    (direction < 0 && fragment.x <= targetX)
  ) {
    fragment.x = targetX;
    fragment.motion = 'AT_RAIL';
  }
};

const advanceFragment = (fragment, deltaSeconds) => {
  fragment.y += fragment.vy * deltaSeconds;
  fragment.x += fragment.vx * deltaSeconds;

  if (fragment.targetY != null && fragment.y <= fragment.targetY) {
    if (fragment.linguistic === 'FINAL') {
      clampToRail(fragment);
    } else {
      clampToRail(fragment);
      updatePartialAtRail(fragment, deltaSeconds);
    }
  }

  if (fragment.motion === 'DISSOLVED') {
    fragment.y += fragment.vy * deltaSeconds;
    fragment.opacity -= config.dissolveRate * deltaSeconds;
    if (fragment.opacity < 0) {
      fragment.opacity = 0;
    }
  }
};

const drawFragment = (fragment) => {
  if (fragment.opacity <= 0) {
    return;
  }
  ctx.globalAlpha = Math.max(0, Math.min(1, fragment.opacity));
  ctx.fillText(fragment.ch, fragment.x, fragment.y);
};

export const fragmentManager = {
  reconcileCluster(cluster) {
    const matched = new Set();

    cluster.slots.forEach((slot) => {
      const fragment = ensureFragment(cluster, slot);
      updateFragmentAlignment(fragment, cluster, slot);
      matched.add(fragment.id);
    });

    cluster.fragments.forEach((fragment, key) => {
      if (!matched.has(key)) {
        dissolveFragment(fragment);
      }
    });

    if (cluster.fragments.size > config.maxFragments) {
      const removable = Array.from(cluster.fragments.values()).filter(
        (fragment) => fragment.linguistic !== 'FINAL'
      );
      const excess = cluster.fragments.size - config.maxFragments;
      removable
        .sort((a, b) => a.opacity - b.opacity)
        .slice(0, excess)
        .forEach((fragment) => cluster.fragments.delete(fragment.id));
    }
  },

  advanceCluster(cluster, deltaMs) {
    const seconds = deltaMs / 1000;

    const prevY = cluster.prevY ?? cluster.y;
    const prevX = cluster.prevX ?? cluster.x;

    cluster.y += (cluster.vy ?? config.clusterRiseSpeed) * seconds;
    const dy = cluster.y - prevY;

    const dx = cluster.x - prevX;

    cluster.prevY = cluster.y;
    cluster.prevX = cluster.x;

    const removals = [];

    cluster.fragments.forEach((fragment, key) => {
      fragment.x += dx;
      fragment.y += dy;
      fragment.targetX += dx;
      advanceFragment(fragment, seconds);

      if (fragment.opacity <= 0 || fragment.y < -40) {
        removals.push(key);
      }
    });

    removals.forEach((key) => {
      cluster.fragments.delete(key);
    });
  },

  drawCluster(cluster) {
    cluster.fragments.forEach((fragment) => {
      drawFragment(fragment);
    });
  },
};
