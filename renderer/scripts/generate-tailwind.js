const fs = require("fs");
const path = require("path");
const postcss = require("postcss");
const tailwindcss = require("tailwindcss");
const autoprefixer = require("autoprefixer");

// Input: Correct, relative to project root -> renderer/styles/globals.css
const inputFile = path.resolve(__dirname, "../styles/globals.css");
// Output: Correct, relative to project root -> renderer/public/styles/tailwind-web.css
const outputFile = path.resolve(__dirname, "../public/styles/tailwind-web.css");
// Tailwind config path: Correct, relative to project root -> renderer/tailwind.config.js
const tailwindConfigPath = path.resolve(__dirname, "../tailwind.config.js");

// Ensure the output directory exists
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const css = fs.readFileSync(inputFile, "utf8");

postcss([
  tailwindcss(tailwindConfigPath), // Use the resolved config path
  autoprefixer,
])
  .process(css, { from: inputFile, to: outputFile })
  .then((result) => {
    fs.writeFileSync(outputFile, result.css);
    console.log(
      `✅ Generated ${path.relative(process.cwd(), outputFile)} successfully!`
    ); // Log relative path
  })
  .catch((error) => {
    console.error("❌ Error generating Tailwind CSS:", error);
    process.exit(1);
  });
