// Electron context and polyfills for consistent data access patterns
const initializeContext = () => {
  if (typeof window === 'undefined') return;

  // Initialize safe process object
  const processObj = {
    env: {},
    platform: window.electronAPI ? window.electronAPI.getPlatform?.() : 'browser',
    type: 'renderer'
  };

  // Initialize safe global object
  const globalObj = {
    process: processObj,
    Buffer: null,
    __dirname: '',
    __filename: ''
  };

  // Safely define properties
  const defineGlobalProperty = (key, value) => {
    if (!(key in window)) {
      try {
        Object.defineProperty(window, key, {
          value,
          writable: true,
          configurable: true,
          enumerable: false
        });
      } catch (e) {
        console.warn(`Failed to define ${key}:`, e);
      }
    }
    return window[key];
  };

  // Define core globals
  defineGlobalProperty('global', window);
  defineGlobalProperty('process', processObj);

  // Handle webpack chunks
  defineGlobalProperty('webpackChunk_N_E', []);

  // Export context
  return {
    process: processObj,
    global: window
  };
};

// Initialize context
const electronContext = initializeContext();

// Export for use in other modules
module.exports = electronContext;
