const timestamp = () => new Date().toISOString();

export const utils = {
  timestamp,
  normalizeChar: (ch) => (ch.length ? ch.toLowerCase() : ''),
  log: (...args) => console.log(`[${timestamp()}]`, ...args),
  warn: (...args) => console.warn(`[${timestamp()}]`, ...args),
  error: (...args) => console.error(`[${timestamp()}]`, ...args),
};
