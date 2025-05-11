/**
 * Script to ensure CSS files are available at both path locations
 * This helps to fix issues with styleInjector.js not finding the CSS files
 */
const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "../public");
const stylesDir = path.join(publicDir, "styles");
const staticCssDir = path.join(publicDir, "static/css");

// Source file path
const tailwindCssSource = path.join(stylesDir, "tailwind-web.css");

// Ensure the directories exist
if (!fs.existsSync(stylesDir)) {
  console.log("Creating styles directory...");
  fs.mkdirSync(stylesDir, { recursive: true });
}

if (!fs.existsSync(staticCssDir)) {
  console.log("Creating static/css directory...");
  fs.mkdirSync(staticCssDir, { recursive: true });
}

// Copy the file to static/css if it exists in styles
if (fs.existsSync(tailwindCssSource)) {
  const tailwindCssTarget = path.join(staticCssDir, "tailwind-web.css");
  console.log(
    `Copying Tailwind CSS from ${tailwindCssSource} to ${tailwindCssTarget}`
  );
  fs.copyFileSync(tailwindCssSource, tailwindCssTarget);
  console.log(
    "CSS files prepared for both development and production environments."
  );
} else {
  console.error(`ERROR: Source CSS file not found at ${tailwindCssSource}`);
}
