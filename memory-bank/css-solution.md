# Tailwind CSS Implementation in Sweldo - Solved for Web Mode

## Overview of the Corrected CSS Strategy for Web Mode

The primary challenge was ensuring Tailwind CSS, with all its utilities and custom configurations, was fully applied in the web mode deployment, consistent with the desktop (Nextron) mode. The original issue stemmed from an incomplete `tailwind-web.css` file being used in web builds, leading to a "bare" UI.

The **successful solution** revolves around a dedicated build step that generates a complete `tailwind-web.css` file. This file is then linked by the web application at runtime.

### Core Components of the Solution:

1.  **`renderer/scripts/generate-tailwind.js` (NEW & CRITICAL):**
    *   A Node.js script added to the project.
    *   Uses `postcss`, `tailwindcss`, and `autoprefixer` programmatically.
    *   Reads `renderer/styles/globals.css` (which contains `@tailwind base/components/utilities` and custom styles).
    *   Processes it using the project's `renderer/tailwind.config.js` for all Tailwind configurations (content paths, theme, plugins, safelist).
    *   Outputs a single, comprehensive `tailwind-web.css` file to `renderer/public/styles/tailwind-web.css`.
    *   This script is invoked via an npm script `generate:tailwind`.

2.  **`package.json` Build Script (`build:web`):
    *   Modified to include `npm run generate:tailwind` as a step *before* `next build`.
    *   This ensures `renderer/public/styles/tailwind-web.css` is generated with the latest styles before Next.js packages public assets.
    *   A subsequent step in `build:web` copies this generated `tailwind-web.css` to the final deployment directory (e.g., `app/static/css/`) for Firebase Hosting.

3.  **`renderer/utils/styleInjector.js` (Role Clarified):
    *   Its primary role in the corrected setup is to **link the generated `tailwind-web.css`** file into the document head at runtime for web mode.
    *   It also continues to inject other minimal, critical styles: explicitly defined base styles, CSS variables for theming, font-face declarations, and specific component styles that are *not* part of the main Tailwind flow (e.g., some MagicUI critical styles, or styles prepared by `sync-styles.js`).

4.  **`renderer/scripts/sync-styles.js` (Supplementary Role):
    *   This script's role is now clearly supplementary.
    *   It extracts specific, manually-defined CSS sections from `globals.css` (those *not* using Tailwind directives like `@apply` or `@layer`) to be injected by `styleInjector.js`.
    *   These are for minor overrides or very specific style blocks that need to be injected directly, separate from the main Tailwind build.

5.  **`renderer/tailwind.config.js` and `postcss.config.js`:**
    *   These configurations are now correctly utilized by `generate-tailwind.js` to produce the complete `tailwind-web.css`.
    *   Pathing for `content` in `tailwind.config.js` is crucial and should be relative to the `renderer` directory (e.g., `./pages/**/*.tsx`).

## Why This Works and Previous Issues

-   **Previous Problem:** The `build:web` process was *copying* a potentially stale or incomplete `tailwind-web.css` file, or the file was not being generated with all necessary Tailwind utilities. The `sync-styles.js` script, by design, skipped Tailwind directives, so it couldn't compensate for an incomplete main Tailwind file.
-   **Current Solution:** By explicitly generating `tailwind-web.css` from source (`globals.css` + `tailwind.config.js`) using the full PostCSS/Tailwind toolchain during the build, we ensure all Tailwind base styles, components, utilities, and project-specific customizations are included. This generated file is then the single source of truth for Tailwind styling in web mode.

## Key Files in the Corrected Architecture

-   **Input for Web CSS Generation:**
    -   `renderer/styles/globals.css`: Contains `@tailwind` directives and all custom CSS.
    -   `renderer/tailwind.config.js`: Configures Tailwind (content paths, theme, plugins).
    -   `postcss.config.js` (project root): Configures PostCSS, primarily for Tailwind and Autoprefixer.
-   **Generation Script:**
    -   `renderer/scripts/generate-tailwind.js`: Orchestrates the PostCSS/Tailwind processing.
-   **Generated Asset (Primary Web Styles):**
    -   `renderer/public/styles/tailwind-web.css`: The complete, processed CSS file. This is copied to the final deployment asset folder (e.g., `app/static/css/`).
-   **Runtime Injection/Linking (Web Mode):**
    -   `renderer/utils/styleInjector.js`: Links `tailwind-web.css` and injects other minimal/supplementary styles.
