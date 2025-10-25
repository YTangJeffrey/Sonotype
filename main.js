import { canvasManager } from './canvasManager.js';
import { recognitionManager } from './recognitionManager.js';
import { dom } from './dom.js';
import { state } from './state.js';
import { fragmentManager } from './fragmentManager.js';

const renderFrame = (now) => {
  const delta = Math.min(now - state.lastFrameTime, 64);
  state.lastFrameTime = now;

  canvasManager.clear();
  for (let i = state.clusters.length - 1; i >= 0; i -= 1) {
    const cluster = state.clusters[i];
    fragmentManager.advanceCluster(cluster, delta);
    fragmentManager.drawCluster(cluster);

    if (
      cluster.isFinal &&
      cluster.fragments.size === 0 &&
      cluster.y < -80
    ) {
      state.clusterMap.delete(cluster.id);
      state.clusters.splice(i, 1);
    }
  }

  requestAnimationFrame(renderFrame);
};

const bootstrap = () => {
  canvasManager.resize();
  window.addEventListener('resize', canvasManager.resize);

  recognitionManager.setup();
  dom.button.addEventListener('click', () => recognitionManager.start());

  state.lastFrameTime = performance.now();
  requestAnimationFrame(renderFrame);
};

bootstrap();
