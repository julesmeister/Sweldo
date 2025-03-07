// Polyfill global object for browser environment
if (typeof window !== 'undefined') {
  // Make window extensible for webpack chunks
  if (!window.hasOwnProperty('webpackChunk_N_E')) {
    Object.defineProperty(window, 'webpackChunk_N_E', {
      value: [],
      writable: true,
      configurable: true
    });
  }

  // Add other required globals
  const globals = {
    global: window,
    process: { env: {} },
    Buffer: require('buffer').Buffer
  };

  Object.entries(globals).forEach(([key, value]) => {
    if (!(key in window)) {
      Object.defineProperty(window, key, {
        value,
        writable: true,
        configurable: true
      });
    }
  });
}