-   **Supplementary Style Syncing:**
    -   `renderer/scripts/sync-styles.js`: Extracts specific non-directive CSS blocks from `globals.css` for `styleInjector.js`.

This corrected architecture ensures that the web deployment benefits from the full power and configuration of Tailwind CSS, consistent with the desktop environment, resolving previous UI inconsistencies.

## Current Architecture

The project uses a hybrid CSS approach with Tailwind CSS as the primary styling framework, combined with custom CSS and a style injection mechanism for web mode.

### Key Components

1. **Tailwind CSS Configuration**
   - Located at `renderer/tailwind.config.js`
   - Uses Tailwind v3 with extensive color palette customization
   - Includes a large safelist of utility classes to prevent purging of dynamically used classes
   - Custom theme extensions for animations, keyframes, and color variables
   - Uses CSS variables for theming support (light/dark mode)
   - Includes the `tailwindcss-animate` plugin

2. **Global CSS (`renderer/styles/globals.css`)**
   - Imports Tailwind's base, components, and utilities layers
   - Defines font face declarations (Pacifico font)
   - Contains CSS variables for theming
   - Includes dark mode theme variables
   - Contains custom components and utilities using Tailwind's `@layer` directive
   - Custom scrollbar styling
   - Animation keyframes for various UI effects (fireworks, blobs, pulse, shine)

3. **Web Mode Style Injection (`renderer/utils/styleInjector.js`)**
   - Runtime CSS injection for web environment only
   - Injects base styles with CSS variables for theming
   - Adds critical utility classes as inline styles
   - Includes component-specific styles (DatePicker, MagicUI, scrollbars)

4. **Style Synchronization System**
   - Script at `renderer/scripts/sync-styles.js`
   - Automatically extracts styles from globals.css and injects them into styleInjector.js
   - Intelligently handles CSS selector deduplication to prevent duplicate styles
   - Skips problematic selectors like Tailwind directives (@apply, @layer)
   - Adds !important flags to ensure styles take precedence in web mode
   - Organized into named sections with start/end markers
   - Integrated into the web build process via npm scripts

5. **Document Head Styling (`renderer/pages/_document.js`)**
   - Provides critical styles in the document head
   - Includes font declarations and minimal reset
   - Prevents flash of unstyled content (FOUC)
   - Works in both Nextron and web environments

6. **Styling Structure**
   - `renderer/styles/` - Main styles directory
   - `renderer/styles-actual/` - Backup/alternative styles
   - `renderer/styles/fonts.css` and `fonts.module.css` - Font-specific styling
   - `renderer/styles/injectFonts.js` - Font injection utility
   - `renderer/scripts/sync-styles.js` - Style synchronization script

## Environment-Specific Implementation

### Nextron (Desktop) Mode
- Uses standard Next.js CSS loading
- Imports globals.css directly
- Full access to all Tailwind classes
- No CSS injection needed

### Web Mode
- Uses style injection to bypass Next.js CSS loading issues
- Loads Tailwind CSS dynamically
- Injects critical styles inline via styleInjector.js
- Uses font loading optimization
- Now uses sync-styles.js to ensure consistency with globals.css

## CSS Synchronization System

The project implements a sophisticated CSS synchronization system to maintain styling consistency between desktop and web modes:

1. **Automated Extraction**
   - Script extracts specific sections from globals.css using marker comments
   - Currently extracts timesheet-table styles and rounded-corners styles
   - Skips Tailwind directives and other problematic selectors

2. **Intelligent Deduplication**
   - Parses CSS into rule blocks (from { to })
   - Extracts selector names and checks if they already exist in styleInjector.js
   - Only adds selectors that don't already exist
   - Prevents duplicate rules while ensuring style consistency

3. **Format Transformation**
   - Adds !important flags to CSS properties to ensure they take precedence
   - Preserves existing !important flags
   - Maintains CSS rule structure and nesting

4. **Section Management**
   - Uses special comment markers to define sections in styleInjector.js
   - Replaces existing sections or adds new ones as needed
   - Clearly labels auto-generated sections for easy identification

5. **Build Process Integration**
   - Integrated into web build process via npm scripts
   - Runs before both development and production builds
   - Custom npm script (sync:styles) for manual synchronization

## Custom UI Patterns

1. **Custom Scrollbars**
   - Thin scrollbars with hover effects
   - Multiple scrollbar variants (y-hidden, custom-scrollbar, scrollbar-thin)
   - Cross-browser compatibility (WebKit, Firefox)

