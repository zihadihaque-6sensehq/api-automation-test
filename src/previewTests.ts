import { loadSettings, requireLoginCredentials } from "./config.js";
import { SheetClient } from "./sheetClient.js";
import { buildLoginPayload, parseExpectedResult } from "./testParser.js";

async function main(): Promise<number> {
  try {
    const settings = loadSettings();
    requireLoginCredentials(settings);
    const tests = await new SheetClient(settings).fetchApiTests();

    const env = {
      EMAIL: settings.email,
      PASSWORD: settings.password,
      emailAddress: settings.email,
      password: settings.password,
    };

    const preview = tests.map((test) => ({
      row: test.rowNumber,
      test_id: test.testId,
      category: test.category,
      payload: buildLoginPayload(test.testData, env),
      expected: parseExpectedResult(test.expectedResult),
      current_status: test.status || null,
    }));

    console.log(
      `Found ${preview.length} backend test(s) (Category: ${settings.testCategoriesLabel}).`
    );
    console.log(JSON.stringify(preview, null, 2));
    return 0;
  } catch (error) {
    console.error(`Failed to load tests: ${error instanceof Error ? error.message : error}`);
    return 1;
  }
}

const exitCode = await main();
process.exit(exitCode);
