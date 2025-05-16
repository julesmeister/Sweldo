/**
 * Script to ensure CSS files are available at all required path locations
 * This helps fix issues with styleInjector.js not finding the CSS files in both
 * Electron and web modes.
 */
const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "../../");
const publicDir = path.join(__dirname, "../public");
const stylesDir = path.join(publicDir, "styles");
const staticCssDir = path.join(publicDir, "static/css");
const appStaticCssDir = path.join(rootDir, "app/static/css");
const appStylesDir = path.join(rootDir, "app/styles");
const resourcesCssDir = path.join(rootDir, "resources/css");

// Source file path
const tailwindCssSource = path.join(stylesDir, "tailwind-web.css");

// List of all target directories to ensure they exist
const directories = [
  stylesDir,
  staticCssDir,
  appStaticCssDir,
  appStylesDir,
  resourcesCssDir,
];

// Ensure all directories exist
directories.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Copy the file to all required locations if the source exists
if (fs.existsSync(tailwindCssSource)) {
  // Define all target locations for the CSS file
  const targets = [
    {
      path: path.join(staticCssDir, "tailwind-web.css"),
      desc: "public/static/css (for Next.js)",
    },
    {
      path: path.join(appStaticCssDir, "tailwind-web.css"),
      desc: "app/static/css (for Electron)",
    },
    {
      path: path.join(appStylesDir, "tailwind-web.css"),
      desc: "app/styles (for Electron fallback)",
    },
    {
      path: path.join(resourcesCssDir, "tailwind-web.css"),
      desc: "resources/css (for build process)",
    },
  ];

  // Copy to each target location
  targets.forEach((target) => {
    try {
      console.log(`Copying Tailwind CSS to ${target.desc}: ${target.path}`);
      fs.copyFileSync(tailwindCssSource, target.path);
    } catch (err) {
      console.error(`Error copying to ${target.desc}:`, err.message);
    }
  });

  console.log("CSS files prepared for both web and Electron environments");
} else {
  console.error(`ERROR: Source CSS file not found at ${tailwindCssSource}`);
  console.log(
    "Please run 'npm run generate:tailwind' first to generate the CSS file."
  );
}

// Copy the inlined styles to the app directory for Electron
const inlinedStylesSource = path.join(__dirname, "../utils/inlinedStyles.js");
const inlinedStylesTarget = path.join(rootDir, "app/utils/inlinedStyles.js");

// Make sure the target directory exists
const inlinedStylesDir = path.dirname(inlinedStylesTarget);
if (!fs.existsSync(inlinedStylesDir)) {
  console.log(`Creating directory for inlined styles: ${inlinedStylesDir}`);
  fs.mkdirSync(inlinedStylesDir, { recursive: true });
}

// Copy the inlined styles
if (fs.existsSync(inlinedStylesSource)) {
  try {
    console.log(
      `Copying inlined styles to app directory: ${inlinedStylesTarget}`
    );
    fs.copyFileSync(inlinedStylesSource, inlinedStylesTarget);
  } catch (err) {
    console.error(`Error copying inlined styles:`, err.message);
  }
} else {
  console.warn(
    `WARNING: Inlined styles file not found at ${inlinedStylesSource}`
  );
  console.log(
    "Please run 'npm run inline:tailwind' to generate the inlined styles."
  );
}

console.log("CSS preparation complete!");