2. **Animation Effects**
   - Shine animations for UI accents
   - Firework animation for celebrations
   - Blob animations for organic UI elements
   - Pulse animations for attention-grabbing elements

3. **Theme Variables**
   - Comprehensive set of CSS variables for consistent theming
   - Dark mode support with separate variable sets
   - Color tokens for semantic UI elements (primary, secondary, destructive, etc.)

4. **Component-Specific Styling**
   - DatePicker custom styling
   - MagicUI integration
   - Form element styling (select dropdowns, inputs)
   - Timesheet table with consistent borders and cell styling

## Technical Implementation Details

1. **PostCSS Configuration**
   - Uses PostCSS with Tailwind and autoprefixer
   - Config at project root (`postcss.config.js`)
   - Points to renderer-specific Tailwind config

2. **Safelist Strategy**
   - Extensive safelist in Tailwind config to preserve dynamically used classes
   - Ensures color variants and opacity modifiers are preserved

3. **Border Radius Inheritance**
   - Special handling for border-radius inheritance in nested components
   - Custom utility class `.rounded-inherit`

4. **Theme Token System**
   - Uses oklch color format for modern color representation
   - Semantic color variables (primary, secondary, accent, etc.)
   - Separate variables for sidebar theming

## Specific Component Styling Solutions

1. **Timesheet Table**
   - Fixed inconsistent borders between desktop and web modes
   - Added consistent border styling with proper cell borders
   - Ensured sticky day column works in both environments
   - Fixed z-index issues with sticky headers

2. **CompensationDialog**
   - Improved form layout with better spacing
   - Fixed input field heights for consistency
   - Enhanced grid layout with appropriate gaps
   - Addressed alignment issues in different environments

## Environment-Specific Issues

Despite having styles working in both environments, there are some design differences between web mode and Nextron mode:

1. **Layout Differences**
   - Some components don't maintain identical spacing/layout in web mode
   - Grid layouts may render differently between environments

2. **Component-Specific Styling**
   - Custom components may have visual differences
   - Certain UI elements may have different appearance or positioning

3. **Style Loading Sequence**
   - Web mode injects styles at runtime which can cause momentary FOUC
   - Nextron mode loads styles more predictably

## Future Improvements

1. **Enhanced Synchronization Logic**
   - Add support for more complex CSS selectors and nested rules
   - Improve extraction of specific component styles
   - Better handling of media queries and responsive styles

2. **Optimization Opportunities**
   - Reduce safelist size by better tracking dynamic class usage
   - Implement proper tree-shaking for unused styles
   - Consider using Tailwind JIT mode for faster builds

3. **Theme System Enhancement**
   - Implement a more robust theme switching mechanism
   - Add support for custom user themes
   - Better documentation of theme variables

4. **Responsive Design Consistency**
   - Ensure consistent responsive behavior across environments
   - Document breakpoint strategies for components 

## Component-Specific CSS Solutions

### React-Date-Range CSS Loading Issue

We encountered a critical CSS loading issue with the `react-date-range` library when running in web mode. The issue manifested as:

```
TypeError: Cannot read properties of undefined (reading 'blocklist')
```

This error occurred in the Next.js CSS loader when trying to process the directly imported CSS files from react-date-range:

```typescript
// Direct CSS imports that fail in web mode
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
```

#### Solution Approach

We developed a comprehensive solution that allows the DateRangePicker component to work in both Nextron (desktop) and web modes:

1. **Environment-Based Conditional Imports**:
   - In Nextron mode: Use direct imports via `require()`
   - In web mode: Dynamically inject CSS at runtime using fetch and style tags

2. **Mock Implementation for Web Mode**:
   - Created a simplified DateRange component implementation in `mockModules.tsx`
   - This mock version has similar functionality but doesn't rely on the problematic CSS imports
   - Used dynamic module loading to avoid webpack processing the problematic imports

3. **Component Implementation Strategy**:
   - Modified `DateRangePicker.tsx` to dynamically load the appropriate implementation
   - Used a portal-based approach for consistent rendering across environments
   - Maintained visual consistency between implementations

#### Implementation Details

