import React from "react";
import type { AppProps } from "next/app";
import RootLayout from "../components/layout";
import "../styles/globals.css";

function MyApp({ Component, pageProps }: AppProps) {
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
