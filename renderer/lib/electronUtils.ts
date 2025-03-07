// Utility functions for Electron environment
export const initializeElectronContext = () => {
  if (typeof window === 'undefined') return;

  // Define core globals that match our data model patterns
  const defineGlobal = (key: string, value: any) => {
    if (!(key in window)) {
      Object.defineProperty(window, key, {
        value,
        writable: true,
        configurable: true,
        enumerable: false
      });
    }
  };

  // Initialize globals needed for our app's modules
  defineGlobal('global', window);
  defineGlobal('process', { env: {}, type: 'renderer' });
  defineGlobal('webpackChunk_N_E', []);
};