1. **CSS Injection in Web Mode**:
```typescript
// Dynamically load styles in web mode
useEffect(() => {
  if (isWebEnvironment() && typeof document !== "undefined") {
    const injectDateRangeStyles = async () => {
      try {
        // Fetch CSS content from CDN
        const stylesResponse = await fetch("https://cdn.jsdelivr.net/npm/react-date-range@1.4.0/dist/styles.css");
        const themeResponse = await fetch("https://cdn.jsdelivr.net/npm/react-date-range@1.4.0/dist/theme/default.css");
        
        if (stylesResponse.ok && themeResponse.ok) {
          const stylesCSS = await stylesResponse.text();
          const themeCSS = await themeResponse.text();
          
          // Inject as style tags
          if (!document.getElementById("react-date-range-styles")) {
            const stylesTag = document.createElement("style");
            stylesTag.id = "react-date-range-styles";
            stylesTag.innerHTML = stylesCSS;
            document.head.appendChild(stylesTag);
          }
          
          if (!document.getElementById("react-date-range-theme")) {
            const themeTag = document.createElement("style");
            themeTag.id = "react-date-range-theme";
            themeTag.innerHTML = themeCSS;
            document.head.appendChild(themeTag);
          }
        }
      } catch (error) {
        console.error("Failed to load DateRange CSS:", error);
      }
    };
    
    injectDateRangeStyles();
  }
}, []);
```

2. **Component Loading Strategy**:
```typescript
// Import the DateRange component dynamically
import type { Range, RangeKeyDict, DateRange as DateRangeType } from "react-date-range";
// Use dynamic imports in web mode to avoid CSS issues
let DateRange: React.ComponentType<any>;

// Import styles directly only in Nextron mode
if (!isWebEnvironment()) {
  // In Nextron mode, we can import CSS directly
  require("react-date-range/dist/styles.css");
  require("react-date-range/dist/theme/default.css");
  // Import the real component directly
  const reactDateRange = require("react-date-range");
  DateRange = reactDateRange.DateRange;
}
```

3. **Mock Implementation in mockModules.tsx**:
```typescript
// Simple date range implementation for web mode
const SimpleDateRange: React.FC<SimpleDateRangeProps> = ({
  ranges,
  onChange,
  months = 1,
  direction = 'horizontal',
  ...props
}) => {
  // Simplified implementation that works without the problematic CSS
  // ...
};

export const getReactDateRange = () => {
  // For web mode, use the simple implementation to avoid CSS issues
  if (isWebEnvironment()) {
    return {
      DateRange: SimpleDateRange,
    };
  }

  // For Nextron mode, dynamically load the real component at runtime
  if (!isWebEnvironment() && typeof window !== "undefined") {
    // Dynamic loading logic
    // ...
  }

  // Default fallback for server-side rendering
  return {
    DateRange: SimpleDateRange,
  };
};
```

#### Key Lessons

1. **Next.js CSS Import Limitations**:
   - Next.js has strict constraints on CSS imports, particularly for third-party libraries
   - Global CSS can only be imported in `_app.tsx`
   - Direct CSS imports in components can cause build failures in web mode

2. **Runtime CSS Injection**:
   - Fetching and injecting CSS at runtime is an effective workaround
   - Using CDN links ensures consistent versioning
   - Style tags with unique IDs prevent duplicate injections

3. **Environment-Specific Code**:
   - Conditional imports based on environment are essential
   - Type imports help maintain TypeScript compatibility while avoiding actual imports
   - Using `require()` instead of `import` can bypass webpack's static analysis

4. **Dynamic Component Loading**:
   - Using dynamic imports with `import()` helps avoid webpack processing problematic modules
   - Caching loaded modules prevents redundant loading
   - Providing fallbacks ensures the application works even if dynamic loading fails

5. **Mock Implementations**:
   - Creating simplified versions of complex components for web mode
   - Focusing on core functionality while avoiding problematic dependencies
   - Using the same props interface for seamless integration

This approach ensures that the DateRangePicker component works consistently in both Nextron and web environments while avoiding the CSS loading issues that would otherwise break the web build. 

#### Enhanced Solution: Proxy Component with Dynamic Imports

After encountering persistent issues with CSS imports being processed during the build phase even with conditional imports, we implemented a more comprehensive solution:

1. **Proxy Component Pattern**:
   - Created a `DateRangePickerProxy` component that dynamically loads the actual `DateRangePicker` component at runtime
   - The proxy has an identical API but doesn't import any CSS files
   - Displays a placeholder UI while the actual component is loading

2. **Complete Separation of CSS Imports**:
   - Removed ALL direct CSS imports from the component file
   - Even conditional imports using `if (!isWebEnvironment())` were problematic as Next.js statically analyzes them
   - Used dynamic `import()` at runtime to load the component after the build process is complete

