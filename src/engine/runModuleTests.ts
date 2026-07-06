import fs from "fs";
import path from "path";
import type { ApiResponse } from "../runner.js";
import type { Settings } from "../config.js";
import { ensureDir } from "../config.js";
import type { HoppscotchSettings } from "../hoppscotch/config.js";
import { resolveHoppscotchEnvId, resolveHoppscotchServerUrl } from "../hoppscotch/config.js";
import { parseJUnitReport, failuresForSheetComment } from "../hoppscotch/parseJUnitReport.js";
import { findRequestIdForTest, listCollectionRequests } from "../hoppscotch/requestMap.js";
import { testEnvironmentName, worksheetToCollectionSlug } from "./ensureModuleCollection.js";
import { runHoppscotchCollection, writeHoppscotchRunEnvironment } from "../hoppscotch/runCollection.js";
import type { TestResult } from "../runner.js";
import { SheetClient } from "../sheetClient.js";
import { buildTestPayload } from "./buildTestPayload.js";
import { parseExpectedResult } from "../testParser.js";
import type { TestCase } from "../sheetClient.js";

function credentialEnv(settings: Settings): Record<string, string> {
  return {
    EMAIL: settings.email,
    PASSWORD: settings.password,
    emailAddress: settings.email,
    password: settings.password,
    BASE_URL: settings.baseUrl,
    LOGIN_ENDPOINT: settings.loginEndpoint,
    VALID_EMAIL: settings.email,
    VALID_PASSWORD: settings.password,
  };
}

function hoppscotchValidatedResponse(failures: string[]): ApiResponse {
  if (!failures.length) {
    return {
      statusCode: 0,
      body: null,
      rawText: "Validated by Hoppscotch pw scripts (Google Sheet expectations)",
      error: null,
    };
  }
  return { statusCode: 0, body: null, rawText: "", error: failures.join("; ") };
}

export async function runModuleTestsViaHoppscotch(
  tests: TestCase[],
  settings: Settings,
  hoppscotch: HoppscotchSettings
): Promise<TestResult[]> {
  const client = new SheetClient(settings);
  const env = credentialEnv(settings);

  let hoppscotchRequests: ReturnType<typeof listCollectionRequests> = [];
  try {
    hoppscotchRequests = listCollectionRequests(hoppscotch);
  } catch (error) {
    console.warn(
      `Could not list Hoppscotch requests: ${error instanceof Error ? error.message : error}`
    );
  }

  const junitPath = path.join(hoppscotch.outputDir, "hoppscotch-run", `junit-${Date.now()}.xml`);
  ensureDir(path.dirname(junitPath));

  const hoppscotchForRun = {
    ...hoppscotch,
    serverUrl: resolveHoppscotchServerUrl(hoppscotch),
  };
  const environmentRef = resolveRunEnvironmentRef(hoppscotchForRun, settings);

  console.log(`Running ${tests.length} test(s) in collection ${hoppscotch.collectionId}`);
  const run = runHoppscotchCollection(hoppscotchForRun, junitPath, environmentRef);
  const junitResults = parseJUnitReport(fs.readFileSync(run.junitPath, "utf-8"));
  const results: TestResult[] = [];

  for (const testCase of tests) {
    const payload = buildTestPayload(testCase.testData, env);
    const expected = parseExpectedResult(testCase.expectedResult);
    const requestId = findRequestIdForTest(
      testCase.testId,
      hoppscotchRequests,
      settings.worksheetName
    );
    const requestTitle = hoppscotchRequests.find((item) => item.id === requestId)?.title;
    const junit = matchJUnitResult(
      testCase.testId,
      requestTitle,
      settings.worksheetName,
      junitResults
    );
    const failures: string[] = [];

    if (!junit) {
      failures.push(`No Hoppscotch result for ${testCase.testId}.`);
    } else if (junit.assertionCount === 0) {
      failures.push(`No pw.test assertions on "${junit.suiteName}".`);
    } else if (!junit.passed) {
      failures.push(...failuresForSheetComment(junit.failures));
    }

    const passed = failures.length === 0;
    results.push({
      testCase,
      payload,
      expected,
      response: hoppscotchValidatedResponse(failures),
      hoppscotchRequestId: requestId,
      passed,
      failures,
    });

    if (settings.writeResults) {
      await client.updateApiTestResult(testCase.rowNumber, passed, failures);
    }
  }

  if (run.stdout) console.log(run.stdout);
  if (run.stderr) console.error(run.stderr);
  console.log(`JUnit report: ${run.junitPath}`);

  return results;
}

function resolveRunEnvironmentRef(
  hoppscotch: HoppscotchSettings,
  settings: Settings
): string {
  if (hoppscotch.envId) return hoppscotch.envId;

  try {
    return resolveHoppscotchEnvId(hoppscotch, testEnvironmentName());
  } catch {
    console.warn(
      `Team environment "${testEnvironmentName()}" not found; using local run-env.json for hopp test.`
    );
    return writeHoppscotchRunEnvironment(settings, hoppscotch);
  }
}

function matchJUnitResult(
  testId: string,
  requestTitle: string | undefined,
  worksheet: string,
  junitResults: ReturnType<typeof parseJUnitReport>
) {
  const slug = worksheetToCollectionSlug(worksheet);
  const slugPrefix = `${slug}/${testId}`.toLowerCase();
  const testIdUpper = testId.toUpperCase();

  const candidates = junitResults.filter((item) => {
    const suite = item.suiteName.toLowerCase();
    return (
      suite.includes(slugPrefix) ||
      item.testId?.toUpperCase() === testIdUpper ||
      suite.startsWith(`${testId.toLowerCase()} -`) ||
      suite.startsWith(`${testId.toUpperCase()} -`)
    );
  });

  if (requestTitle) {
    const normalizedTitle = requestTitle.toLowerCase();
    const byTitle = candidates.find((item) => {
      const suite = item.suiteName.toLowerCase();
      return suite === normalizedTitle || suite.endsWith(`/${normalizedTitle}`);
    });
    if (byTitle) return byTitle;
  }

  const withAssertions = candidates.filter((item) => item.assertionCount > 0);
  if (withAssertions.length) return withAssertions[0];

  const withoutLegacyPrefix = candidates.find(
    (item) => !item.suiteName.toLowerCase().includes(`${slug}/`)
  );
  if (withoutLegacyPrefix) return withoutLegacyPrefix;

  return candidates[0];
}
