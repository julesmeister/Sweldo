# CSS Production Build Issues and Solutions

## Overview of the Issue

The project experienced CSS distortion issues when running the production build (.exe file) while CSS rendered correctly in development mode. This is a common issue in Electron applications where CSS loading paths and mechanisms differ between development and production environments.

## Root Causes

1. **Inconsistent CSS File Copying**: Production builds weren't properly copying all necessary CSS files to the required directories.
2. **Missing CSS Files**: Some key CSS files (`globals.css`) were being skipped in the build process.
3. **Path Resolution Issues**: The Electron runtime couldn't correctly resolve CSS file paths in the packaged application.
4. **Fallback Path Gaps**: The CSS loading system lacked comprehensive fallbacks for production.

## Files Modified and Solutions

### 1. `package.json` Build Scripts

The build scripts were enhanced to properly copy both `tailwind-web.css` and `globals.css` to all required directories:

```json
"build": "npm run generate:tailwind && npm run sync:styles && npm run inline:tailwind && node renderer/scripts/ensure-css-paths.js && powershell -Command \"if (!(Test-Path app/static/css)) { New-Item -ItemType Directory -Force -Path app/static/css }; Copy-Item -Force renderer/public/styles/tailwind-web.css app/static/css/tailwind-web.css; Copy-Item -Force renderer/styles/globals.css app/static/css/globals.css; if (!(Test-Path app/styles)) { New-Item -ItemType Directory -Force -Path app/styles }; Copy-Item -Force renderer/public/styles/tailwind-web.css app/styles/tailwind-web.css; Copy-Item -Force renderer/styles/globals.css app/styles/globals.css; if (!(Test-Path resources/css)) { New-Item -ItemType Directory -Force -Path resources/css }; Copy-Item -Force renderer/public/styles/tailwind-web.css resources/css/tailwind-web.css; Copy-Item -Force renderer/styles/globals.css resources/css/globals.css\" && echo 'CSS files copied to all locations' && nextron build",
```

Key changes:
- Added explicit copying of `globals.css` alongside `tailwind-web.css`
- Ensured all target directories receive both CSS files
- Added verification step with console output

### 2. `electron-builder.yml` Configuration

Modified the configuration to include explicit file paths for CSS files:

```yaml
files:
  - from: .
    filter:
      - package.json
      - app
  - from: resources/css
    to: app/static/css
  - from: resources/css
    to: app/styles
  - from: resources/css
    to: resources/css
  - from: renderer/public/styles
    to: app/styles
  - from: renderer/public/styles
    to: app/static/css
  # Add explicit copy of renderer/styles to ensure globals.css is included
  - from: renderer/styles
    to: app/styles
  - from: renderer/styles
    to: app/static/css
```

Key changes:
- Added explicit paths for `renderer/styles` to ensure `globals.css` is included
- Ensured CSS files are copied to multiple locations for redundancy

### 3. `renderer/utils/styleInjector.js` Enhancements

Enhanced the style injection system to load both CSS files and add comprehensive fallbacks:

```javascript
// Additional Electron-specific styles
if (window.electron) {
  window.electron
    .loadCssPath("tailwind-web.css")
    .then((cssPath) => {
      if (cssPath) {
        console.log("Found CSS path via IPC:", cssPath);
        const tailwindLink = document.createElement("link");
        tailwindLink.rel = "stylesheet";
        tailwindLink.href = cssPath;
        tailwindLink.id = "tailwind-css-electron";
        document.head.appendChild(tailwindLink);
      }
    })
    .catch((err) => {
      console.error("Error loading CSS via IPC:", err);
    });
    
  // Also try to load globals.css specifically for Electron mode
  window.electron
    .loadCssPath("globals.css")
    .then((cssPath) => {
      if (cssPath) {
        console.log("Found globals CSS path via IPC:", cssPath);
        const globalsLink = document.createElement("link");
        globalsLink.rel = "stylesheet";
        globalsLink.href = cssPath;
        globalsLink.id = "globals-css-electron";
        document.head.appendChild(globalsLink);
      }
    })
    .catch((err) => {
      console.error("Error loading globals CSS via IPC:", err);
    });
}
```

And for web mode:

```javascript
// Try multiple fallback paths for different environments
const fallbackPaths = [
  "/static/css/tailwind-web.css",
  "../styles/tailwind-web.css",
  "./styles/tailwind-web.css",
  "../../app/static/css/tailwind-web.css",
  // Add additional paths for globals.css
  "/styles/globals.css",
  "/static/css/globals.css",
  "../styles/globals.css",
  "./styles/globals.css",
  "../../app/static/css/globals.css",
];
```

Key changes:
- Added explicit loading of `globals.css` in Electron mode
- Added multiple fallback paths for both CSS files in web mode
- Improved error handling and logging

### 4. `renderer/scripts/ensure-css-paths.js` Rewrite

Completely rewrote this script to handle multiple CSS files and verify they're copied correctly:

