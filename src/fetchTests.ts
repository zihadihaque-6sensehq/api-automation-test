import fs from "fs";
import { ensureDir, loadSettings } from "./config.js";
import { SheetClient } from "./sheetClient.js";
import { testCasesToObjects } from "./testCases.js";

async function main(): Promise<number> {
  try {
    const settings = loadSettings();
    const tests = await new SheetClient(settings).fetchAllTests();
    const testCases = testCasesToObjects(tests);

    const outputPath = `${settings.outputDir}/test_cases.json`;
    ensureDir(settings.outputDir);
    fs.writeFileSync(outputPath, JSON.stringify(testCases, null, 2), "utf-8");

    console.log(JSON.stringify(testCases, null, 2));
    console.error(`\nSaved ${testCases.length} test case(s) to ${outputPath}`);
    return 0;
  } catch (error) {
    console.error(`Failed to load test cases: ${error instanceof Error ? error.message : error}`);
    return 1;
  }
}

const exitCode = await main();
process.exit(exitCode);