3. **Runtime Component Loading**:
   - Added code to load the actual component only on the client side:
   ```typescript
   useEffect(() => {
     const loadComponent = async () => {
       try {
         // Dynamic import to avoid CSS bundling during build
         const module = await import('./DateRangePicker');
         setActualComponent(() => module.DateRangePicker);
       } catch (error) {
         console.error('Failed to load DateRangePicker component:', error);
       }
     };
     loadComponent();
   }, []);
   ```

4. **Component Usage Pattern**:
   - Modified all component imports to use the proxy version:
   ```typescript
   // Before: Problematic direct import
   import { DateRangePicker } from "@/renderer/components/DateRangePicker";
   
   // After: Safe proxy import
   import { DateRangePickerProxy } from "@/renderer/components/DateRangePickerProxy";
   ```

5. **Pure Runtime CSS Loading**:
   - For Nextron: Used dynamic `Function('return require("...")')()`
   - For Web: Used `fetch()` to load CSS from CDN and injected via style tags

#### Key Insights

1. **Next.js Static Analysis**:
   - Next.js statically analyzes imports during build time, even if they're behind conditional statements
   - This means that even `if (condition) { require('...') }` will be processed at build time
   - The only way to truly avoid CSS processing during build is to use dynamic imports or runtime loading

2. **The Proxy Pattern**:
   - The proxy component pattern provides a clean separation between the component API and its implementation
   - Allows for different implementations based on environment without changing the consumer code
   - Provides sensible fallbacks and loading states

3. **Build vs. Runtime Loading**:
   - Build-time CSS loading: Processed by Next.js CSS loaders, can cause build failures
   - Runtime CSS loading: Bypasses Next.js CSS processing, more reliable but may cause FOUC
   - For problematic libraries like react-date-range, runtime loading is the only viable option

4. **Complete Solution Stack**:
   - `DateRangePickerProxy.tsx`: Placeholder and dynamic loader
   - `DateRangePicker.tsx`: Actual implementation with no direct CSS imports
   - `mockModules.tsx`: Environment-specific implementations
   - Dynamic CSS loading for both environments

This approach completely bypasses Next.js CSS processing during build time, resolving the CSS loading issues while maintaining component functionality and visual consistency across environments. 

#### Error Handling in Mock Components

We encountered an issue with the mock implementation where the component was trying to destructure properties from a null parameter:

```
TypeError: Cannot destructure property 'ranges' of 'param' as it is null.
```

This occurred in our SimpleDateRange component within mockModules.tsx. The solution was to:

1. **Add Default Parameters**:
   - Added default empty array for the `ranges` parameter
   - Added default no-op function for the `onChange` handler
   ```typescript
   const SimpleDateRange: React.FC<SimpleDateRangeProps> = ({
     ranges = [],
     onChange = () => {},
     months = 1,
     direction = 'horizontal',
     ...props
   }) => {
   ```

2. **Add Defensive Coding**:
   - Added additional null/empty checks before accessing array properties
   - Created a default range to use when none is provided
   ```typescript
   const defaultRange = { startDate: new Date(), endDate: addMonths(new Date(), 1), key: 'selection' };
   const selectedRange = (ranges && ranges.length > 0) ? ranges[0] : defaultRange;
   ```

3. **Required Imports**:
   - Ensured all necessary functions (like `addMonths` from date-fns) are properly imported

This approach makes the mock component more resilient to unexpected prop values and prevents runtime errors when the component is used with incomplete or missing data. 

#### Component Rendering Issues and Solution

We encountered a critical error when trying to render the DateRangePicker component in web mode:

```
Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: object.
Check the render method of `DateRangePicker`.
```

This error occurred because:

1. **Component Type Issue**: When trying to use the dynamically loaded `DateRange` component, React was receiving an object instead of a component function.

2. **Component Export Issue**: The mock implementation in `getReactDateRange()` was not properly returning a React component function.

3. **JSX Element vs Component Function**: We were accidentally exporting/providing a JSX element (`<SimpleDateRange />`) instead of the component function itself.

#### Multi-part Solution

We implemented several fixes to address these issues:

1. **Proper Component Return**:
   - Modified `getReactDateRange()` to ensure it always returns an object with a properly defined function component
   - Explicitly defined named function components:
   ```typescript
   return {
     DateRange: function DateRangeComponent(props: any) {
       // Implementation
     }
   };
   ```

