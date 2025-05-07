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