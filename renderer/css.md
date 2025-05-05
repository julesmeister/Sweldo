# CSS Handling in Sweldo

This document explains how CSS is handled in the Sweldo application across different environments.

## Environment Differences

### Nextron (Electron) Environment
- Path aliases: `@/resources/*` works
- Global CSS imports: Can be imported from components
- Font loading: Uses local file system paths

### Web Environment 
- Path aliases: Requires `/resources/*` format
- Global CSS imports: Must be in `_app.tsx` only
- Font loading: Needs public URL paths

## Current Implementation (Working Solution)

After many iterations, we've implemented a robust solution that works in both environments:

### For Nextron (Electron)
- CSS is loaded at runtime via document.createElement
- No CSS imports in the build process to avoid webpack confusion
- All existing CSS functionality is preserved via runtime loading

### For Web Mode
- Completely bypasses the problematic CSS loader
- Uses a combination of:
  1. Inline critical CSS in `_document.js`
  2. Runtime style injection via `styleInjector.js`
  3. CDN-based Tailwind CSS
  4. No CSS imports at all during build process

### Key Implementation Files

1. **renderer/pages/_document.js**
   - Provides critical inline styles for immediate rendering
   - Includes font declarations and minimal reset CSS

2. **renderer/utils/styleInjector.js**
   - Injects additional styles at runtime
   - Handles font declarations, base styles, and CSS variables
   - Loads Tailwind CSS from CDN

3. **renderer/pages/_app.tsx**
   - Uses pure runtime CSS loading for both environments
   - For Nextron: Loads CSS via appendChild at runtime
   - For Web: Uses JS-based style injection
   - No build-time CSS imports anywhere in the code

4. **renderer/utils/mockModules.tsx**
   - Provides mock implementations of problematic components
   - Used to replace components that import CSS files
   - Includes a simplified DatePicker component for web mode
   - Uses Function-based dynamic require to avoid webpack processing

## Attempted Solutions That Failed

### 1. Direct CSS Imports with Static Checks (FAILED)

We attempted to restore direct CSS imports for Nextron mode while keeping web mode working with this approach:

```javascript
// In _app.tsx - attempt to use direct imports for Nextron only
if (typeof process !== 'undefined' && process.env.IS_NEXTRON === 'true') {
  require("../styles/globals.css");
}

// In DateRangePicker.tsx - attempt to import CSS conditionally
if (typeof process !== 'undefined' && process.env.IS_NEXTRON === 'true') {
  require("react-datepicker/dist/react-datepicker.css");
}

// In mockModules.tsx - attempt to use real component in Nextron mode
let DatePickerReal: any = null;
if (typeof process !== 'undefined' && process.env.IS_NEXTRON === 'true') {
  DatePickerReal = require("react-datepicker").default;
}
```

**Why it failed:**
- Even with strict static checking, webpack still attempts to resolve the CSS imports
- The CSS loader error persists in web mode
- When trying to fix web mode, Nextron mode breaks and vice versa
- We couldn't find a static check that satisfied both webpack and babel

### 2. Process.env Checks (FAILED)

```javascript
if (process.env.IS_NEXTRON === 'true') {
  require("../styles/globals.css");
}
```

**Why it failed:**
- Next.js still processes both branches of the conditional during build
- The CSS loader error still occurs in web mode

### 3. Function-based Dynamic Imports (FAILED)

```javascript
// Attempt to dynamically load components
const DatePickerModule = Function('return require("react-datepicker")')();
```

**Why it failed:**
- While this approach worked for components, it didn't work for CSS files
- Nextron mode had incomplete styles without direct CSS imports

### 4. Pure Runtime CSS Loading in Both Environments (FAILED)

We tried to apply a unified approach that would work for both environments:

```javascript
// In _app.tsx
useEffect(() => {
  if (!isWebEnvironment()) {
    // For Nextron: load CSS at runtime
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/styles/globals.css";
    document.head.appendChild(link);
    
    // Also load react-datepicker CSS
    const datepickerLink = document.createElement("link");
    datepickerLink.rel = "stylesheet";
    datepickerLink.href = "https://cdn.jsdelivr.net/npm/react-datepicker@4.11.0/dist/react-datepicker.css";
    document.head.appendChild(datepickerLink);
  } else {
    // For web: use our custom styleInjector
    import("../utils/styleInjector")
      .then((module) => module.injectStyles());
  }
}, []);
```

**Why it failed for Nextron:**
- Runtime CSS loading resulted in flickering and incomplete styles in Nextron
- Path resolution for CSS files is different between Nextron and web
- Some CSS features need to be present during initial render

## Working Solution (Separate Implementations)

We've concluded that the only way to handle both environments correctly is to maintain two completely separate implementations:

### For Web Mode (Working Solution)

```javascript
// For web mode only - in _app.tsx
if (isWebEnvironment() && typeof window !== "undefined") {
  import("../utils/styleInjector")
    .then((module) => module.injectStyles());
}
```

### For Nextron Mode (Working Solution)

```javascript
// For Nextron mode - Direct imports
// In _app.tsx for base imports
import "../styles/globals.css";

// In DateRangePicker.tsx for component-specific imports
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
```

## Transitioning Between Implementations

Since we can't have both implementations working simultaneously, we need to toggle between them based on which environment we're targeting:

### For Web Mode (Comment Out Imports)

