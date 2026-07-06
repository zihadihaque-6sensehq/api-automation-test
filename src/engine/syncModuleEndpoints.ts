import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "../config.js";
import type { HoppscotchSettings } from "../hoppscotch/config.js";
import { hoppscotchCliOptions } from "../hoppscotch/config.js";
import { runHoppscotchCliJson } from "../hoppscotch/runCli.js";
import {
  buildRequestSpecs,
  requestTitleMatchesTestId,
  type RequestSpec,
} from "./buildRequestSpec.js";
import { pickPrimaryRequestMatch } from "../hoppscotch/requestMap.js";
import type { Settings } from "../config.js";
import type { TestCase } from "../sheetClient.js";
import { syncModuleEnvironment } from "./syncModuleEnvironment.js";

interface CollectionRequest {
  id: string;
  title: string;
}

export interface SyncModuleResult {
  created: string[];
  updated: string[];
  skipped: string[];
  failed: Array<{ testId: string; error: string }>;
  environment?: { id: string; name: string; created: boolean; updated: boolean };
}

export async function syncModuleEndpoints(
  tests: TestCase[],
  settings: Settings,
  hoppscotch: HoppscotchSettings
): Promise<SyncModuleResult> {
  const specs = buildRequestSpecs(tests, settings);

  if (!hoppscotch.teamId) {
    throw new Error("HOPPSCOTCH_TEAM_ID is required.");
  }
  if (!hoppscotch.collectionId) {
    throw new Error("HOPPSCOTCH_COLLECTION_ID is required.");
  }

  const environment = syncModuleEnvironment(settings, hoppscotch);
  const opts = hoppscotchCliOptions(hoppscotch);
  const existing = runHoppscotchCliJson<CollectionRequest[]>(
    ["request", "list", "--collection", hoppscotch.collectionId],
    opts
  );

  const result: SyncModuleResult = {
    created: [],
    updated: [],
    skipped: [],
    failed: [],
    environment,
  };

  for (const spec of specs) {
    const matches = existing.filter((item) =>
      requestTitleMatchesTestId(item.title, spec.testId, settings.worksheetName)
    );
    const match = pickPrimaryRequestMatch(matches, spec.testId, spec.title);

    try {
      if (match) {
        updateHoppscotchRequest(match.id, spec, hoppscotch);
        result.updated.push(spec.testId);
        console.log(`  Updated ${spec.testId}: ${spec.method} ${spec.url}`);

        for (const duplicate of matches) {
          if (duplicate.id === match.id) continue;
          deleteHoppscotchRequest(duplicate.id, hoppscotch);
          console.log(`  Removed duplicate request: ${duplicate.title}`);
        }
      } else {
        createHoppscotchRequest(spec, hoppscotch);
        result.created.push(spec.testId);
        console.log(`  Created ${spec.testId}: ${spec.method} ${spec.url}`);
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

function hoppscotchRequestPayloadArgs(spec: RequestSpec, hoppscotch?: HoppscotchSettings): string[] {
  const headers = [{ key: "Accept", value: "application/json", active: true }];
  if (spec.method !== "GET" && spec.body) {
    headers.unshift({ key: "Content-Type", value: "application/json", active: true });
  }

  const variables = JSON.stringify(
    spec.requestVariables.map((item) => ({
      key: item.key,
      value: item.value,
      active: item.active,
      description: "",
    }))
  );

  const params = JSON.stringify(
    spec.params.map((item) => ({
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
    JSON.stringify(headers),
    "--params",
    params,
    "--variables",
    variables,
    "--pre-request-script-file",
    preScriptPath,
    "--test-script-file",
    testScriptPath,
    "--description",
    spec.description,
  ];

  if (spec.method === "GET") {
    args.splice(8, 0, "--body-type", "none");
  } else {
    args.splice(8, 0, "--body", spec.body, "--body-type", "application/json");
  }

  if (spec.useBearerAuth) {
    args.push("--auth-type", "bearer", "--auth-token", "<<bearer_token>>");
  } else {
    args.push("--auth-type", "none");
  }

  if (hoppscotch) {
    return ["--team", hoppscotch.teamId, "--collection", hoppscotch.collectionId, ...args];
  }

  return args;
}

function deleteHoppscotchRequest(requestId: string, hoppscotch: HoppscotchSettings): void {
  runHoppscotchCliJson<{ deleted: boolean }>(
    ["request", "delete", requestId],
    hoppscotchCliOptions(hoppscotch)
  );
}

function createHoppscotchRequest(spec: RequestSpec, hoppscotch: HoppscotchSettings): void {
  runHoppscotchCliJson<{ id: string; title: string }>(
    ["request", "create", ...hoppscotchRequestPayloadArgs(spec, hoppscotch)],
    hoppscotchCliOptions(hoppscotch)
  );
}

function updateHoppscotchRequest(
  requestId: string,
  spec: RequestSpec,
  hoppscotch: HoppscotchSettings
): void {
  runHoppscotchCliJson<{ id: string; title: string }>(
    ["request", "update", requestId, ...hoppscotchRequestPayloadArgs(spec, hoppscotch)],
    hoppscotchCliOptions(hoppscotch)
  );
}

export function printSyncModuleSummary(result: SyncModuleResult, moduleLabel = "default"): void {
  console.log(`Module: ${moduleLabel}`);
  if (result.environment) {
    const action = result.environment.created ? "Created" : "Updated";
    console.log(`${action} environment: ${result.environment.name} (${result.environment.id})`);
  }
  console.log(`Created: ${result.created.length} (${result.created.join(", ") || "none"})`);
  console.log(`Updated: ${result.updated.length} (${result.updated.join(", ") || "none"})`);
  console.log(`Failed:  ${result.failed.length}`);
  for (const failure of result.failed) {
    console.log(`  ${failure.testId}: ${failure.error}`);
  }
}
