/**
 * This script ensures that all CSS files are copied to the correct locations
 * during build time. It addresses issues where CSS files might be missing
 * in the production build.
 */

const fs = require("fs");
const path = require("path");
const fse = require("fs-extra");

const CSS_FILES = ["tailwind-web.css", "globals.css"];
const TARGET_DIRS = [
  path.resolve(__dirname, "../../app/static/css"),
  path.resolve(__dirname, "../../app/styles"),
  path.resolve(__dirname, "../../resources/css"),
];

// Source directories to check for CSS files
const SOURCE_DIRS = [
  path.resolve(__dirname, "../public/styles"),
  path.resolve(__dirname, "../styles"),
  path.resolve(__dirname, "../../resources/css"),
];

console.log("Ensuring CSS files are copied to all required locations...");

// Create target directories if they don't exist
TARGET_DIRS.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
});

// For each CSS file, find it in source directories and copy to all target directories
CSS_FILES.forEach((cssFile) => {
  let sourceFound = false;
  let sourcePath = null;

  // Find the first available source for this CSS file
  for (const sourceDir of SOURCE_DIRS) {
    const potentialPath = path.join(sourceDir, cssFile);
    if (fs.existsSync(potentialPath)) {
      sourceFound = true;
      sourcePath = potentialPath;
      console.log(`Found source for ${cssFile} at: ${sourcePath}`);
      break;
    }
  }

  if (!sourceFound) {
    console.warn(`WARNING: Could not find source for ${cssFile}!`);
    if (cssFile === "tailwind-web.css") {
      console.log(
        "This is a critical file. Make sure to run npm run generate:tailwind first."
      );
    }
    return;
  }

  // Copy to all target directories
  TARGET_DIRS.forEach((targetDir) => {
    const targetPath = path.join(targetDir, cssFile);
    try {
      fse.copySync(sourcePath, targetPath, { overwrite: true });
      console.log(`Copied ${cssFile} to: ${targetPath}`);
    } catch (error) {
      console.error(`Error copying ${cssFile} to ${targetPath}:`, error);
    }
  });
});

console.log("CSS path preparation complete.");
