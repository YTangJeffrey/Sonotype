import { state } from './state.js';
import { clusterManager } from './clusterManager.js';
import { fragmentManager } from './fragmentManager.js';
import { utils } from './utils.js';

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const resetSessionState = () => {
  state.clusters = [];
  state.clusterMap.clear();
  state.activeCluster = null;
};

const ensureClusterForIndex = (index, result) => {
  let cluster = state.clusterMap.get(index);

  if (!cluster) {
    const previousActive = state.activeCluster;
    if (previousActive && !previousActive.isFinal && previousActive.id !== index) {
      utils.warn(
        'Creating a new cluster while previous segment is still interim.'
      );
    }
    cluster = clusterManager.getOrCreateCluster(index);
  }

  const prevIsFinal = cluster.isFinal;
  const textChanged = clusterManager.updateClusterFromResult(cluster, result);
  const statusChanged = prevIsFinal !== cluster.isFinal;

  if (textChanged || statusChanged || !cluster.slots.length) {
    fragmentManager.reconcileCluster(cluster);
  }

  if (!cluster.isFinal) {
    state.activeCluster = cluster;
  } else if (state.activeCluster && state.activeCluster.id === cluster.id) {
    state.activeCluster = cluster;
  }
};

export const recognitionManager = {
  setup() {
    if (!SpeechRecognition) {
      utils.error(
        'Web Speech API (SpeechRecognition) is not supported in this browser.'
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => this.handleResult(event);
    recognition.onstart = () => {
      state.isListening = true;
      resetSessionState();
      utils.log('Speech recognition started.');
    };
    recognition.onend = () => {
      state.isListening = false;
      utils.log('Speech recognition ended.');
      if (state.shouldRestart) {
        try {
          recognition.start();
        } catch (err) {
          utils.error('Failed to restart recognition:', err);
        }
      }
    };
    recognition.onerror = (event) => {
      utils.error('Speech recognition error:', event.error);
    };

    state.recognition = recognition;
  },

  handleResult(event) {
    for (let i = 0; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (!result[0]) {
        continue;
      }
      ensureClusterForIndex(i, result);
    }
  },

  start() {
    if (!state.recognition) {
      utils.error('Speech recognition is unavailable.');
      return;
    }

    if (state.isListening) {
      utils.log('Recognition already running.');
      return;
    }

    state.shouldRestart = true;
    try {
      state.recognition.start();
    } catch (err) {
      state.shouldRestart = false;
      utils.error('Unable to start recognition:', err);
    }
  },
};
