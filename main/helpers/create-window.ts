import {
  screen,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  Rectangle,
} from "electron";
import Store from "electron-store";
import path from "path";
import { app } from "electron";

interface WindowState {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  isMaximized?: boolean;
}

export const createWindow = (
  windowName: string,
  options: BrowserWindowConstructorOptions
): BrowserWindow => {
  const key = "window-state";
  const name = `window-state-${windowName}`;
  const store = new Store<Rectangle>({ name });
  const defaultSize = {
    width: options.width,
    height: options.height,
  };
  let state = {};
  let win: BrowserWindow;

  const restore = () => store.get(key, defaultSize) as WindowState;

  const getCurrentPosition = () => {
    const position = win.getPosition();
    const size = win.getSize();
    return {
      x: position[0],
      y: position[1],
      width: size[0],
      height: size[1],
    };
  };

  const windowWithinBounds = (
    windowState: WindowState,
    bounds: Electron.Rectangle
  ) => {
    return (
      windowState.x! >= bounds.x &&
      windowState.y! >= bounds.y &&
      windowState.x! + windowState.width! <= bounds.x + bounds.width &&
      windowState.y! + windowState.height! <= bounds.y + bounds.height
    );
  };

  const resetToDefaults = () => {
    const bounds = screen.getPrimaryDisplay().bounds;
    return Object.assign({}, defaultSize, {
      x: (bounds.width - defaultSize.width!) / 2,
      y: (bounds.height - defaultSize.height!) / 2,
    });
  };

  const ensureVisibleOnSomeDisplay = (windowState: WindowState) => {
    const visible = screen.getAllDisplays().some((display) => {
      return windowWithinBounds(windowState, display.bounds);
    });
    if (!visible) {
      // Window is partially or fully not visible now.
      // Reset it to safe defaults.
      return resetToDefaults();
    }
    return windowState;
  };

  const saveState = () => {
    if (!win.isMinimized() && !win.isMaximized()) {
      Object.assign(state, getCurrentPosition());
    }
    store.set(key, state);
  };

  state = ensureVisibleOnSomeDisplay(restore());

  const browserOptions: BrowserWindowConstructorOptions = {
    ...options,
    ...state,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      ...options.webPreferences,
    },
  };
  win = new BrowserWindow(browserOptions);

  win.on("close", saveState);

  win.maximize();
  console.log(`[Window Helper] Window "${windowName}" created and maximized`);

  // Add CSS paths to window properties for debugging
  const cssLocations = [
    path.join(app.getAppPath(), "app", "static", "css"),
    path.join(app.getAppPath(), "app", "styles"),
    path.join(app.getAppPath(), "resources", "css"),
    path.join(app.getAppPath(), "static", "css"),
  ];

  console.log("[Window Helper] CSS lookup paths:", cssLocations);

  // Inject CSS files directly when window is ready
  win.webContents.on("did-finish-load", () => {
    console.log(
      `[Window Helper] Window "${windowName}" finished loading, injecting CSS files...`
    );

    // Inject CSS file loading via JS
    win.webContents
      .executeJavaScript(
        `
      console.log("[CSS Loader] Direct CSS injection via webContents")
      try {
        const directPaths = [
          "app://./app/static/css/tailwind-web.css",
          "app://./app/styles/tailwind-web.css",
          "app://./resources/css/tailwind-web.css",
          "app://./static/css/tailwind-web.css"
        ]
        
        directPaths.forEach((path, index) => {
          const link = document.createElement("link")
          link.rel = "stylesheet"
          link.href = path
          link.id = "css-direct-" + index
          document.head.appendChild(link)
          console.log("Added CSS link: " + path)
        })
      } catch(e) {
        console.error("Error injecting CSS:", e)
      }
    `
      )
      .catch((err) =>
        console.error("[Window Helper] Error executing JS:", err)
      );
  });

  // Track window state
  let quitting = false;
  app.on("before-quit", () => {
    quitting = true;
  });

  return win;
};