```javascript
const CSS_FILES = ['tailwind-web.css', 'globals.css'];
const TARGET_DIRS = [
  path.resolve(__dirname, '../../app/static/css'),
  path.resolve(__dirname, '../../app/styles'),
  path.resolve(__dirname, '../../resources/css'),
];

// Source directories to check for CSS files
const SOURCE_DIRS = [
  path.resolve(__dirname, '../public/styles'),
  path.resolve(__dirname, '../styles'),
  path.resolve(__dirname, '../../resources/css'),
];

// For each CSS file, find it in source directories and copy to all target directories
CSS_FILES.forEach(cssFile => {
  let sourceFound = false;
  let sourcePath = null;

  // Find the first available source for this CSS file
  for (const sourceDir of SOURCE_DIRS) {
    const potentialPath = path.join(sourceDir, cssFile);
    if (fs.existsSync(potentialPath)) {
      sourceFound = true;
      sourcePath = potentialPath;
      console.log(`Found source for ${cssFile} at: ${sourcePath}`);
      break;
    }
  }

  if (!sourceFound) {
    console.warn(`WARNING: Could not find source for ${cssFile}!`);
    if (cssFile === 'tailwind-web.css') {
      console.log('This is a critical file. Make sure to run npm run generate:tailwind first.');
    }
    return;
  }

  // Copy to all target directories
  TARGET_DIRS.forEach(targetDir => {
    const targetPath = path.join(targetDir, cssFile);
    try {
      fse.copySync(sourcePath, targetPath, { overwrite: true });
      console.log(`Copied ${cssFile} to: ${targetPath}`);
    } catch (error) {
      console.error(`Error copying ${cssFile} to ${targetPath}:`, error);
    }
  });
});
```

Key changes:
- Refactored to handle multiple CSS files (`tailwind-web.css` and `globals.css`)
- Added multiple source directory checks for resilience
- Improved error handling and console output
- Added guidance for missing files

### 5. `main/background.ts` CSS Handling

Enhanced the Electron main process CSS handling:

```javascript
async function ensureCssAvailable() {
  if (!isProd) return; // Only needed in production

  const cssFiles = ["tailwind-web.css", "globals.css"];
  const targetDirs = [
    path.join(app.getAppPath(), "app", "static", "css"),
    path.join(app.getAppPath(), "app", "styles"),
    path.join(app.getAppPath(), "resources", "css"),
  ];

  for (const cssFileName of cssFiles) {
    // Check source files that might contain our CSS
    const possibleSources = [
      path.join(app.getAppPath(), "renderer", "public", "styles", cssFileName),
      path.join(app.getAppPath(), "renderer", "styles", cssFileName),
      path.join(app.getAppPath(), "resources", "css", cssFileName),
      path.join(app.getAppPath(), "app", "static", "css", cssFileName),
    ];

    // Find first available source
    let sourceCssPath = null;
    for (const source of possibleSources) {
      try {
        if (await pathExists(source)) {
          sourceCssPath = source;
          console.log(`Found CSS source at: ${sourceCssPath}`);
          break;
        }
      } catch (err) {
        console.error(`Error checking path ${source}:`, err);
      }
    }

    if (!sourceCssPath) {
      console.error(`No CSS source file found for ${cssFileName}!`);
      continue;
    }

    // Copy to all target directories
    for (const dir of targetDirs) {
      try {
        if (!(await pathExists(dir))) {
          await ensureDir(dir);
        }
        const targetPath = path.join(dir, cssFileName);
        await copy(sourceCssPath, targetPath, { overwrite: true });
        console.log(`Copied CSS to: ${targetPath}`);
      } catch (err) {
        console.error(`Failed to copy CSS to ${dir}:`, err);
      }
    }
  }
}
```

Key changes:
- Refactored to handle multiple CSS files
- Added multiple source directory checks
- Enhanced error handling and retry logic
- Improved logging for debugging

## Latest Solutions (2023)

### Direct CSS Injection Approach

The most effective solution implemented was a direct CSS injection approach in `styleInjector.js`:

```javascript
// DIRECT APPROACH: Immediately inject known paths for CSS - more reliable than IPC
console.log("[Style Injector] Applying direct CSS injection for production build");

// Try multiple direct paths to ensure CSS is loaded
const directPaths = [
  "app://./app/static/css/tailwind-web.css",
  "app://./app/styles/tailwind-web.css",
  "app://./resources/css/tailwind-web.css",
  "app://./static/css/tailwind-web.css"
];

directPaths.forEach((path, index) => {
  const directLink = document.createElement("link");
  directLink.rel = "stylesheet";
  directLink.href = path;
  directLink.id = `tailwind-css-direct-${index}`;
  document.head.appendChild(directLink);
  console.log(`[Style Injector] Added direct CSS link: ${path}`);

  // Add load listener to see which one actually loads
  directLink.addEventListener("load", () => {
    console.log(`[Style Injector] Successfully loaded CSS from direct path: ${path}`);
  });
});
```

This approach:
1. Bypasses the IPC mechanism entirely
2. Tries multiple possible paths simultaneously
3. Uses event listeners to verify which paths successfully load
4. Provides detailed logging for debugging

