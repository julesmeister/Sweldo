/**
 * CSS-in-JS utility to inject styles at runtime for web mode
 * This bypasses the Next.js CSS loader issues entirely
 */
import { isWebEnvironment } from "@/renderer/lib/firestoreService";
import { injectInlinedStyles } from "./inlinedStyles";

export function injectStyles() {
  if (typeof document === "undefined") {
    return;
  }

  // Only inject if not already injected
  if (document.getElementById("injected-styles")) {
    return;
  }

  console.log(`Environment: ${isWebEnvironment() ? "Web" : "Electron"}`);

  try {
    // Always inject inlined styles first as the most reliable approach in both environments
    injectInlinedStyles();
    console.log("Base styles injected via inlinedStyles");

    if (!isWebEnvironment()) {
      // Additional Electron-specific styles
      if (window.electron) {
        console.log(
          "[Style Injector] In Electron environment, attempting to load CSS files..."
        );

        // DIRECT APPROACH: Immediately inject known paths for CSS - more reliable than IPC
        console.log(
          "[Style Injector] Applying direct CSS injection for production build"
        );

        // Try multiple direct paths to ensure CSS is loaded
        const directPaths = [
          "app://./app/static/css/tailwind-web.css",
          "app://./app/styles/tailwind-web.css",
          "app://./resources/css/tailwind-web.css",
          "app://./static/css/tailwind-web.css",
        ];

        directPaths.forEach((path, index) => {
          const directLink = document.createElement("link");
          directLink.rel = "stylesheet";
          directLink.href = path;
          directLink.id = `tailwind-css-direct-${index}`;
          document.head.appendChild(directLink);
          console.log(`[Style Injector] Added direct CSS link: ${path}`);

          // Add load listener to see which one actually loads
          directLink.addEventListener("load", () => {
            console.log(
              `[Style Injector] Successfully loaded CSS from direct path: ${path}`
            );
          });
        });

        // Also add direct paths for globals.css
        const globalsPaths = [
          "app://./app/static/css/globals.css",
          "app://./app/styles/globals.css",
          "app://./resources/css/globals.css",
          "app://./static/css/globals.css",
        ];

        globalsPaths.forEach((path, index) => {
          const globalsLink = document.createElement("link");
          globalsLink.rel = "stylesheet";
          globalsLink.href = path;
          globalsLink.id = `globals-css-direct-${index}`;
          document.head.appendChild(globalsLink);
          console.log(
            `[Style Injector] Added direct globals CSS link: ${path}`
          );

          // Add load listener to see which one actually loads
          globalsLink.addEventListener("load", () => {
            console.log(
              `[Style Injector] Successfully loaded globals CSS from direct path: ${path}`
            );
          });
        });

        // Still try the IPC approach as fallback
        window.electron
          .loadCssPath("tailwind-web.css")
          .then((cssPath) => {
            if (cssPath) {
              console.log(
                "[Style Injector] Found tailwind CSS path via IPC:",
                cssPath
              );
              const tailwindLink = document.createElement("link");
              tailwindLink.rel = "stylesheet";
              tailwindLink.href = cssPath;
              tailwindLink.id = "tailwind-css-electron";
              document.head.appendChild(tailwindLink);

              // Add load event listener to confirm successful loading
              tailwindLink.addEventListener("load", () => {
                console.log(
                  "[Style Injector] Successfully loaded tailwind CSS from:",
                  cssPath
                );
              });

              // Add error listener to detect failures
              tailwindLink.addEventListener("error", () => {
                console.error(
                  "[Style Injector] Failed to load tailwind CSS from:",
                  cssPath
                );
                // Try emergency direct path as a fallback
                const emergencyLink = document.createElement("link");
                emergencyLink.rel = "stylesheet";
                emergencyLink.href = "app://./app/static/css/tailwind-web.css";
                emergencyLink.id = "tailwind-css-electron-emergency";
                document.head.appendChild(emergencyLink);
              });
            } else {
              console.error(
                "[Style Injector] IPC returned null path for tailwind-web.css"
              );
              // Try multiple hard-coded paths as emergency fallback
              const emergencyPaths = [
                "app://./app/static/css/tailwind-web.css",
                "app://./app/styles/tailwind-web.css",
                "app://./resources/css/tailwind-web.css",
              ];

              emergencyPaths.forEach((path, index) => {
                const emergencyLink = document.createElement("link");
                emergencyLink.rel = "stylesheet";
                emergencyLink.href = path;
                emergencyLink.id = `tailwind-css-electron-emergency-${index}`;
                document.head.appendChild(emergencyLink);
                console.log("[Style Injector] Added emergency CSS link:", path);
              });
            }
          })
          .catch((err) => {
            console.error("[Style Injector] Error loading CSS via IPC:", err);
          });

        // Also try to load globals.css specifically for Electron mode with enhanced error handling
        window.electron
          .loadCssPath("globals.css")
          .then((cssPath) => {
            if (cssPath) {
              console.log(
                "[Style Injector] Found globals CSS path via IPC:",
                cssPath
              );
              const globalsLink = document.createElement("link");
              globalsLink.rel = "stylesheet";
              globalsLink.href = cssPath;
              globalsLink.id = "globals-css-electron";
              document.head.appendChild(globalsLink);

              // Add load event listener to confirm successful loading
              globalsLink.addEventListener("load", () => {
                console.log(
                  "[Style Injector] Successfully loaded globals CSS from:",
                  cssPath
                );
              });

              // Add error listener to detect failures
              globalsLink.addEventListener("error", () => {
                console.error(
                  "[Style Injector] Failed to load globals CSS from:",
                  cssPath
                );
                // Try emergency direct path as a fallback
                const emergencyLink = document.createElement("link");
                emergencyLink.rel = "stylesheet";
                emergencyLink.href = "app://./app/static/css/globals.css";
                emergencyLink.id = "globals-css-electron-emergency";
                document.head.appendChild(emergencyLink);
              });
            } else {
              console.error(
                "[Style Injector] IPC returned null path for globals.css"
              );
              // Try multiple hard-coded paths as emergency fallback
              const emergencyPaths = [
                "app://./app/static/css/globals.css",
                "app://./app/styles/globals.css",
                "app://./resources/css/globals.css",
              ];

              emergencyPaths.forEach((path, index) => {
                const emergencyLink = document.createElement("link");
                emergencyLink.rel = "stylesheet";
                emergencyLink.href = path;
                emergencyLink.id = `globals-css-electron-emergency-${index}`;
                document.head.appendChild(emergencyLink);
                console.log("[Style Injector] Added emergency CSS link:", path);
              });
            }
          })
          .catch((err) => {
            console.error(
              "[Style Injector] Error loading globals CSS via IPC:",
              err
            );
          });
      }
    } else {
      // Web environment - try multiple paths
      const tailwindLink = document.createElement("link");
      tailwindLink.rel = "stylesheet";
      tailwindLink.href = "/styles/tailwind-web.css";
      tailwindLink.id = "tailwind-css";

      // Add error listener to detect failures
      tailwindLink.addEventListener("error", () => {
        console.warn(
          "Failed to load main CSS from /styles/tailwind-web.css, trying fallbacks"
        );
      });

      document.head.appendChild(tailwindLink);

      // Try multiple fallback paths for different environments
      const fallbackPaths = [
        "/static/css/tailwind-web.css",
        "../styles/tailwind-web.css",
        "./styles/tailwind-web.css",
        "../../app/static/css/tailwind-web.css",
        // Add additional paths for globals.css
        "/styles/globals.css",
        "/static/css/globals.css",
        "../styles/globals.css",
        "./styles/globals.css",
        "../../app/static/css/globals.css",
      ];

      fallbackPaths.forEach((path, index) => {
        const tailwindLinkFallback = document.createElement("link");
        tailwindLinkFallback.rel = "stylesheet";
        tailwindLinkFallback.href = path;
        tailwindLinkFallback.id = `tailwind-css-fallback-${index}`;

        // Add listeners to log which CSS files actually load successfully
        tailwindLinkFallback.addEventListener("load", () => {
          console.log(`CSS loaded successfully from: ${path}`);
        });

        document.head.appendChild(tailwindLinkFallback);
      });
    }
  } catch (error) {
    console.error(
      "Failed to inject styles, falling back to emergency styles:",
      error
    );
    injectEmergencyStyles();
  }

  // Add error handling for CSS loading
  const linkErrorListener = (event) => {
    console.warn(`Failed to load CSS from path: ${event.target.href}`);
  };

  // Add event listeners to all links
  document.querySelectorAll('link[id^="tailwind-css"]').forEach((link) => {
    link.addEventListener("error", linkErrorListener);
  });

  // Create style element for fonts with multiple fallback paths
  const fontStyle = document.createElement("style");
  fontStyle.id = "font-styles";
  fontStyle.textContent = `
    @font-face {
      font-family: 'Pacifico';
      src: url('/fonts/Pacifico.ttf') format('truetype'),
           url('./fonts/Pacifico.ttf') format('truetype'),
           url('../fonts/Pacifico.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
  `;
  document.head.appendChild(fontStyle);

  // Create style element for base styles
  const baseStyle = document.createElement("style");
  baseStyle.id = "injected-styles";
  baseStyle.textContent = `
    :root {
      --font-sans: var(--font-geist-sans);
      --font-mono: var(--font-geist-mono);
      --background: oklch(1 0 0);
      --foreground: oklch(0.145 0 0);
      --card: oklch(1 0 0);
      --card-foreground: oklch(0.145 0 0);
      --popover: oklch(1 0 0);
      --popover-foreground: oklch(0.145 0 0);
      --primary: oklch(0.205 0 0);
      --primary-foreground: oklch(0.985 0 0);
      --secondary: oklch(0.97 0 0);
      --secondary-foreground: oklch(0.205 0 0);
      --muted: oklch(0.97 0 0);
      --muted-foreground: oklch(0.556 0 0);
      --accent: oklch(0.97 0 0);
      --accent-foreground: oklch(0.205 0 0);
      --destructive: oklch(0.577 0.245 27.325);
      --destructive-foreground: oklch(0.577 0.245 27.325);
      --border: oklch(0.922 0 0);
      --input: oklch(0.922 0 0);
      --ring: oklch(0.708 0 0);
      --radius: 0.625rem;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: var(--background);
      color: var(--foreground);
      margin: 0;
      padding: 0;
    }
    
    button, input, select, textarea {
      font-family: inherit;
    }
    
    a {
      color: inherit;
      text-decoration: none;
    }
    
    * {
      box-sizing: border-box;
      border-color: var(--border);
      outline: none;
    }
    
    /* Basic utility classes */
    .text-white { color: white; }
    .font-bold { font-weight: bold; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .rounded { border-radius: 0.25rem; }
    .bg-blue-600 { background-color: #2563eb; }
    .hover\\:bg-blue-500:hover { background-color: #3b82f6; }

    /* MagicUI critical styles */
    .rounded-inherit {
      border-radius: inherit !important;
    }

    /* Ensure borders respect parent border-radius */
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    .rounded-2xl { border-radius: 1rem; }
    .rounded-3xl { border-radius: 1.5rem; }
    
    /* Animation keyframes for MagicUI */
    @keyframes shine {
      0% { background-position: 0% 0%; }
      50% { background-position: 100% 100%; }
      to { background-position: 0% 0%; }
    }

    .animate-shine {
      animation: shine var(--duration, 14s) infinite linear;
    }

    /* Fix for MagicCard inner element border-radius inheritance */
    .group.relative > div,
    .group.relative > div > div,
    .group.relative > motion.div {
      border-radius: inherit;
    }

    /* Pulse animation for loading indicators */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .5; }
    }
    .animate-pulse {
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite !important;
    }
    .delay-0 { animation-delay: 0s !important; } /* Added !important for override */
    .delay-200 { animation-delay: 0.2s !important; } /* Added !important for override */
    .delay-400 { animation-delay: 0.4s !important; } /* Added !important for override */

    /* Ping slow animations for NoDataPlaceholder */
    @keyframes ping-slow-1 {
      0% { transform: scale(0.5); opacity: 0.75; }
      75%, 100% { transform: scale(1.5); opacity: 0; }
    }
    .animate-ping-slow-1 {
      animation: ping-slow-1 3s cubic-bezier(0, 0, 0.2, 1) infinite !important;
    }

    @keyframes ping-slow-2 {
      0% { transform: scale(0.5); opacity: 0.6; }
      75%, 100% { transform: scale(1.75); opacity: 0; }
    }
    .animate-ping-slow-2 {
      animation: ping-slow-2 3s cubic-bezier(0, 0, 0.2, 1) 0.5s infinite !important;
    }

    @keyframes ping-slow-3 {
      0% { transform: scale(0.5); opacity: 0.45; }
      75%, 100% { transform: scale(2); opacity: 0; }
    }
    .animate-ping-slow-3 {
      animation: ping-slow-3 3s cubic-bezier(0, 0, 0.2, 1) 1s infinite !important;
    }

    /* Custom scrollbar styles from timesheet.tsx */
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(75, 85, 99, 0.1);
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(75, 85, 99, 0.5);
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(75, 85, 99, 0.7);
    }

    /* Modern minimal scrollbar styling */
    .scrollbar-thin::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
      background: transparent;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
      background-color: rgba(156, 163, 175, 0.3);
      border-radius: 9999px;
      transition: all 0.2s ease;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb:hover {
      background-color: rgba(156, 163, 175, 0.5);
    }
    /* Hide scrollbar for Chrome, Safari and Opera when not hovering */
    .scrollbar-thin {
      scrollbar-width: thin;
      scrollbar-color: transparent transparent;
    }
    /* Show scrollbar on hover */
    .scrollbar-thin:hover {
      scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
    }
    /* Firefox */
    .scrollbar-thin {
      scrollbar-width: thin;
    }

    /* Fix for dropdown menus and popovers to ensure they're not clipped by parent containers */
    [data-radix-popper-content-wrapper],
    [class*="PopoverContent-"],
    [class*="DropdownMenuContent-"],
    [class*="CommandDialog"],
    [class*="DialogContent-"],
    [class*="TooltipContent-"] {
      z-index: 9999 !important;
      position: absolute !important;
    }
    
    /* Specifically target our component library popover */
    div[role="dialog"],
    div[role="listbox"],
    div[role="menu"] {
      z-index: 9999 !important;
      position: absolute !important;
    }

    /* Timesheet-specific styles to fix cross-environment rendering issues */
    /* Fix for table to ensure consistent borders */
    .timesheet-table {
      border-collapse: separate !important;
      border-spacing: 0 !important;
    }
    
    .timesheet-table th,
    .timesheet-table td {
      border-bottom: 1px solid #e5e7eb !important;
    }
    
    .timesheet-table tr:last-child td {
      border-bottom-width: 1px !important;
    }
    
    /* Fix specifically for the day column with sticky positioning */
    .timesheet-day-cell {
      position: sticky !important;
      left: 0 !important;
      z-index: 10 !important;
      /* Use box shadow instead of borders for better sticky behavior */
      background-color: inherit !important;
      border-right: 1px solid #e5e7eb !important;
    }
    
    /* Sunday-specific styling */
    .timesheet-day-cell.sunday {
      background-color: #fef3c7 !important; /* Yellow-100 equivalent */
    }
    
    /* Weekday styling */
    .timesheet-day-cell.weekday {
      background-color: white !important;
    }
    
    /* CompensationDialog styling fixes for web mode */
    /* Clear button (×) styling - completely redesigned with SVG icon */
  .clear-button {
    position: absolute !important;
    right: 10px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    color: rgba(156, 163, 175, 0.7) !important;
    cursor: pointer !important;
    font-size: 16px !important; /* Smaller font size */
    z-index: 10 !important;
    background: transparent !important;
    border: none !important;
    width: 20px !important;
    height: 20px !important;
    border-radius: 50% !important;
    transition: all 0.2s !important;
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
  
  .clear-button:hover {
    color: rgba(255, 255, 255, 0.9) !important;
    background-color: rgba(107, 114, 128, 0.5) !important;
  }
  
  /* Fix dropdown select styling */
  .compensation-dialog select option {
    background-color: #1f2937 !important; /* Dark background */
    color: white !important; /* Light text */
    padding: 8px !important;
  }
  
  .compensation-dialog select:focus option:checked,
  .compensation-dialog select option:hover,
  .compensation-dialog select option:focus {
    background-color: #3b82f6 !important; /* Blue highlight */
    color: white !important;
  }
  
  /* Ensure dropdown options are visible */
  select option {
    text-shadow: none !important;
    background-color: #1f2937 !important;
    color: white !important;
  }
  
  /* Ensure the dropdown background contrasts with the text */
  select {
    background-color: rgba(31, 41, 55, 0.5) !important;
    color: white !important;
  }
    
    /* Input field styling in dark dialog mode */
    .compensation-dialog input,
    .compensation-dialog select,
    .compensation-dialog textarea {
      background-color: rgba(209, 213, 219, 0.1) !important;
      border: 1px solid rgba(75, 85, 99, 0.2) !important;
      color: white !important;
      border-radius: 0.375rem !important;
      padding: 0.5rem 0.75rem !important;
      width: 100% !important;
      transition: border-color 0.15s ease-in-out !important;
      font-size: 0.875rem !important;
    }
    
    .compensation-dialog input:focus,
    .compensation-dialog select:focus,
    .compensation-dialog textarea:focus {
      border-color: rgba(99, 102, 241, 0.5) !important;
      outline: none !important;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25) !important;
    }
    
    .compensation-dialog input:disabled,
    .compensation-dialog select:disabled,
    .compensation-dialog textarea:disabled {
      background-color: rgba(209, 213, 219, 0.05) !important;
      color: rgba(209, 213, 219, 0.7) !important;
      cursor: not-allowed !important;
    }
    
    .compensation-dialog input::placeholder {
      color: rgba(156, 163, 175, 0.7) !important;
    }
    
    /* Form field container positioning */
    .compensation-dialog .form-field {
      position: relative !important;
      margin-bottom: 0.5rem !important;
    }
    
    /* Grid layout improvements for the form */
    .compensation-dialog form > div {
      display: grid !important;
      grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
      gap: 0.75rem !important;
      row-gap: 0.5rem !important;
    }
    
    /* Ensure input fields have consistent height */
    .compensation-dialog input,
    .compensation-dialog select {
      height: 38px !important;
    }
    
    /* Label styling */
    .compensation-dialog label {
      display: block !important;
      margin-bottom: 0.5rem !important;
      font-size: 0.875rem !important;
      font-weight: 500 !important;
      color: rgba(229, 231, 235, 0.9) !important;
    }
    
    /* Toggle switch styling */
    .compensation-dialog .toggle-switch {
      position: relative !important;
      display: inline-block !important;
      width: 36px !important;
      height: 20px !important;
      margin-right: 10px !important;
    }
    
    .compensation-dialog .toggle-switch input {
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
    }
    
    .compensation-dialog .toggle-slider {
      position: absolute !important;
      cursor: pointer !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background-color: rgba(75, 85, 99, 0.4) !important;
      transition: .4s !important;
      border-radius: 34px !important;
    }
    
    .compensation-dialog .toggle-slider:before {
      position: absolute !important;
      content: "" !important;
      height: 16px !important;
      width: 16px !important;
      left: 2px !important;
      bottom: 2px !important;
      background-color: white !important;
      transition: .4s !important;
      border-radius: 50% !important;
    }
    
    .compensation-dialog input:checked + .toggle-slider {
      background-color: rgb(79, 70, 229) !important;
    }
    
    .compensation-dialog input:checked + .toggle-slider:before {
      transform: translateX(16px) !important;
    }

    /* Fix button alignment in CompensationDialog */
    .compensation-dialog .col-span-7.flex {
      display: flex !important;
      align-items: center !important;
      justify-content: flex-end !important;
      margin-top: 1rem !important;
    }

    .compensation-dialog .col-span-7.flex input {
      margin-right: auto !important;
    }

    .compensation-dialog .col-span-7.flex button {
      height: 38px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 0.875rem !important;
      margin-left: 0.75rem !important;
    }

    /* React DatePicker essential styles */
    .react-datepicker-wrapper {
      display: inline-block;
      position: relative;
      width: 100%;
    }
    
    .react-datepicker {
      font-family: inherit;
      font-size: 0.8rem;
      background-color: #fff;
      color: #000;
      border: 1px solid #aeaeae;
      border-radius: 0.3rem;
      display: inline-block;
      position: relative;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    
    .react-datepicker__triangle {
      position: absolute;
      left: 50px;
    }
    
    .react-datepicker__header {
      text-align: center;
      background-color: #f7f7f7;
      border-bottom: 1px solid #aeaeae;
      border-top-left-radius: 0.3rem;
      border-top-right-radius: 0.3rem;
      padding: 8px 0;
    }
    
    .react-datepicker__current-month {
      font-weight: bold;
      font-size: 0.944rem;
      margin-top: 0;
      margin-bottom: 8px;
    }
    
    .react-datepicker__day-names {
      margin-bottom: -8px;
      display: flex;
    }
    
    .react-datepicker__day-name {
      color: #000;
      width: 1.9rem;
      line-height: 1.6rem;
      margin: 0.166rem;
      display: inline-block;
      text-align: center;
    }
    
    .react-datepicker__month {
      margin: 0.4rem;
      text-align: center;
    }
    
    .react-datepicker__week {
      white-space: nowrap;
      display: flex;
    }
    
    .react-datepicker__day {
      color: #000;
      display: inline-block;
      width: 1.9rem;
      line-height: 1.9rem;
      text-align: center;
      margin: 0.166rem;
      border-radius: 0.3rem;
      cursor: pointer;
    }
    
    .react-datepicker__day:hover {
      background-color: #f0f0f0;
    }
    
    .react-datepicker__day--selected,
    .react-datepicker__day--in-selecting-range,
    .react-datepicker__day--in-range {
      background-color: #2563eb;
      color: #fff;
    }
    
    .react-datepicker__day--keyboard-selected {
      background-color: #3b82f6;
      color: #fff;
    }
    
    .react-datepicker__day--disabled {
      color: #ccc;
      cursor: default;
    }
    
    .react-datepicker__day--disabled:hover {
      background-color: transparent;
    }
    
    .react-datepicker__navigation {
      align-items: center;
      background: none;
      display: flex;
      justify-content: center;
      text-align: center;
      cursor: pointer;
      position: absolute;
      top: 8px;
      padding: 0;
      border: none;
      z-index: 1;
      height: 32px;
      width: 32px;
    }
    
    .react-datepicker__navigation--previous {
      left: 8px;
    }
    
    .react-datepicker__navigation--next {
      right: 8px;
    }
    
    .react-datepicker__navigation-icon {
      position: relative;
      width: 0;
      height: 0;
      border-style: solid;
      display: block;
      margin: auto;
    }
    
    .react-datepicker__navigation-icon--previous {
      border-width: 8px 8px 8px 0;
      border-color: transparent #000 transparent transparent;
    }
    
    .react-datepicker__navigation-icon--next {
      border-width: 8px 0 8px 8px;
      border-color: transparent transparent transparent #000;
    }

    /* Fix form layout and button positioning in CompensationDialog */
    .compensation-dialog form {
      display: flex !important;
      flex-direction: column !important;
    }
    
    /* Ensure the footer stays at the bottom */
    .compensation-dialog .col-span-7.flex {
      grid-column: span 7 / span 7 !important;
      display: flex !important;
      width: 100% !important;
      margin-top: 0rem !important;
      position: relative !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      background-color: rgba(17, 24, 39, 1) !important; /* Same as dialog bg */
      padding: 0.75rem 0 !important;
      z-index: 10 !important;
    }
    
    /* Position the toggle separately */
    .compensation-dialog .col-start-7 {
      grid-column-start: 7 !important;
    }
    
    /* Style the footer buttons consistently */
    .compensation-dialog .col-span-7.flex input {
      flex: 1 1 auto !important;
      margin-right: 1rem !important;
    }
    
    .compensation-dialog .col-span-7.flex button {
      flex: 0 0 auto !important;
      height: 38px !important;
      min-width: 100px !important;
      margin-left: 0.5rem !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    
    /* Fix the Cancel and Save buttons to always be side by side */
    .compensation-dialog .col-span-7.flex button:nth-last-child(2),
    .compensation-dialog .col-span-7.flex button:last-child {
      position: relative !important;
      margin-left: 0.5rem !important;
    }

    /* Adjust select dropdown arrow spacing */
    .compensation-dialog select,
    .base-form-dialog-content select {
      padding-right: 1.5rem !important;
      background-position: right 1rem center !important;
      background-size: 16px 16px !important;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") !important;
      background-repeat: no-repeat !important;
      -webkit-appearance: none !important;
      -moz-appearance: none !important;
      appearance: none !important;
    }

    /* Remove default arrow in IE10+ */
    .compensation-dialog select::-ms-expand {
      display: none !important;
    }
  

    /* timesheet-table section - auto-generated */
    .timesheet-table th,
    .timesheet-table .timesheet-day-cell {
  position: sticky;
  left: 0;
  z-index: 10;
  background-color: inherit !important;
}
    /* end timesheet-table section */

    /* scrollbar section - auto-generated */
    .btn-blue {
    @apply text-white font-bold px-4 py-2 rounded bg-blue-600 hover:bg-blue-500;
    }
    /* Fix for sticky day cells in timesheet to ensure consistent borders in both web and desktop */
    .sticky-day-cell {
    position: relative !important;
    }
    .sticky-day-cell::before,
    .sticky-day-cell::after {
    content: '' !important;
    position: absolute !important;
    left: 0 !important;
    right: 0 !important;
    height: 1px !important;
    background-color: #e5e7eb !important;
    z-index: 11 !important;
    }
    .sticky-day-cell::before { top: 0; }
    .sticky-day-cell::after { bottom: 0; }
    /* Timesheet-specific styles for consistent borders across environments */
    .timesheet-table {
    border-collapse: separate !important;
    border-spacing: 0 !important;
    }
    .timesheet-table tr {
    border-bottom: 1px solid #e5e7eb !important;
    }
    .timesheet-table tr:first-child {
    border-top: 1px solid #e5e7eb !important;
    }
    .timesheet-day-cell {
    position: sticky !important;
    left: 0 !important;
    z-index: 10 !important;
    }
    .timesheet-day-cell.sunday {
    background-color: #fef3c7 !important; /* Yellow-100 equivalent */
    }
    .timesheet-day-cell.weekday {
    background-color: white !important;
    }
    }
    /* end scrollbar section */

    /* rounded-corners section - auto-generated */
    .rounded-inherit {
    border-radius: inherit !important;
    }
    /* end rounded-corners section */`;
  document.head.appendChild(baseStyle);

  console.log("Styles injection attempt completed");
}

