import { ensureModuleCollection, testEnvironmentName } from "./engine/ensureModuleCollection.js";
import { loadSettings } from "./config.js";
import {
  loadHoppscotchSettings,
  resolveHoppscotchServerUrl,
} from "./hoppscotch/config.js";
import { hoppscotchCliOptions } from "./hoppscotch/config.js";
import { runHoppscotchCliJson } from "./hoppscotch/runCli.js";
import { ensureHoppCliAvailable } from "./hoppscotch/runCollection.js";
import { SheetClient } from "./sheetClient.js";

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

function mask(value: string): string {
  if (!value) return "(not set)";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function checkGoogleSheet(): Promise<CheckResult> {
  try {
    const settings = loadSettings();
    const client = new SheetClient(settings);
    const info = await client.connect();
    const tests = await client.fetchApiTests();
    return {
      name: "Google Sheet",
      ok: true,
      detail: `worksheet="${settings.worksheetName}", rows=${info.row_count}, api_tests=${tests.length}`,
    };
  } catch (error) {
    return {
      name: "Google Sheet",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkApiTarget(): Promise<CheckResult> {
  try {
    const settings = loadSettings();
    const response = await fetch(settings.loginUrl, { method: "GET" });
    return {
      name: "API target",
      ok: response.status < 500,
      detail: `${settings.loginUrl} -> HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name: "API target",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkHoppscotchSession(): CheckResult {
  const hoppscotch = loadHoppscotchSettings();
  try {
    const teams = runHoppscotchCliJson<Array<{ id: string; name: string }>>(
      ["team", "list"],
      hoppscotchCliOptions(hoppscotch)
    );
    const team = teams.find((item) => item.id === hoppscotch.teamId);
    return {
      name: "Hoppscotch session (sync)",
      ok: true,
      detail: `graphql ok, teams=${teams.length}, configured_team=${team?.name ?? hoppscotch.teamId}`,
    };
  } catch (error) {
    return {
      name: "Hoppscotch session (sync)",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function resolveCollectionId(): string {
  const hoppscotch = loadHoppscotchSettings();
  const settings = loadSettings();
  const module = {
    moduleId: "check",
    worksheet: settings.worksheetName,
    collectionId: "",
    envName: testEnvironmentName(),
    envId: "",
  };
  return ensureModuleCollection(module, hoppscotch);
}

function checkHoppscotchCollection(): CheckResult {
  const hoppscotch = loadHoppscotchSettings();
  try {
    const collectionId = resolveCollectionId();
    const requests = runHoppscotchCliJson<Array<{ id: string; title: string }>>(
      ["request", "list", "--collection", collectionId],
      hoppscotchCliOptions(hoppscotch)
    );
    return {
      name: "Hoppscotch collection",
      ok: true,
      detail: `collection=${collectionId}, requests=${requests.length}`,
    };
  } catch (error) {
    return {
      name: "Hoppscotch collection",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkHoppscotchEnvironment(): CheckResult {
  const hoppscotch = loadHoppscotchSettings();
  const envName = (process.env.HOPPSCOTCH_ENV_NAME ?? "Test").trim();
  try {
    const envs = runHoppscotchCliJson<Array<{ id: string; name: string }>>(
      ["env", "list", "--team", hoppscotch.teamId],
      hoppscotchCliOptions(hoppscotch)
    );
    const match = envs.find((env) => env.name.toLowerCase() === envName.toLowerCase());
    return {
      name: "Hoppscotch environment",
      ok: Boolean(match),
      detail: match
        ? `"${match.name}" (${match.id})`
        : `"${envName}" not found among ${envs.length} environment(s)`,
    };
  } catch (error) {
    return {
      name: "Hoppscotch environment",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkHoppscotchPat(): Promise<CheckResult> {
  const hoppscotch = loadHoppscotchSettings();
  const serverUrl = resolveHoppscotchServerUrl(hoppscotch);
  const token = hoppscotch.personalAccessToken;

  if (!token) {
    return { name: "Hoppscotch PAT (run)", ok: false, detail: "HOPPSCOTCH_PAT is not set" };
  }

  let collectionId = hoppscotch.collectionId;
  try {
    collectionId = collectionId || resolveCollectionId();
  } catch (error) {
    return {
      name: "Hoppscotch PAT (run)",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  const base = serverUrl || "https://api.hoppscotch.io";
  const url = `${base.replace(/\/$/, "")}/v1/access-tokens/collection/${collectionId}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await response.json()) as { reason?: string; name?: string };

    if (response.ok) {
      return {
        name: "Hoppscotch PAT (run)",
        ok: true,
        detail: `server=${base}, collection_access=ok, name="${body.name ?? "unknown"}"`,
      };
    }

    return {
      name: "Hoppscotch PAT (run)",
      ok: false,
      detail: `server=${base}, HTTP ${response.status}, reason=${body.reason ?? "unknown"}, token=${mask(token)}`,
    };
  } catch (error) {
    return {
      name: "Hoppscotch PAT (run)",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkHoppCli(): CheckResult {
  try {
    ensureHoppCliAvailable();
    return { name: "Hoppscotch CLI (hopp)", ok: true, detail: "hopp binary available" };
  } catch (error) {
    return {
      name: "Hoppscotch CLI (hopp)",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<number> {
  console.log("Connection checks\n");

  const results = await Promise.all([
    checkGoogleSheet(),
    checkApiTarget(),
    Promise.resolve(checkHoppCli()),
    Promise.resolve(checkHoppscotchSession()),
    Promise.resolve(checkHoppscotchCollection()),
    Promise.resolve(checkHoppscotchEnvironment()),
    checkHoppscotchPat(),
  ]);

  let failed = 0;
  for (const result of results) {
    const status = result.ok ? "OK" : "FAIL";
    console.log(`[${status}] ${result.name}`);
    console.log(`       ${result.detail}\n`);
    if (!result.ok) failed += 1;
  }

  console.log(`Summary: ${results.length - failed}/${results.length} passed`);
  return failed === 0 ? 0 : 1;
}

const exitCode = await main();
process.exit(exitCode);
