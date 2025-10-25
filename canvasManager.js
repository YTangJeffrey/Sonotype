import { dom, ctx } from './dom.js';
import { config } from './config.js';
import { state } from './state.js';

const resize = () => {
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  dom.canvas.width = Math.round(width * dpr);
  dom.canvas.height = Math.round(height * dpr);
  dom.canvas.style.width = `${width}px`;
  dom.canvas.style.height = `${height}px`;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.font = config.font;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  state.metrics = {
    width,
    height,
    glyphWidth: ctx.measureText('M').width,
    railTop: height * 0.1,
  };

  state.clusters.forEach((cluster) => {
    const oldX = cluster.x;
    cluster.railY = state.metrics.height * 0.1;
    cluster.x = config.railPadding;
    const dx = cluster.x - oldX;
    cluster.prevX = cluster.x;
    const glyphWidth = state.metrics.glyphWidth;
    cluster.fragments.forEach((fragment) => {
      fragment.x += dx;
      fragment.targetX = cluster.x + (fragment.slotIndex ?? 0) * glyphWidth;
      fragment.targetY = cluster.railY;
    });
  });
};

const clear = () => {
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  ctx.fillRect(0, 0, state.metrics.width, state.metrics.height);
  ctx.fillStyle = '#f8fafc';
};

export const canvasManager = {
  resize,
  clear,
};
