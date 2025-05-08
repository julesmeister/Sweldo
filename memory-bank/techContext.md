# Technical Context - Sweldo

## Technologies Used

### Core Framework & Runtime
- **Nextron**: Integration of Next.js with Electron
- **Next.js**: React framework for the UI
- **Electron**: Desktop application wrapper
- **Node.js**: JavaScript runtime (used in Electron main process)

### Frontend
- **React**: UI library
- **TypeScript**: Programming language
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Component library built on Radix UI
- **Zustand**: State management library
- **Dexie**: Wrapper for IndexedDB used for client-side caching of Firestore queries

### Backend (Electron Main Process)
- **Electron IPC**: Inter-process communication
- **Node.js fs module**: File system operations
- **PDF Generation**: Likely using libraries like PDFKit or jsPDF

### Development & Build Tools
- **electron-builder**: Packaging and distribution tool
- **PostCSS**: CSS processing tool
- **npm/yarn**: Package management

## Development Setup
1. Prerequisites:
   - Node.js
   - npm or yarn

2. Installation:
   ```
   npm install
   ```
   or
   ```
   yarn install
   ```

3. Development:
   ```
   npm run dev
   ```
   or
   ```
   yarn dev
   ```
   This starts Electron + Next.js Dev Server

## Building & Packaging

1. Build:
   ```
   npm run build
   ```
   or
   ```
   yarn build
   ```
   Compiles main/renderer code

2. Package:
   ```
   npm run dist
   ```
   or
   ```
   yarn dist
   ```
   Uses electron-builder to create installers in `dist/`

## Technical Constraints

### PostCSS and Tailwind CSS Configuration Issues
- Avoid creating custom `postcss.config.js` in root or renderer directory
- Be aware of plugin naming conflicts between versions
- Avoid multiple configuration files in both root and `renderer/` directories

### Web/Nextron Layout Differences
- Centered content may appear differently in web vs desktop modes
- Use `min-h-screen` for flex containers requiring vertical centering
- Careful consideration needed for responsive layouts that work in both environments

### Desktop-Specific Dependencies
- `electron`
- `electron-builder`
- `nextron`

### File System Access Limitations
- Web deployments cannot use Electron's file system access
- Need alternative storage solution (e.g., Firestore) for web version

## Project Directory Structure
- **`main/`**: Electron main process code (desktop-specific)
  - `background.ts`: Main entry point for Electron
  - `preload.ts`: Bridge between main and renderer
  - `services/`: Backend logic for main process

- **`renderer/`**: Next.js application code (partially reusable for web)
  - `pages/`: Next.js routes
  - `components/`: React UI components
  - `model/`: Data models
  - `stores/`: Zustand state stores
  - `hooks/`: Custom React hooks
  - `lib/`: General utilities
  - `utils/`: Domain-specific utilities

- **`public/`**: Static assets
- **`electron/`**: Additional Electron main process code
- **`SweldoDB/`**: Runtime directory for local data storage (desktop-specific)

## Configuration Files
- `nextron.config.js`: Nextron build configuration
- `package.json` (`build` section): electron-builder configuration
- `renderer/next.config.js`: Next.js configuration
- `renderer/tailwind.config.js`: Tailwind CSS configuration 

## CSS and Styling System

### Key Files and Directories
- **`renderer/styles/`**: Main directory for all CSS files
  - `globals.css`: Primary CSS file with Tailwind imports and custom styles
  - `fonts.css`: CSS for font declarations
  - `fonts.module.css`: CSS modules for font implementations
  - `injectFonts.js`: JavaScript utility to inject font styles in web mode
  - `empty.css`: Minimal CSS file for situations requiring a CSS import without styles

- **`renderer/styles-actual/`**: Backup/alternative styles directory
  - Contains a duplicate `globals.css` for testing/backup purposes

- **`renderer/utils/styleInjector.js`**: Runtime style injection mechanism
  - Dynamically injects styles when in web environment
  - Provides critical styles before Tailwind loads
  - Contains component-specific styles for DatePicker, MagicUI components
  - Implements custom scrollbar styling

### CSS Configuration
- **`postcss.config.js`**: Located in project root, configures PostCSS plugins
  - Points to the Tailwind config in the renderer directory (`./renderer/tailwind.config.js`)
  - Uses autoprefixer for cross-browser compatibility