### AsarUnpack Configuration

A critical fix was to update the `electron-builder.yml` to unpack CSS files outside the asar archive:

```yaml
asar: true
asarUnpack:
  - "**/*.css"
  - "**/app/static/css/**"
  - "**/app/styles/**"
  - "**/static/css/**"
  - "**/resources/css/**"
```

This ensures CSS files remain accessible as normal files, not compressed within the asar archive, making them easier to load directly.

### Improved File Copying Configuration

The electron-builder.yml configuration was enhanced to copy CSS files to multiple locations:

```yaml
files:
  - from: .
    filter:
      - package.json
      - app
  # More explicit CSS paths with specific file inclusions
  - from: renderer/public/styles
    to: app/static/css
    filter:
      - "**/*.css"
  - from: renderer/public/styles
    to: app/styles
    filter:
      - "**/*.css"
  - from: renderer/public/styles
    to: static/css
    filter:
      - "**/*.css"
  - from: renderer/styles
    to: app/static/css
    filter:
      - "**/*.css"
  - from: renderer/styles
    to: app/styles
    filter:
      - "**/*.css"
  - from: renderer/styles
    to: static/css
    filter:
      - "**/*.css"
  - from: resources/css
    to: app/static/css
    filter:
      - "**/*.css"
  - from: resources/css
    to: app/styles
    filter:
      - "**/*.css"
  - from: resources/css
    to: resources/css
    filter:
      - "**/*.css"
  - from: resources/css
    to: static/css
    filter:
      - "**/*.css"
```

This provides maximum redundancy by copying all CSS files to multiple locations within the app package.

### Inlined Styles as Backup

The inlined styles mechanism was enhanced with better logging:

```javascript
export function injectInlinedStyles() {
  if (typeof document === "undefined") {
    return;
  }

  console.log("[inlinedStyles] Injecting inlined Tailwind CSS into document head");
  
  // Add the inlined styles only if they don't exist already
  if (!document.getElementById("inlined-tailwind-css")) {
    const styleElement = document.createElement("style");
    styleElement.id = "inlined-tailwind-css";
    styleElement.textContent = inlinedTailwindCSS;
    document.head.appendChild(styleElement);
    console.log("[inlinedStyles] Successfully injected inlined Tailwind CSS");
  } else {
    console.log("[inlinedStyles] Inlined Tailwind CSS already exists in document");
  }
}
```

### Window Configuration for Proper Display

To ensure the application launches with a maximized window without flickering:

```typescript
// In main/background.ts
const mainWindow = createWindow("main", {
  width: 1600,
  height: 900,
  show: false, // Initially hide window to prevent flashing before maximizing
  webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    nodeIntegration: false,
    contextIsolation: true,
  },
});

// Once ready-to-show, show the window
mainWindow.once('ready-to-show', () => {
  console.log('[Main] Window ready to show');
  mainWindow.show();
});
```

And in `create-window.ts`:

```typescript
window.maximize();
console.log(`[Window Helper] Window "${windowName}" created and maximized`);
```

This approach:
1. Creates the window hidden initially
2. Maximizes it before showing it
3. Only shows the window once it's fully loaded and ready
4. Prevents flickering or resizing after display

## CSS Loading Process

The complete CSS loading process now follows this sequence:

1. **Build Phase**:
   - CSS files are generated with `npm run generate:tailwind`
   - Files are copied to multiple locations in the app structure
   - Some CSS is inlined into JavaScript for guaranteed loading

2. **Application Startup**:
   - Main process verifies CSS files in production
   - Electron window is configured for proper display

3. **Renderer Loading**:
   - Inlined CSS is injected first for basic styling
   - Direct CSS links are added to multiple possible paths
   - IPC mechanism is used as a fallback
   - Event listeners track which paths successfully load
   - Detailed logging helps identify loading issues

This multi-layered approach ensures CSS will be available in the production build regardless of packaging quirks or path resolution issues.

## How This Resolves the Issue

The combination of these changes ensures that:

1. **Multiple CSS Files**: Both `tailwind-web.css` and `globals.css` are properly included in the build
2. **Redundant Paths**: Files are copied to multiple locations for maximized chance of discovery
3. **Runtime Verification**: CSS files are verified and copied at runtime if missing
4. **Dynamic Loading**: The style injector dynamically loads CSS from multiple potential locations
5. **Comprehensive Fallbacks**: Multiple fallback paths ensure CSS is found even if some paths fail

## Checking CSS Loading in the Future

If CSS issues occur in production builds:

1. Check the console log for any CSS loading errors
2. Verify that both CSS files exist in `app/static/css` and `app/styles` directories
3. Make sure the build script in `package.json` is correctly copying all files
4. Check that the `styleInjector.js` is attempting to load from all relevant paths
5. Run a clean build with `npm run generate:tailwind` first, then `npm run build`

## Recommended Build Process

To build a production version with properly functioning CSS:

```bash
npm run generate:tailwind
npm run sync:styles
npm run build
```

This ensures tailwind CSS is generated, styles are synchronized, and all files are correctly copied during the build process. 