// Fallback function to inject critical styles when CSS fails to load
function injectEmergencyStyles() {
  console.log("Injecting emergency inline styles");

  // Inline Tailwind's most essential utility classes for the app
  const emergencyStyle = document.createElement("style");
  emergencyStyle.id = "emergency-styles";
  emergencyStyle.textContent = `
    /* Emergency critical styling */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f9fafb;
      color: #111827;
    }
    
    /* Text styles */
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .text-lg { font-size: 1.125rem; }
    .text-xl { font-size: 1.25rem; }
    .text-2xl { font-size: 1.5rem; }
    .text-3xl { font-size: 1.875rem; }
    
    /* Colors */
    .text-white { color: white; }
    .text-black { color: black; }
    .text-gray-600 { color: #4b5563; }
    .text-blue-600 { color: #2563eb; }
    .bg-white { background-color: white; }
    .bg-gray-100 { background-color: #f3f4f6; }
    .bg-blue-600 { background-color: #2563eb; }
    
    /* Layout */
    .flex { display: flex; }
    .inline-flex { display: inline-flex; }
    .items-center { align-items: center; }
    .justify-center { justify-content: center; }
    .justify-between { justify-content: space-between; }
    .flex-col { flex-direction: column; }
    .flex-row { flex-direction: row; }
    .gap-2 { gap: 0.5rem; }
    .gap-4 { gap: 1rem; }
    
    /* Spacing */
    .p-2 { padding: 0.5rem; }
    .p-4 { padding: 1rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .m-2 { margin: 0.5rem; }
    .m-4 { margin: 1rem; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
    
    /* Borders and Rounded Corners */
    .border { border: 1px solid #e5e7eb; }
    .rounded { border-radius: 0.25rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-full { border-radius: 9999px; }
    
    /* Fix for dropdown menus to ensure they're not clipped */
    div[role="dialog"],
    div[role="listbox"],
    div[role="menu"] {
      z-index: 9999 !important;
      position: absolute !important;
    }
    
    /* Login page specific styles */
    .login-container {
      max-width: 24rem;
      margin: 4rem auto;
      padding: 2rem;
      background-color: white;
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    
    .login-title {
      font-size: 1.5rem;
      font-weight: bold;
      margin-bottom: 1.5rem;
      text-align: center;
      color: #1f2937;
    }
    
    .login-input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      margin-bottom: 1rem;
      font-size: 0.875rem;
    }
    
    .login-button {
      width: 100%;
      padding: 0.75rem;
      background-color: #2563eb;
      color: white;
      border: none;
      border-radius: 0.375rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .login-button:hover {
      background-color: #1d4ed8;
    }
    
    /* Employee cards */
    .employee-card {
      padding: 1rem;
      background-color: white;
      border-radius: 0.5rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .employee-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    
    /* Button styling */
    button {
      cursor: pointer;
    }
    
    .btn-blue {
      background-color: #2563eb;
      color: white;
      font-weight: bold;
      padding: 0.5rem 1rem;
      border-radius: 0.25rem;
      border: none;
    }
    
    .btn-blue:hover {
      background-color: #1d4ed8;
    }

    /* General layout utilities */
    .min-h-screen { min-height: 100vh; }
    .w-full { width: 100%; }
    .max-w-md { max-width: 28rem; }
    .h-8 { height: 2rem; }
    .w-8 { width: 2rem; }
    .space-y-3 > * + * { margin-top: 0.75rem; }
  `;
  document.head.appendChild(emergencyStyle);
}
