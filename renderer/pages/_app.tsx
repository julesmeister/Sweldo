import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import RootLayout from "../components/layout";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";

// Create a Nextron-specific style injector
function injectNextronStyles() {
  if (typeof document === "undefined" || isWebEnvironment()) {
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

// Only import CSS if in Nextron mode - this will be ignored in web mode
// due to the CSS loader error, but we'll inject styles with JS instead
// @ts-ignore - TS will complain but we handle the error at runtime
if (!isWebEnvironment()) {
  require("../styles/globals.css");
}

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Inject styles based on environment
    if (typeof window !== "undefined") {
      if (!isWebEnvironment()) {
        // For Nextron: inject additional styles needed by MagicUI
        injectNextronStyles();
      } else {
        // For web: use styleInjector for all styles
        import("../utils/styleInjector")
          .then((module) => {
            module.injectStyles();
          })
          .catch((err) => {
            console.error("Failed to inject styles:", err);
          });
      }
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
