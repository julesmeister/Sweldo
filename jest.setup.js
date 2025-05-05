// Mock window.electron
global.window = {
  electron: {
    listFiles: jest.fn(),
    readJsonFile: jest.fn(),
    writeJsonFile: jest.fn(),
  },
};

// Mock console methods
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};
