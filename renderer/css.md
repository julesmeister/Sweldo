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

After trying several approaches, we've implemented a solution that works in both environments:

### For Nextron (Electron)
- Standard CSS imports continue to work normally
- CSS files are loaded directly through Next.js bundler
- All existing CSS functionality is preserved

### For Web Mode
- Completely bypasses the problematic CSS loader
- Uses a combination of:
  1. Inline critical CSS in `_document.js`
  2. Runtime style injection via `styleInjector.js`
  3. CDN-based Tailwind CSS

### Key Implementation Files

1. **renderer/pages/_document.js**
   - Provides critical inline styles for immediate rendering
   - Includes font declarations and minimal reset CSS

2. **renderer/utils/styleInjector.js**
   - Injects additional styles at runtime
   - Handles font declarations, base styles, and CSS variables
   - Loads Tailwind CSS from CDN

3. **renderer/pages/_app.tsx**
   - Conditionally imports CSS based on environment
   - For Nextron: Uses normal CSS imports
   - For Web: Uses JS-based style injection

## Issue History: Next.js CSS Loader Problem

We encountered a consistent error in web mode:

```
TypeError: Cannot read properties of undefined (reading 'blocklist')
```

This error occurred in Next.js 14.2.26's CSS loader when processing CSS files in web mode.

### Approaches Tried (Failed)

1. **Moving CSS files between directories**
   - Tried placing CSS in different locations
   - Adjusting import paths
   - Result: Same error persisted

2. **CSS Modules**
   - Tried using CSS modules instead of regular CSS
   - Result: Same error occurred

3. **Webpack Configuration**
   - Implemented environment-specific webpack config
   - Added CSS aliases and fallbacks
   - Result: Same error persisted

4. **CSS Consolidation**
   - Consolidated all styles into a single globals.css
   - Result: Still encountered the blocklist error

5. **Empty CSS Placeholders**
   - Created empty.css to serve as placeholders
   - Redirected imports via webpack aliases
   - Result: Error persisted with internal CSS files

6. **Next.js Downgrade**
   - Considered downgrading Next.js to a stable version
   - Not pursued as it wasn't an option for the project

### Root Cause Analysis

The error was determined to be a bug in Next.js 14.2.26's CSS loader implementation. The 'blocklist' property is undefined in this version, causing the error regardless of CSS import structure.

## Current Working Configuration

### Directory Structure
```
/resources/
  ├── fonts.css        - Global font definitions
  ├── globals.css      - Global styles
  └── Pacifico.ttf     - Font file

/renderer/
  ├── resources/       - Copied resources for web mode
  │   ├── fonts.css
  │   ├── globals.css
  │   └── Pacifico.ttf
  ├── public/fonts/    - Font files accessible via URL in web mode
  │   └── Pacifico.ttf
  ├── styles/
  │   └── globals.css  - Main global styles for Nextron
  ├── utils/
  │   └── styleInjector.js - Runtime style injection for web mode
  └── pages/
      ├── _app.tsx     - Conditional style loading
      └── _document.js - Critical inline styles
```

### Package.json Scripts
```json
"scripts": {
  "dev": "nextron",
  "setup:web": "if not exist renderer\\resources mkdir renderer\\resources && copy resources\\*.css renderer\\resources\\ && copy resources\\*.ttf renderer\\resources\\ && if not exist renderer\\public\\fonts mkdir renderer\\public\\fonts && copy resources\\*.ttf renderer\\public\\fonts\\",
  "dev:web": "npm run setup:web && cd renderer && next dev",
  "build": "nextron build",
  "build:win32": "nextron build --win --ia32",
  "build:web": "npm run setup:web && cd renderer && next build",
  "postinstall": "npx electron-builder install-app-deps"
}
```

## Benefits of Current Solution

1. **Environment Independence**
   - Nextron continues to work with normal CSS imports
   - Web mode completely bypasses the CSS loader
   - No changes to component code needed

2. **Resilience**
   - Even if the CSS loader fails, the app will still have styles
   - Critical styles load early via _document.js
   - Full styles load via JavaScript

3. **Maintainability**
   - Single source of truth for styles
   - Easy to update in both environments
   - Minimal changes to existing architecture

## Reference

- [Next.js Global CSS docs](https://nextjs.org/docs/basic-features/built-in-css-support#adding-a-global-stylesheet)
- [CSS Modules in Next.js](https://nextjs.org/docs/basic-features/built-in-css-support#adding-component-level-css)
