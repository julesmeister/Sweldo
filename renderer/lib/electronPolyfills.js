// Polyfills for Electron environment
if (typeof window !== 'undefined') {
  // Define a safe process object
  const safeProcess = {
    env: {},
    platform: 'browser',
    version: '',
    versions: {},
    arch: '',
    argv: [],
    pid: 0
  };

  // Define a safe global object
  const safeGlobal = {
    process: safeProcess,
    Buffer: null,
    setImmediate: setTimeout,
    clearImmediate: clearTimeout,
  };

  // Safely extend window
  const defineGlobal = (key, value) => {
    if (!(key in window)) {
      try {
        Object.defineProperty(window, key, {
          configurable: true,
          writable: true,
          enumerable: false,
          value
        });
      } catch (e) {
        console.warn(`Failed to define ${key}:`, e);
      }
    }
  };

  // Define globals
  defineGlobal('global', window);
  defineGlobal('process', safeProcess);

  // Handle webpack chunks
  if (!('webpackChunk_N_E' in window)) {
    defineGlobal('webpackChunk_N_E', []);
  }
}
