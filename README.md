# Sweldo - Desktop Payroll Application (Nextron Version)

This README documents the structure, setup, build process, and key desktop-specific components for the **desktop version** of the Sweldo payroll application, built using Nextron (Next.js + Electron). Understanding these components is crucial for maintaining the desktop application and differentiating it from potential future web deployments.

## Technology Stack

*   **Framework:** [Nextron](https://github.com/saltyshiomix/nextron) (Integrates Next.js with Electron)
*   **UI Library:** [React](https://reactjs.org/)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Desktop Wrapper:** [Electron](https://www.electronjs.org/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **State Management:** [Zustand](https://github.com/pmndrs/zustand)
*   **UI Components:** [shadcn/ui](https://ui.shadcn.com/) (likely, based on project structure)

## Project Structure Overview

Nextron enforces a separation between the Electron main process (Node.js environment) and the Next.js renderer process (browser-like environment):

*   `main/`: **(Electron Specific)** Contains the Electron main process code.
    *   `background.ts`: The main entry point for Electron. Handles application lifecycle events (startup, quit), window creation, and registers core IPC handlers.
    *   `preload.ts`: A script that runs before the web page (renderer) is loaded in the BrowserWindow. It acts as a secure bridge, exposing specific Node.js/Electron functionalities (like IPC or file system wrappers) to the renderer process via the `window.electron` object.
    *   `services/`: (Example, location may vary) Contains backend logic specific to the main process, like PDF generation (`pdfGenerator.ts`, `schedulePdfGenerator.ts`), often invoked via IPC handlers.
*   `renderer/`: Contains the standard Next.js application code (React UI and logic).
    *   `pages/`: Next.js page routes.
    *   `components/`: Reusable React UI components.
    *   `model/`: Data models (e.g., `Employee`, `Attendance`, `Compensation`). **Largely reusable for web.**
    *   `stores/`: Zustand state management stores. **Largely reusable for web.**
    *   `hooks/`: Custom React hooks. **Largely reusable for web.**
    *   `lib/`: General utility functions (e.g., `encryption`, `colorUtils`). May contain desktop-specific (`electronUtils`) and reusable parts.
    *   `utils/`: Domain-specific utility functions (e.g., `timeProcessor`). **Largely reusable for web.**
*   `public/`: Static assets served by Next.js.
*   `electron/`: (Based on attached `main.ts`) May contain additional Electron main process code or services, potentially imported by `main/background.ts`. Contains IPC handlers like PDF generation.
*   `SweldoDB/`: **(Runtime, Desktop Specific)** Root directory for local data storage, created and managed via Electron APIs.

## Desktop-Specific Mechanisms & Code

These elements are fundamental to the desktop application and **will require replacement or alternative implementations** for a web deployment:

1.  **Electron Main Process (`main/` & `electron/` directories):** All code within these directories runs in a Node.js environment provided by Electron. This includes window management, native OS interactions, and backend-like services (e.g., PDF generation using Node libraries).

2.  **IPC Communication (Inter-Process Communication):**
    *   **Mechanism:** Electron uses `ipcMain` (in `main/background.ts`, `electron/main.ts`, etc.) and `ipcRenderer` (typically abstracted via `preload.ts` and `window.electron`) to allow the UI (renderer) to request actions from the main process.
    *   **Handlers:** Specific handlers are defined in the main process code (like `generate-payroll-pdf`, `generate-schedule-pdf` found in `electron/main.ts`) to execute privileged operations (like file system access or complex computations) on behalf of the renderer.

3.  **`window.electron` API (via `main/preload.ts`):**
    *   **Role:** This is the custom API exposed *exclusively* to the renderer process in the Electron environment. It provides access to the functionalities bridged from the main process.
    *   **Functionality:** Includes wrappers for file system operations (`readFile`, `writeFile`, `ensureDir`, `fileExists`, etc.) and triggers for IPC handlers.
    *   **Web Conflict:** This object **will not exist** in a standard web browser environment. Any code relying on `window.electron` must be conditionally executed or replaced for web deployment (e.g., using Firestore API instead of file system calls).

4.  **Local File System Storage (`SweldoDB/`):**
    *   The entire data persistence mechanism relies on Node.js `fs` module access, facilitated through the `window.electron` API.
    *   This needs to be replaced with a cloud-based solution (like Firestore) for web deployment.

5.  **Electron/Nextron Dependencies:**
    *   `electron`
    *   `electron-builder` (for packaging)
    *   `nextron`
    *   These are typically `devDependencies` and are not needed for a standard Next.js web build.

6.  **Configuration Files:**
    *   `nextron.config.js`: (If exists) Configuration specific to the Nextron build process.
    *   `package.json` (`build` section): Contains configuration for `electron-builder` defining how the desktop application is packaged (icons, installers, signing, etc.).
    *   `electron-builder.yml`: (Optional) More detailed configuration for `electron-builder`.

## Development Setup

(Prerequisites: Node.js, npm/yarn)

1.  `npm install` or `yarn install`
2.  `npm run dev` or `yarn dev` (Starts Electron + Next.js Dev Server)

## Building & Packaging (Desktop Only)

1.  **Build:** `npm run build` or `yarn build` (Compiles main/renderer code)
2.  **Package:** `npm run dist` or `yarn dist` (Uses electron-builder to create installers in `dist/`)

## Summary for Web Deployment Consideration

When planning a web deployment (e.g., Firebase Hosting):

*   **Keep:** Most code within `renderer/` (Pages, Components, Stores, Models, Hooks, non-Electron specific Libs/Utils).
*   **Replace/Refactor:**
    *   All interactions with `window.electron` (use alternative APIs like Firebase SDK).
    *   Data models/services need conditional logic or separate implementations for web data storage (Firestore) vs. local files.
    *   Features relying on main process IPC handlers (e.g., PDF generation) need client-side or cloud function alternatives.
*   **Remove/Ignore:** `main/` directory, `electron/` directory, Electron-specific dependencies, Electron build/packaging configurations.

This detailed breakdown should help clarify the desktop-specific architecture and identify areas needing attention for future web adaptation.
