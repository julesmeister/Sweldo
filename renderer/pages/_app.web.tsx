import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import RootLayout from "../components/layout";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";

// DEBUG LOGGING
console.log("_app.web.tsx is loading");
console.log("Environment check: Web Mode");

// NO CSS IMPORTS FOR WEB MODE
// All CSS is injected at runtime to avoid Next.js CSS loader issues

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Inject styles at runtime for web mode
    if (typeof window !== "undefined") {
      console.log("Window is defined, injecting styles for Web Mode");

      // For web: use styleInjector to add all styles
      import("../utils/styleInjector")
        .then((module) => {
          module.injectStyles();
          console.log("Web styles injected successfully");
        })
        .catch((err) => {
          console.error("Failed to inject styles:", err);
        });
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
