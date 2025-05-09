# Tailwind CSS Implementation in Sweldo

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