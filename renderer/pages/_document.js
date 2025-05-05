import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  // We can't detect if it's Nextron here directly (no access to process.env)
  // So we use a minimal approach that works in both environments
  return (
    <Html>
      <Head>
        {/* Critical styles that must load ASAP - minimal reset and fonts */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
            @font-face {
              font-family: 'Pacifico';
              src: url('/fonts/Pacifico.ttf') format('truetype');
              font-weight: normal;
              font-style: normal;
            }
            
            /* Minimal reset */
            *, *::before, *::after {
              box-sizing: border-box;
            }
            
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            }
            
            /* Prevent FOUC (Flash of Unstyled Content) */
            html { visibility: visible; }
          `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
