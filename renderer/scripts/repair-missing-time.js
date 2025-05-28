/**
 * Repair-Missing-Time Script
 *
 * This script can be used to repair corrupted missing time JSON files.
 * Run it from the command line with node.
 *
 * Usage:
 *   node renderer/scripts/repair-missing-time.js
 */

const path = require("path");
const fs = require("fs");

// Path to the user's documents folder (adjust as needed)
const documentsPath = process.env.USERPROFILE
  ? path.join(process.env.USERPROFILE, "Documents")
  : null;

if (!documentsPath) {
  console.error("Could not determine user documents path");
  process.exit(1);
}

// Path to the SweldoDB directory
const sweldoDBPath = path.join(documentsPath, "SweldoDB");
const missingTimeLogsPath = path.join(sweldoDBPath, "missing_time_logs");

// File to repair
const fileToRepair = path.join(
  missingTimeLogsPath,
  "2025_5_missing_times.json"
);

// Check if the file exists
if (!fs.existsSync(fileToRepair)) {
  console.error(`File not found: ${fileToRepair}`);
  process.exit(1);
}

// Create a backup of the corrupted file
const backupPath = `${fileToRepair}.backup.${Date.now()}`;
try {
  const content = fs.readFileSync(fileToRepair, "utf8");
  fs.writeFileSync(backupPath, content);
  console.log(`Created backup of file at ${backupPath}`);
} catch (error) {
  console.error("Error creating backup:", error);
  process.exit(1);
}

// Create a fresh structure
const repairedData = {
  meta: {
    month: 5,
    year: 2025,
    lastModified: new Date().toISOString(),
  },
  logs: [],
};

// If we can parse the existing file and recover logs, do so
try {
  const content = fs.readFileSync(fileToRepair, "utf8");

  // Try to fix common JSON issues and parse
  let fixedContent = content;

  // Try to parse it
  try {
    const parsedData = JSON.parse(fixedContent);

    // If we have valid logs, copy them
    if (parsedData && parsedData.logs && Array.isArray(parsedData.logs)) {
      repairedData.logs = parsedData.logs;
      console.log(
        `Recovered ${parsedData.logs.length} log entries from the file`
      );
    }
  } catch (parseError) {
    console.log("Could not parse the JSON file, creating empty logs array");
  }
} catch (error) {
  console.error("Error reading file:", error);
}

// Write the repaired file
try {
  fs.writeFileSync(fileToRepair, JSON.stringify(repairedData, null, 2));
  console.log(`Successfully repaired ${fileToRepair}`);
  console.log(`The file now contains ${repairedData.logs.length} log entries`);
} catch (error) {
  console.error("Error writing repaired file:", error);
  process.exit(1);
}

console.log("Repair completed successfully");
