# Active Context - Sweldo

## Current Work Focus
The project is currently focused on enabling a web deployment of the Sweldo application via Firebase Hosting, in addition to the existing desktop application.

## Recent Changes
- Firebase Hosting has been initialized
- Configuration for Firebase hosting has been set up
- `firebase.json` has been configured to use `app` as the public directory
- Proper ignores for Electron-specific directories have been added to `firebase.json`
- Hosting rewrites for SPA support have been configured
- `renderer/next.config.js` has been configured for static export (`output: 'export'`)
- A web build script (`build:web`) has been added to package.json
- PostCSS configuration has been fixed for both Nextron and web builds
- Web build process has been successfully tested

## Next Steps
1. Handle conditional imports/code for Electron-specific functionality
   - Identify all uses of `window.electron` API
   - Create alternative implementations for web deployment
   - Implement conditional logic to use appropriate APIs based on environment

2. Deploy to Firebase hosting (`firebase deploy --only hosting`)
   - Ensure all web-compatible code is in place
   - Run final web build
   - Execute deployment command

3. Address potential web/desktop layout differences
   - Review all pages for centering issues
   - Apply the `min-h-screen` fix where needed for proper vertical centering in web mode

## Active Decisions and Considerations
- **Data Storage Strategy**: Determining the best approach for replacing local file system storage with Firestore for web deployment
- **PDF Generation**: Finding a client-side or cloud function alternative for PDF generation that currently relies on Electron's Node.js environment
- **Environment Detection**: Implementing reliable detection logic to determine whether the application is running in Electron or web environment
- **Feature Parity**: Ensuring core features work consistently across both desktop and web versions
- **Code Organization**: Maintaining a clean separation between platform-agnostic and platform-specific code
- **Build Process**: Refining the separate build processes for web (`build:web`) and desktop (`build`) versions 