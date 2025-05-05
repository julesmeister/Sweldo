/** @type {import('next').NextConfig} */
const path = require("path");
const fs = require("fs");
const webpack = require("webpack");

// Detect environment - checking if running as standalone web app or in Nextron
const isNextronBuild =
  process.env.NODE_ENV === "production" ||
  fs.existsSync(path.resolve(__dirname, "../resources"));

// --- AUTO-COPY LOGIC DISABLED ---
// const appTarget = isNextronBuild ? "_app.nextron.tsx" : "_app.web.tsx";
// try {
//   if (fs.existsSync(path.resolve(__dirname, `./pages/${appTarget}`))) {
//     fs.copyFileSync(
//       path.resolve(__dirname, `./pages/${appTarget}`),
//       path.resolve(__dirname, "./pages/_app.tsx")
//     );
//     console.log(`Using ${appTarget} for this environment`);
//   } else {
//     console.warn(`Could not find ${appTarget}, using existing _app.tsx`);
//   }
// } catch (err) {
//   console.error(`Error setting up environment-specific _app file:`, err);
// }
// --- END AUTO-COPY LOGIC ---

module.exports = {
  output: "export",
  distDir: process.env.NODE_ENV === "production" ? "../app" : ".next",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Simple configuration - only for asset paths, not CSS
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};

    // Only handling resources for static assets like fonts
    // CSS is now entirely managed within renderer/styles
    config.resolve.alias["/resources"] = path.resolve(__dirname, "public");
    config.resolve.alias["/fonts"] = path.resolve(__dirname, "public/fonts");

    // Add environment flag - matches isWebEnvironment() logic from firestoreService.ts
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.DefinePlugin({
        "process.env.IS_NEXTRON": JSON.stringify(isNextronBuild),
      })
    );

    return config;
  },
};
