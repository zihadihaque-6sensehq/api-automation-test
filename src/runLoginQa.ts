import fs from "fs";
import path from "path";
import { ensureDir, loadSettings, requireLoginCredentials } from "./config.js";
import { loadHoppscotchSettings, requireHoppscotchAuth } from "./hoppscotch/config.js";
import { writeHtmlReport } from "./report.js";
import { resultsToJson, runLoginTests, summarize } from "./runner.js";

async function main(): Promise<number> {
  const settings = loadSettings();
  const hoppscotch = loadHoppscotchSettings();
  let results: Awaited<ReturnType<typeof runLoginTests>> = [];
  let exitCode = 1;

  try {
    requireLoginCredentials(settings);
    requireHoppscotchAuth(hoppscotch);
    if (!hoppscotch.collectionId) {
      throw new Error("HOPPSCOTCH_COLLECTION_ID is required.");
    }

    results = await runLoginTests(settings, hoppscotch);
    const summary = summarize(results);
    exitCode = summary.failed === 0 ? 0 : 1;
  } catch (error) {
    console.error(`Test run failed: ${error instanceof Error ? error.message : error}`);
  }

  if (results.length) {
    const reportPath = settings.reportHtmlPath;
    writeHtmlReport(results, reportPath, settings.loginUrl, {
      spreadsheetId: settings.spreadsheetId,
      worksheetName: settings.worksheetName,
      categoriesLabel: settings.testCategoriesLabel,
    });

    const jsonPath = reportPath.replace(/\.html?$/i, ".json");
    ensureDir(path.dirname(jsonPath));
    fs.writeFileSync(jsonPath, resultsToJson(results), "utf-8");

    const summary = summarize(results);
    console.log(
      `Ran ${summary.total} test(s): ${summary.passed} passed, ${summary.failed} failed.`
    );
    console.log(`HTML report: ${reportPath}`);
    console.log(`JSON report: ${jsonPath}`);

    if (settings.writeResults) {
      console.log(
        "Sheet updated: API Status, API Automation, Comment - Backend (WRITE_RESULTS=true)."
      );
    }

    for (const result of results) {
      const status = result.passed ? "PASS" : "FAIL";
      console.log(`[${status}] ${result.testCase.testId} (row ${result.testCase.rowNumber})`);
      for (const failure of result.failures) {
        console.log(`  - ${failure}`);
      }
    }
  }

  return exitCode;
}

const exitCode = await main();
process.exit(exitCode);
