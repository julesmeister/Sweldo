# System Patterns - Sweldo

## System Architecture
Sweldo follows a dual-process architecture typical of Electron applications:

1. **Main Process (Node.js Environment)**:
   - Application lifecycle management
   - Window creation and management
   - Native OS interactions
   - Backend-like services (PDF generation, file system operations)
   - IPC handler registration

2. **Renderer Process (Browser-like Environment)**:
   - Next.js React application
   - User interface components
   - Application state management
   - Business logic implementation

3. **IPC Communication Bridge**:
   - Allows the renderer process to request privileged operations from the main process
   - Exposes a secure API via the preload script as `window.electron`

## Key Technical Decisions
- **Nextron Framework**: Chosen to combine Next.js for UI development with Electron for desktop capabilities
- **Local File Storage**: Using the file system for data persistence (in `SweldoDB/` directory)
- **Zustand State Management**: For simpler, more flexible state management compared to Redux
- **Tailwind CSS**: For rapid UI development with utility-first approach
- **TypeScript**: For type safety and improved development experience
- **shadcn/ui Components**: For consistent, accessible UI components

## Design Patterns in Use
1. **Process Isolation Pattern**:
   - Separation of main and renderer processes
   - Communication via IPC for security and stability

2. **State Management Pattern**:
   - Zustand stores for application state
   - Model-based data structures

3. **Component-Based UI Architecture**:
   - Reusable React components
   - Composition over inheritance

4. **Service Pattern**:
   - Specialized services for PDF generation
   - Utility functions organized by domain

5. **Bridge Pattern**:
   - Preload script bridging Electron APIs to renderer
   - `window.electron` as the abstraction layer

6. **Dexie-based IndexedDB Caching Pattern**:
   - On load functions (e.g., `loadActiveEmployeesFirestore`), first check local cache stored in IndexedDB via Dexie
   - If cache hit, return cached data immediately
   - If cache miss, query Firestore, then bulk store results in Dexie cache
   - Provide manual cache invalidation (e.g., refresh button triggering `clearEmployeeCache`) and optional TTL logic
   - Apply same pattern to other models: `loadHolidaysFirestore`, `getMissingTimeLogsFirestore`, etc., using separate Dexie tables and `clearXCache` utilities

7. **CSS Architecture Pattern**:
   - **Core Structure**:
     - Tailwind CSS (v3) as the primary styling framework
     - PostCSS configuration at project root pointing to renderer-specific Tailwind config
     - `globals.css` with Tailwind directives and custom utilities
     - CSS variables for theming in both light and dark modes using oklch color format
     - Component-specific animations and keyframes
   
   - **Loading Mechanisms**:
     - Standard CSS imports in Nextron/desktop mode 
     - Runtime style injection for web mode using `styleInjector.js`
     - Early font loading via `_document.js` to prevent FOUC (Flash of Unstyled Content)
     - Critical styles embedded directly in HTML head
   
   - **Style Organization**:
     - Layer-based organization using Tailwind's `@layer` directive
     - Custom component classes defined in the components layer
     - Utility extensions in the utilities layer
     - Base styles in the base layer including CSS variables
   
   - **Custom Styling Solutions**:
     - Scrollbar customization with progressive enhancement
     - Animation keyframes for UI microinteractions (pulse, shine, blob, firework)
     - Semantic theming using CSS variables
     - Border radius inheritance utilities

8. **Environment-Aware Styling Pattern**:
   - Detection of runtime environment (web vs desktop) via `isWebEnvironment()`
   - Environment-specific style loading strategies
   - Conditional font and style injection in web mode
   - Different DOM manipulation approaches based on environment

9. **Self-contained Component Pattern**:
   - Components manage their own data loading rather than requiring all data from parents
   - Environment-aware data fetching from either local file system or Firestore
   - Graceful loading and error states handled internally
   - Optional props to override internal data when needed
   - Example: EmployeeDropdown manages its own employee data loading

## Component Relationships
- **Page Components** → Use → **UI Components**
- **Page Components** → Use → **Hooks** → Use → **Stores**
- **Stores** → Use → **Models** and **Utils**
- **UI Components** → Use → `window.electron` → Triggers → **IPC Handlers** → Execute → **Services**
- **Services** (in main process) → Use → **Node.js APIs** (fs, path, etc.)

## Special Considerations
- Adaptations needed for web deployment (replacing Electron-specific code)
- PostCSS and Tailwind configuration requirements
- Conditional code for platform-specific features 