2. **Type Checking and Validation**:
   - Added explicit type checking to verify components are functions before using them:
   ```typescript
   if (typeof dateRangeModule.DateRange === 'function') {
     setDateRangeComponent(() => dateRangeModule.DateRange);
   } else {
     console.error('DateRange is not a valid component function');
   }
   ```

3. **Error Handling and Fallbacks**:
   - Added try/catch blocks around critical component rendering code
   - Created multiple levels of fallbacks in case primary component loading fails
   - Added defensive checks to prevent runtime errors:
   ```typescript
   try {
     // Ensure dateRangeComponent is a valid React component function
     const DateRangeComponent = dateRangeComponent;
     
     if (typeof DateRangeComponent !== 'function') {
       console.error('DateRange component is not a function:', DateRangeComponent);
       return null;
     }
     
     // Render component...
   } catch (error) {
     console.error('Error rendering DateRange component:', error);
     return null;
   }
   ```

4. **Proper Component Loading**:
   - Changed how we assign the component to state to ensure we preserve its function nature:
   ```typescript
   // Instead of directly setting the component
   setDateRangeComponent(dateRangeModule.DateRange); // Wrong

   // Wrap in a function to preserve the component function
   setDateRangeComponent(() => dateRangeModule.DateRange); // Correct
   ```

#### Key Insights

1. **React Component Requirements**:
   - React expects components to be functions or classes, not objects or JSX elements
   - When dynamically loading components, ensure you're getting actual component functions

2. **Proper Dynamic Component Loading**:
   - When loading components dynamically, always verify they're valid functions before rendering
   - Use try/catch and defensive programming to handle potential failures

3. **Function vs JSX Elements**:
   - A common mistake is returning/passing JSX elements instead of component functions
   - Always ensure you're passing the component function (e.g., `MyComponent`) not a rendered element (e.g., `<MyComponent />`)

4. **Debugging Dynamic Components**:
   - Use console logging to verify the type and structure of dynamically loaded components
   - Add explicit checks like `typeof component === 'function'` before attempting to render

This approach fixed the component rendering issues while maintaining the ability to dynamically load CSS and components at runtime. The solution works consistently in both web and Nextron environments. 

## CSS Pseudo-elements for UI Components

### Problem: Text Character Alignment Issues

When using text characters like × (times) for UI elements such as close or clear buttons, several issues can arise:

1. **Inconsistent Positioning**: Text characters often have inconsistent positioning across different browsers and fonts
2. **Line Height Challenges**: Setting line-height correctly for single characters is difficult
3. **Poor Contrast on Hover**: When changing background colors on hover, text may become difficult to see
4. **Font-Dependent Rendering**: The appearance may change based on font availability

This was evident in CompensationDialog's clear button, where the × character was not perfectly centered and had poor visibility when hovered.

### Solution: CSS Pseudo-elements

Instead of using text characters, we can create UI elements using CSS pseudo-elements (::before and ::after):

```css
.clear-button {
  position: absolute !important;
  /* Other positioning and sizing styles */
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  overflow: hidden !important;
}

.clear-button::before,
.clear-button::after {
  content: "" !important;
  position: absolute !important;
  width: 12px !important; /* Line width */
  height: 2px !important; /* Line thickness */
  background-color: currentColor !important;
  top: 50% !important;
  left: 50% !important;
}

.clear-button::before {
  transform: translate(-50%, -50%) rotate(45deg) !important;
}

.clear-button::after {
  transform: translate(-50%, -50%) rotate(-45deg) !important;
}
```

### Implementation Steps

1. **Remove Text Content**: Remove the text character from the HTML/JSX
2. **Create Lines with Pseudo-elements**: Use ::before and ::after to create two perpendicular lines
3. **Position Lines Precisely**: Use absolute positioning with transforms
4. **Use currentColor**: Ensures the icon inherits the button's text color
5. **Adjust Hover States**: Modify colors for better contrast on hover

### Advantages

1. **Perfect Centering**: Elements are precisely positioned using transforms
2. **Consistent Rendering**: Appearance is consistent across browsers and fonts
3. **Better Contrast Control**: Color inheritance works reliably 
4. **Size Control**: Icon size can be adjusted through CSS properties
5. **No Character Encoding Issues**: Avoids problems with character encoding
6. **Accessibility**: Improves accessibility by maintaining visibility

### Application

This approach was successfully implemented in the CompensationDialog component's clear buttons, replacing the problematic × character with perfectly centered, accessible cross icons. 