```javascript
// COMMENTED OUT: Direct CSS import for Nextron mode
// This breaks web mode, so we're removing it for now
// import "../styles/globals.css";

// Add runtime CSS loading for Nextron
if (!isWebEnvironment() && typeof window !== "undefined") {
  // Load globals.css at runtime for Nextron
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/styles/globals.css";
  document.head.appendChild(link);
}
```

### For Nextron Mode (Uncomment Imports)

```javascript
// Direct CSS import for Nextron mode
import "../styles/globals.css";

// Skip runtime CSS loading since we're importing directly
```

### Switching Process

When switching between environments, we need to:

1. Edit _app.tsx to either enable or disable direct CSS imports
2. Edit DateRangePicker.tsx to either enable or disable component CSS imports
3. Run the appropriate npm script (dev or dev:web)

This manual process is cumbersome but necessary until a better solution is found.

## Current Status (May 2023)

### Direct CSS Imports Work for Nextron Now

We've managed to get Nextron mode working again by reverting to direct CSS imports:

```javascript
// In _app.tsx - Direct import works for Nextron
import "../styles/globals.css";
```

This approach makes Nextron look and function correctly, with proper styling including for third-party components like DatePicker.

### But Web Mode Breaks Again

However, using direct CSS imports in _app.tsx breaks web mode with the same error:

```
TypeError: Cannot read properties of undefined (reading 'blocklist')
```

The error occurs in the CSS loader when it tries to process globals.css.

### The Ultimate Dilemma

We're facing a fundamental compatibility issue where:
- Nextron requires direct CSS imports to work properly
- Web mode breaks with any CSS imports due to the Next.js CSS loader bug
- Conditional imports don't work because webpack processes all branches

This appears to be a "pick one or the other" situation where we can't have both environments working from the same codebase simultaneously.

## Environment-Specific Files Solution (FINAL SOLUTION)

After numerous attempts, we've implemented a solution using environment-specific files:

### 1. Create Environment-Specific Files

We've created separate _app files for each environment:

**_app.nextron.tsx** (with direct CSS imports)
```javascript
// Direct imports for Nextron mode
import "../styles/globals.css";

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Nextron-specific code here
    injectNextronStyles();
  }, []);
  
  // ... rest of component
}
```

**_app.web.tsx** (with runtime CSS injection)
```javascript
// NO DIRECT CSS IMPORTS for web mode

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Web-specific code here
    import("../utils/styleInjector")
      .then((module) => module.injectStyles());
  }, []);
  
  // ... rest of component
}
```

### 2. Auto-copy Script in Next Config

We've modified next.config.js to automatically use the right file:

```javascript
// Detect environment
const isNextronBuild = fs.existsSync(path.resolve(__dirname, "../resources"));

// Choose appropriate _app file
const appTarget = isNextronBuild ? "_app.nextron.tsx" : "_app.web.tsx";

// Copy the environment-specific file to _app.tsx
try {
  if (fs.existsSync(path.resolve(__dirname, `./pages/${appTarget}`))) {
    fs.copyFileSync(
      path.resolve(__dirname, `./pages/${appTarget}`),
      path.resolve(__dirname, './pages/_app.tsx')
    );
    console.log(`Using ${appTarget} for this environment`);
  }
} catch (err) {
  console.error(`Error setting up environment-specific _app file:`, err);
}
```

### 3. Manual Switching Script

For easier testing, we've created a switching script:

```javascript
// switch-env.js
const target = process.argv[2]; // 'web' or 'nextron'

const files = [
  {
    base: '_app.tsx',
    web: '_app.web.tsx',
    nextron: '_app.nextron.tsx',
    dir: './pages'
  }
];

files.forEach(file => {
  // Copy the appropriate file based on target environment
  fs.copyFileSync(
    path.resolve(__dirname, `${file.dir}/${file[target]}`),
    path.resolve(__dirname, `${file.dir}/${file.base}`)
  );
});
```

Usage: `node switch-env.js web` or `node switch-env.js nextron`

### Benefits of this Approach

1. **Clean Separation**: Each environment gets exactly what it needs
2. **No Compromise**: Full CSS functionality in Nextron, no CSS loader issues in web
3. **Maintainable**: Changes to one environment don't break the other
4. **Automated**: The correct version is automatically selected at build time
5. **Manual Override**: Developers can manually switch for testing

## Possible Solutions Going Forward

1. **Maintain separate branches** for Nextron and web builds
2. **Use a build script** that conditionally includes/excludes CSS imports based on target 
3. **Create a custom Next.js plugin** that handles CSS differently for each environment
4. **Downgrade Next.js** to a version where the CSS loader works properly
5. **Wait for a fix** from the Next.js team for the blocklist issue

## Final Note on Next.js 14.2.26

This issue appears to be specific to Next.js 14.2.26 and its CSS loader implementation. Potential long-term solutions include:

1. Downgrading to an earlier Next.js version
2. Waiting for a fix from the Next.js team
3. Using a CSS-in-JS solution that doesn't rely on the CSS loader

## Reference

- [Next.js Global CSS docs](https://nextjs.org/docs/basic-features/built-in-css-support#adding-a-global-stylesheet)
- [CSS Modules in Next.js](https://nextjs.org/docs/basic-features/built-in-css-support#adding-component-level-css)
- [Electron with Next.js](https://github.com/vercel/next.js/tree/canary/examples/with-electron)
