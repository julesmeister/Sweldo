/**
 * This script synchronizes styles between globals.css and styleInjector.js
 * Run this script before building for web to ensure consistent styling
 */

const fs = require("fs");
const path = require("path");

// File paths
const GLOBALS_CSS_PATH = path.resolve(__dirname, "../styles/globals.css");
const STYLE_INJECTOR_PATH = path.resolve(
  __dirname,
  "../utils/styleInjector.js"
);

// Sections to extract from globals.css
const SECTIONS_TO_EXTRACT = [
  {
    name: "timesheet-table",
    startMarker: "/* Add these styles for the timesheet table */",
    endMarker: null, // will go until the end of the file or the next section
  },
  {
    name: "rounded-corners",
    startMarker: "/* Ensure rounded corners are properly displayed */",
    endMarker: null,
  },
];

// Selectors to skip (already present in styleInjector.js)
const SELECTORS_TO_SKIP = [
  ".scrollbar-thin",
  ".custom-scrollbar",
  ".btn-blue",
  "@apply",
  "@layer",
];

// Read the files
let globalsCss;
let styleInjector;

try {
  globalsCss = fs.readFileSync(GLOBALS_CSS_PATH, "utf8");
  styleInjector = fs.readFileSync(STYLE_INJECTOR_PATH, "utf8");
} catch (error) {
  console.error("Error reading files:", error);
  process.exit(1);
}

// Function to extract a section from globals.css
function extractSection(content, startMarker, endMarker = null) {
  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) return null;

  const effectiveStart = startIndex + startMarker.length;

  let endIndex;
  if (endMarker) {
    // Find the matching closing marker (consider nested blocks)
    let depth = 1;
    let searchIndex = effectiveStart;

    while (depth > 0 && searchIndex < content.length) {
      const nextOpenIndex = content.indexOf("{", searchIndex);
      const nextCloseIndex = content.indexOf("}", searchIndex);

      if (nextOpenIndex !== -1 && nextOpenIndex < nextCloseIndex) {
        depth++;
        searchIndex = nextOpenIndex + 1;
      } else if (nextCloseIndex !== -1) {
        depth--;
        searchIndex = nextCloseIndex + 1;
        if (depth === 0) {
          endIndex = nextCloseIndex + 1;
        }
      } else {
        break;
      }
    }
  } else {
    // If no end marker, go to the next section or end of file
    let nextSectionIndex = Number.MAX_SAFE_INTEGER;
    for (const section of SECTIONS_TO_EXTRACT) {
      const idx = content.indexOf(section.startMarker, effectiveStart);
      if (idx !== -1 && idx < nextSectionIndex) {
        nextSectionIndex = idx;
      }
    }

    endIndex =
      nextSectionIndex === Number.MAX_SAFE_INTEGER
        ? content.length
        : nextSectionIndex;
  }

  return content.substring(effectiveStart, endIndex).trim();
}

// Extract sections from globals.css
const extractedSections = {};
for (const section of SECTIONS_TO_EXTRACT) {
  const extracted = extractSection(
    globalsCss,
    section.startMarker,
    section.endMarker
  );
  if (extracted) {
    extractedSections[section.name] = extracted;
  }
}

// Function to check if a line should be skipped
function shouldSkipLine(line) {
  // Skip comments and empty lines
  if (line.trim().startsWith("/*") || line.trim() === "") {
    return true;
  }

  // Skip lines containing Tailwind directives or other specific selectors
  for (const selector of SELECTORS_TO_SKIP) {
    if (line.includes(selector)) {
      return true;
    }
  }

  return false;
}

// Function to check if a selector already exists in styleInjector.js
function doesSelectorExist(styleContent, selector) {
  // Extract the selector name from CSS rule
  const selectorName = selector.split("{")[0].trim();
  if (!selectorName) return false;

  // See if this selector is already in the styleContent
  return (
    styleContent.includes(selectorName + " {") ||
    styleContent.includes(selectorName + "{") ||
    styleContent.includes(`${selectorName}::`)
  );
}

// Find the insertion point in styleInjector.js
function updateStyleInjector(styleInjectorContent, extractedSections) {
  // Look for the baseStyle.textContent section
  const styleStartMarker = "baseStyle.textContent = `";
  const styleEndMarker = "`;";

  const styleStartIndex =
    styleInjectorContent.indexOf(styleStartMarker) + styleStartMarker.length;
  const styleEndIndex = styleInjectorContent.lastIndexOf(
    styleEndMarker,
    styleInjectorContent.length
  );

  if (styleStartIndex === -1 || styleEndIndex === -1) {
    console.error("Could not find style content section in styleInjector.js");
    return styleInjectorContent;
  }

  // Get the existing style content
  let styleContent = styleInjectorContent.substring(
    styleStartIndex,
    styleEndIndex
  );

  // Replace or add sections
  for (const [name, content] of Object.entries(extractedSections)) {
    // Split the CSS content into rule blocks
    const cssRules = [];
    let currentRule = "";
    let braceDepth = 0;

    content.split("\n").forEach((line) => {
      if (shouldSkipLine(line)) return;

      const trimmedLine = line.trim();

      // Count opening braces
      for (let i = 0; i < trimmedLine.length; i++) {
        if (trimmedLine[i] === "{") braceDepth++;
        if (trimmedLine[i] === "}") braceDepth--;
      }

      currentRule += line + "\n";

      // If we've closed all braces, we have a complete rule
      if (braceDepth === 0 && currentRule.trim()) {
        cssRules.push(currentRule.trim());
        currentRule = "";
      }
    });

    // Filter out rules that already exist
    const uniqueRules = cssRules.filter(
      (rule) => !doesSelectorExist(styleContent, rule)
    );

    // Format the unique rules
    const formattedRules = uniqueRules
      .map((rule) => {
        // Add !important to properties that don't already have it
        return rule.replace(/\s*:\s*([^!]+);/g, ": $1 !important;");
      })
      .join("\n    ");

    if (!formattedRules.trim()) {
      console.log(`No new rules to add for section: ${name}`);
      continue;
    }

    // Look for existing section markers
    const sectionStartMarker = `/* ${name} section - auto-generated */`;
    const sectionEndMarker = `/* end ${name} section */`;

    const sectionStartIndex = styleContent.indexOf(sectionStartMarker);
    const sectionEndIndex = styleContent.indexOf(sectionEndMarker);

    if (sectionStartIndex !== -1 && sectionEndIndex !== -1) {
      // Replace existing section
      const beforeSection = styleContent.substring(0, sectionStartIndex);
      const afterSection = styleContent.substring(
        sectionEndIndex + sectionEndMarker.length
      );

      styleContent = `${beforeSection}${sectionStartMarker}\n    ${formattedRules}\n    ${sectionEndMarker}${afterSection}`;
    } else {
      // Add new section to the end
      styleContent += `\n\n    /* ${name} section - auto-generated */\n    ${formattedRules}\n    /* end ${name} section */`;
    }
  }

  // Reassemble the file
  return (
    styleInjectorContent.substring(0, styleStartIndex) +
    styleContent +
    styleInjectorContent.substring(styleEndIndex)
  );
}

// Update styleInjector.js with the extracted sections
const updatedStyleInjector = updateStyleInjector(
  styleInjector,
  extractedSections
);

// Write the updated file
try {
  fs.writeFileSync(STYLE_INJECTOR_PATH, updatedStyleInjector, "utf8");
  console.log(
    "Successfully updated styleInjector.js with styles from globals.css"
  );
} catch (error) {
  console.error("Error writing to styleInjector.js:", error);
  process.exit(1);
}
