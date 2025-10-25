export const state = {
  recognition: null,
  isListening: false,
  shouldRestart: false,
  clusters: [],
  clusterMap: new Map(),
  activeCluster: null,
  metrics: {
    width: window.innerWidth || 0,
    height: window.innerHeight || 0,
    glyphWidth: 16,
    railTop: 0,
  },
  lastFrameTime: performance.now(),
};

export const createCluster = (id, metrics, config) => {
  const spawnY = metrics.height - config.spawnMargin;
  const x = config.railPadding;

  return {
    id,
    x,
    y: spawnY,
    prevX: x,
    prevY: spawnY,
    vy: config.clusterRiseSpeed,
    railY: metrics.height * 0.1,
    text: '',
    isFinal: false,
    version: 0,
    slots: [],
    fragments: new Map(),
  };
};
