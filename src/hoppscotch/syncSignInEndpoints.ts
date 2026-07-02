import fs from "fs";
import path from "path";
import { loadSettings, PROJECT_ROOT } from "../config.js";
import { SheetClient } from "../sheetClient.js";
import type { HoppscotchSettings } from "./config.js";
import { hoppscotchCliOptions } from "./config.js";
import { runHoppscotchCliJson } from "./runCli.js";
import {
  buildSignInRequestSpecs,
  requestTitleMatchesTestId,
  type SignInRequestSpec,
} from "./signInRequests.js";
import { syncSignInEnvironment } from "./syncEnvironment.js";

interface CollectionRequest {
  id: string;
  title: string;
  request?: string;
}

export interface SyncSignInResult {
  created: string[];
  updated: string[];
  skipped: string[];
  failed: Array<{ testId: string; error: string }>;
  environment?: { id: string; name: string; created: boolean; updated: boolean };
}

export async function syncSignInEndpoints(
  hoppscotch: HoppscotchSettings
): Promise<SyncSignInResult> {
  const app = loadSettings();
  const sheet = new SheetClient(app);
  const tests = await sheet.fetchApiTests();
  const specs = buildSignInRequestSpecs(tests, app);

  if (!hoppscotch.teamId) {
    throw new Error("HOPPSCOTCH_TEAM_ID is required.");
  }
  if (!hoppscotch.collectionId) {
    throw new Error("HOPPSCOTCH_COLLECTION_ID is required.");
  }

  const environment = syncSignInEnvironment(app, hoppscotch);
  const opts = hoppscotchCliOptions(hoppscotch);
  const existing = runHoppscotchCliJson<CollectionRequest[]>(
    ["request", "list", "--collection", hoppscotch.collectionId],
    opts
  );

  const result: SyncSignInResult = {
    created: [],
    updated: [],
    skipped: [],
    failed: [],
    environment,
  };

  for (const spec of specs) {
    const match = existing.find((item) => requestTitleMatchesTestId(item.title, spec.testId));

    try {
      if (match) {
        await updateHoppscotchRequest(match.id, spec, hoppscotch);
        result.updated.push(spec.testId);
      } else {
        await createHoppscotchRequest(spec, hoppscotch);
        result.created.push(spec.testId);
      }
    } catch (error) {
      result.failed.push({
        testId: spec.testId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

function hoppscotchCreateArgs(spec: SignInRequestSpec, hoppscotch: HoppscotchSettings): string[] {
  return ["request", "create", ...hoppscotchRequestPayloadArgs(spec, hoppscotch)];
}

function hoppscotchUpdateArgs(requestId: string, spec: SignInRequestSpec): string[] {
  return ["request", "update", requestId, ...hoppscotchRequestPayloadArgs(spec)];
}

function hoppscotchRequestPayloadArgs(
  spec: SignInRequestSpec,
  hoppscotch?: HoppscotchSettings
): string[] {
  const headers = JSON.stringify([
    { key: "Content-Type", value: "application/json", active: true },
    { key: "Accept", value: "application/json", active: true },
  ]);
  const variables = JSON.stringify(
    spec.requestVariables.map((item) => ({
      key: item.key,
      value: item.value,
      active: item.active,
      description: "",
    }))
  );

  const scriptDir = path.join(PROJECT_ROOT, "output", "hoppscotch-sync");
  fs.mkdirSync(scriptDir, { recursive: true });
  const preScriptPath = path.join(scriptDir, `${spec.testId}.pre.js`);
  const testScriptPath = path.join(scriptDir, `${spec.testId}.test.js`);
  fs.writeFileSync(preScriptPath, spec.preRequestScript, "utf-8");
  fs.writeFileSync(testScriptPath, spec.testScript, "utf-8");

  const args = [
    "--title",
    spec.title,
    "--method",
    spec.method,
    "--url",
    spec.url,
    "--headers",
    headers,
    "--body",
    spec.body,
    "--body-type",
    "application/json",
    "--variables",
    variables,
    "--pre-request-script-file",
    preScriptPath,
    "--test-script-file",
    testScriptPath,
    "--description",
    spec.description,
  ];

  if (hoppscotch) {
    return [
      "--team",
      hoppscotch.teamId,
      "--collection",
      hoppscotch.collectionId,
      ...args,
    ];
  }

  return args;
}

async function createHoppscotchRequest(
  spec: SignInRequestSpec,
  hoppscotch: HoppscotchSettings
): Promise<void> {
  const opts = hoppscotchCliOptions(hoppscotch);
  runHoppscotchCliJson<{ id: string; title: string }>(
    hoppscotchCreateArgs(spec, hoppscotch),
    opts
  );
}

async function updateHoppscotchRequest(
  requestId: string,
  spec: SignInRequestSpec,
  hoppscotch: HoppscotchSettings
): Promise<void> {
  const opts = hoppscotchCliOptions(hoppscotch);
  runHoppscotchCliJson<{ id: string; title: string }>(
    hoppscotchUpdateArgs(requestId, spec),
    opts
  );
}

export function printSyncSummary(result: SyncSignInResult): void {
  if (result.environment) {
    const action = result.environment.created ? "Created" : "Updated";
    console.log(`${action} team environment: ${result.environment.name} (${result.environment.id})`);
  }

  console.log(`Created: ${result.created.length} (${result.created.join(", ") || "none"})`);
  console.log(`Updated: ${result.updated.length} (${result.updated.join(", ") || "none"})`);
  console.log(`Skipped: ${result.skipped.length} (${result.skipped.join(", ") || "none"})`);
  console.log(`Failed:  ${result.failed.length}`);

  for (const failure of result.failed) {
    console.log(`  ${failure.testId}: ${failure.error}`);
  }
}
