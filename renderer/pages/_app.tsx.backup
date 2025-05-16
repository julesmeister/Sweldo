import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import RootLayout from "../components/layout";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";

// DEBUG LOGGING
console.log("_app.nextron.tsx is loading");
console.log("Environment check: Nextron Mode");

// Direct imports for Nextron mode - this works well for Nextron
import "../styles/globals.css";

// Create a Nextron-specific style injector
function injectNextronStyles() {
  if (typeof document === "undefined") {
    return;
  }

  // Only inject if not already injected
  if (document.getElementById("nextron-styles")) {
    return;
  }

  // Create style element for the MagicUI-specific styles
  const magicUIStyles = document.createElement("style");
  magicUIStyles.id = "nextron-styles";
  magicUIStyles.textContent = `
    /* Critical MagicUI styles that weren't being applied */
    .rounded-inherit {
      border-radius: inherit !important;
    }
    
    /* Class for all common rounded values to ensure proper nesting */
    .rounded-lg, .rounded-xl, .rounded-2xl, .rounded-3xl,
    .rounded-t-lg, .rounded-t-xl, .rounded-t-2xl, .rounded-t-3xl,
    .rounded-b-lg, .rounded-b-xl, .rounded-b-2xl, .rounded-b-3xl {
      overflow: hidden;
    }
    
    /* Fix specifically for MagicCard component nesting */
    .group.relative {
      border-radius: inherit;
    }
    .group.relative > div,
    .group.relative > div > div,
    .group.relative > .absolute,
    .group.relative > .motion-div {
      border-radius: inherit;
    }

    @keyframes shine {
      0% {
        background-position: 0% 0%;
      }
      50% {
        background-position: 100% 100%;
      }
      to {
        background-position: 0% 0%;
      }
    }

    .animate-shine {
      animation: shine var(--duration, 14s) infinite linear;
    }
  `;
  document.head.appendChild(magicUIStyles);
  console.log("Nextron-specific styles injected");
}

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Inject additional styles for Nextron
    if (typeof window !== "undefined") {
      injectNextronStyles();
    }
  }, []);

  return (
    <RootLayout>
      <Component
        {...pageProps}
        key={typeof window === "undefined" ? "server" : "client"}
      />
    </RootLayout>
  );
}

export default MyApp;