- **`renderer/tailwind.config.js`**: Tailwind CSS configuration
  - Content paths define where to look for class usage (`./renderer/pages/**/*.{js,ts,jsx,tsx}`, `./renderer/components/**/*.{js,ts,jsx,tsx}`)
  - Extensive safelist with color variants to prevent class purging in production
  - Dark mode enabled using class strategy
  - Comprehensive color definitions including semantic theme variables
  - Custom animations and keyframes (accordion, shine)
  - Uses the tailwindcss-animate plugin

### Style Implementation Details

1. **Tailwind Structure**:
   - Follows standard Tailwind pattern with `@tailwind base`, `@tailwind components`, and `@tailwind utilities` directives in `globals.css`
   - Adds custom styles within Tailwind's layer system using `@layer` directives
   - Implements responsive utility classes that work across all device sizes

2. **Theme System**:
   - CSS variables defined in `:root` for light mode and `.dark` for dark mode
   - Uses oklch color format for modern color representation
   - Implements semantic color tokens:
     - `--background`, `--foreground`: Base page colors
     - `--primary`, `--secondary`, `--accent`: Brand and interaction colors
     - `--muted`, `--card`, `--popover`: Component background colors
     - `--destructive`, `--border`, `--input`: Functional UI colors
     - Additional variables for charts and sidebar components

3. **Custom UI Elements**:
   - Custom styled scrollbars with multiple variants:
     - `.scrollbar-thin`: Minimal scrollbar that appears on hover
     - `.scrollbar-y-none`: Shows only horizontal scrollbar
     - `.custom-scrollbar`: Consistently visible styled scrollbar
   - Animation system:
     - Keyframe animations: `@keyframes spark`, `@keyframes firework`, `@keyframes blob`, `@keyframes pulse`, `@keyframes shine`
     - Animation classes: `.animate-shine`, `.animate-blob`, `.animate-pulse`
     - Animation delay utilities: `.animation-delay-1000`, `.animation-delay-2000`, etc.

4. **Form Elements**:
   - Custom select styling with background image for dropdown arrow
   - Input and button base styling
   - Focus states and outline handling

### Environment-Specific Implementation

1. **Nextron (Desktop) Mode**:
   - Standard Next.js CSS processing with PostCSS and Tailwind
   - Direct import of `globals.css` in `_app.js`
   - Native font loading through standard CSS

2. **Web Mode**:
   - Runtime style injection through `styleInjector.js`
   - Creates multiple style elements in document head:
     - Font styles with `@font-face` declarations
     - Base styles with CSS variables and critical utilities
     - Additional component-specific styles
   - Early style embedding in `_document.js` to prevent FOUC

3. **Font Strategy**:
   - Custom font (Pacifico) loaded via multiple methods for redundancy:
     - CSS `@font-face` declaration in `globals.css`
     - Inline `@font-face` in `_document.js`
     - Dynamic injection via `styleInjector.js` in web mode
   - System font fallbacks defined for consistent appearance

### Build Process & Style Pipeline

1. **Development Flow**:
   - In dev mode, Tailwind is processed through JIT mode for fast compilation
   - PostCSS transforms `@tailwind` directives into appropriate CSS
   - Hot module reloading supports style changes

2. **Production Build**:
   - Tailwind processes and purges unused classes (except safelist items)
   - CSS is minified and optimized
   - Compiled CSS is included in the final build output

3. **Web Deployment Considerations**:
   - When building for web, ensure font assets are properly copied
   - Enable style injection for web environment
   - Ensure critical styles are loaded early to prevent layout shifts

### Best Practices for Styling

1. **Component Styling**:
   - Use Tailwind classes directly on elements when possible
   - For complex components, consider creating component classes using `@layer components`
   - Use CSS variables for dynamic values rather than hardcoded colors

2. **Responsive Design**:
   - Use Tailwind's responsive prefixes (sm:, md:, lg:, etc.)
   - Test layouts in both web and desktop environments
   - Consider minimum widths for desktop application

3. **Theme Integration**:
   - Use semantic color variables (`bg-primary`, `text-accent`) rather than specific colors
   - This ensures proper dark mode support and theme consistency

4. **Performance Optimization**:
   - Keep critical styles inline or early-loaded
   - Use proper content paths in Tailwind config
   - Avoid unnecessary large CSS libraries

### Notable Scripts in package.json
- **`setup:web`**: Copies font resources to appropriate directories for web deployment
- **`dev:web`**: Sets up web environment and runs Next.js in web mode
- **`build:web`**: Builds for web deployment with proper style resources 