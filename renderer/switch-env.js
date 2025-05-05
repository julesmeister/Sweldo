/**
 * Environment switcher script for Sweldo
 * Helps manually switch between web and Nextron configurations
 */
const fs = require("fs");
const path = require("path");

// Get the target environment from command line
const target = process.argv[2]?.toLowerCase();

if (!target || (target !== "web" && target !== "nextron")) {
  console.error('Please specify a target environment: "web" or "nextron"');
  console.log("Usage: node switch-env.js web|nextron");
  process.exit(1);
}

console.log(`Switching environment to: ${target}`);

// Define file mapping
const files = [
  {
    base: "_app.tsx",
    web: "_app.web.tsx",
    nextron: "_app.nextron.tsx",
    dir: "./pages",
  },
  // Add other files that need environment-specific versions here
];

// Copy the appropriate files
files.forEach((file) => {
  const srcFile = path.resolve(__dirname, `${file.dir}/${file[target]}`);
  const destFile = path.resolve(__dirname, `${file.dir}/${file.base}`);

  if (!fs.existsSync(srcFile)) {
    console.error(`Source file doesn't exist: ${srcFile}`);
    return;
  }

  try {
    // Make backup of current file if it exists
    if (fs.existsSync(destFile)) {
      const backupFile = path.resolve(
        __dirname,
        `${file.dir}/${file.base}.backup`
      );
      fs.copyFileSync(destFile, backupFile);
      console.log(`Created backup: ${backupFile}`);
    }

    // Copy the environment-specific file
    fs.copyFileSync(srcFile, destFile);
    console.log(`✅ Copied ${file[target]} to ${file.base}`);
  } catch (err) {
    console.error(`Error copying ${file[target]} to ${file.base}:`, err);
  }
});

console.log(`\nEnvironment switched to ${target.toUpperCase()} mode!`);
console.log(`Run the appropriate command to start the app:`);
console.log(`- For Nextron: npm run dev`);
console.log(`- For Web: npm run dev:web`);
