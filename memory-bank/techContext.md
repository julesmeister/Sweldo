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