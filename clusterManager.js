import { config } from './config.js';
import { state, createCluster } from './state.js';

const ensureMetricsReady = () => {
  if (!state.metrics || state.metrics.width === 0) {
    state.metrics = {
      width: window.innerWidth || 0,
      height: window.innerHeight || 0,
      glyphWidth: 16,
      railTop: 0,
    };
  }
};

export const clusterManager = {
  getOrCreateCluster(segId) {
    ensureMetricsReady();
    let cluster = state.clusterMap.get(segId);
    if (cluster) {
      return cluster;
    }

    const newCluster = createCluster(segId, state.metrics, config);
    state.clusters.push(newCluster);
    state.clusterMap.set(segId, newCluster);
    state.activeCluster = newCluster;
    return newCluster;
  },

  updateClusterFromResult(cluster, result) {
    const transcript = result[0]?.transcript ?? '';
    const isFinal = result.isFinal === true;

    const textChanged = cluster.text !== transcript;
    cluster.isFinal = isFinal;

    if (textChanged) {
      cluster.version += 1;
      cluster.text = transcript;

      const chars = [...transcript];
      cluster.slots = chars.map((ch, index) => ({
        index,
        ch,
        key: `${cluster.id}:${index}:${cluster.version}`,
        isFinal,
      }));
    } else {
      // Even if the text did not change, we need to ensure slots exist
      if (!cluster.slots.length) {
        const chars = [...transcript];
        cluster.slots = chars.map((ch, index) => ({
          index,
          ch,
          key: `${cluster.id}:${index}:${cluster.version}`,
          isFinal,
        }));
      } else {
        cluster.slots = cluster.slots.map((slot, index) => ({
          ...slot,
          ch: transcript[index] ?? '',
          isFinal,
        }));
      }
    }

    return textChanged;
  },
};
