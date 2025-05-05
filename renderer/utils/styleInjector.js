/**
 * CSS-in-JS utility to inject styles at runtime for web mode
 * This bypasses the Next.js CSS loader issues entirely
 */
import { isWebEnvironment } from "@/renderer/lib/firestoreService";

export function injectStyles() {
  if (typeof document === "undefined" || !isWebEnvironment()) {
    return;
  }

  // Only inject if not already injected
  if (document.getElementById("injected-styles")) {
    return;
  }

  // Create style element for fonts
  const fontStyle = document.createElement("style");
  fontStyle.id = "font-styles";
  fontStyle.textContent = `
    @font-face {
      font-family: 'Pacifico';
      src: url('/fonts/Pacifico.ttf') format('truetype');
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
  `;
  document.head.appendChild(baseStyle);

  // Create a link element for Tailwind
  const tailwindLink = document.createElement("link");
  tailwindLink.id = "tailwind-styles";
  tailwindLink.rel = "stylesheet";
  tailwindLink.href =
    "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css";
  document.head.appendChild(tailwindLink);

  console.log("Styles injected successfully");
}
