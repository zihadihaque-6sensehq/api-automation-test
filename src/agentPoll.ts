import {
  ensureDir,
  loadSettings,
  requireLoginCredentials,
} from "./config.js";
import {
  loadHoppscotchSettings,
  requireHoppscotchAuth,
  requireHoppscotchRunAuth,
  resolveHoppscotchServerUrl,
} from "./hoppscotch/config.js";
import {
  loadModules,
  settingsForModule,
  type ModuleConfig,
} from "./engine/moduleRegistry.js";
import { runModuleTestsViaHoppscotch } from "./engine/runModuleTests.js";
import { ensureBearerToken } from "./engine/ensureBearerToken.js";
import {
  printSyncModuleSummary,
  syncModuleEndpoints,
} from "./engine/syncModuleEndpoints.js";
import { writeHtmlReport } from "./report.js";
import { summarize } from "./runner.js";
import { SheetClient } from "./sheetClient.js";
import path from "path";

function processAllRows(): boolean {
  return ["1", "true", "yes"].includes((process.env.AGENT_PROCESS_ALL ?? "false").toLowerCase());
}

function hoppscotchForModule(
  base: ReturnType<typeof loadHoppscotchSettings>,
  module: ModuleConfig
) {
  return {
    ...base,
    collectionId: module.collectionId,
    envId: module.envId || base.envId,
    serverUrl: resolveHoppscotchServerUrl(base),
  };
}

async function processModule(
  module: ModuleConfig,
  baseSettings: ReturnType<typeof loadSettings>,
  baseHoppscotch: ReturnType<typeof loadHoppscotchSettings>
): Promise<{ processed: number; passed: number; failed: number }> {
  const settings = settingsForModule(baseSettings, module);
  const client = new SheetClient(settings);
  const allApiTests = await client.fetchApiTests();
  const pending = await client.fetchPendingApiTests(processAllRows());

  if (!pending.length) {
    console.log(`[${module.moduleId}] No pending rows — skipped.\n`);
    return { processed: 0, passed: 0, failed: 0 };
  }

  console.log(
    `[${module.moduleId}] ${pending.length} pending test(s), syncing ${allApiTests.length} API row(s) on "${module.worksheet}"\n`
  );

  const hoppscotch = hoppscotchForModule(baseHoppscotch, module);
  const syncResult = await syncModuleEndpoints(allApiTests, settings, hoppscotch);
  printSyncModuleSummary(syncResult, module.moduleId);
  console.log("");

  if (syncResult.environment?.id && !hoppscotch.envId) {
    hoppscotch.envId = syncResult.environment.id;
  }

  const results = await runModuleTestsViaHoppscotch(pending, settings, hoppscotch);
  const summary = summarize(results);

  const reportDir = path.join(baseSettings.outputDir, "reports", module.moduleId);
  ensureDir(reportDir);
  const reportPath = path.join(reportDir, `report-${Date.now()}.html`);
  writeHtmlReport(results, reportPath, baseSettings.loginUrl, {
    spreadsheetId: settings.spreadsheetId,
    worksheetName: module.worksheet,
    categoriesLabel: settings.testCategoriesLabel,
    runner: "Hoppscotch CLI (hopp test)",
  });
  console.log(`Report: ${reportPath}\n`);

  return { processed: summary.total, passed: summary.passed, failed: summary.failed };
}

function sortModulesSignInFirst(modules: ModuleConfig[]): ModuleConfig[] {
  return [
    ...modules.filter((module) => module.moduleId === "sign-in"),
    ...modules.filter((module) => module.moduleId !== "sign-in"),
  ];
}

async function main(): Promise<number> {
  const baseSettings = loadSettings();
  requireLoginCredentials(baseSettings);
  const baseHoppscotch = loadHoppscotchSettings();
  requireHoppscotchAuth(baseHoppscotch);
  requireHoppscotchRunAuth(baseHoppscotch);

  const modules = await loadModules(baseSettings, baseHoppscotch, {
    onlyWithQueuedTests: !processAllRows(),
  });

  console.log("API automation agent poll\n");
  if (!modules.length) {
    console.log("No worksheets with queued API tests (Category API/Both + API Status Not_implemented).\n");
    return 0;
  }
  console.log(`Worksheets: ${modules.map((item) => item.worksheet).join(", ")}\n`);

  let totalProcessed = 0;
  let totalFailed = 0;
  let bearerReady = false;

  for (const module of sortModulesSignInFirst(modules)) {
    try {
      if (!bearerReady && module.moduleId !== "sign-in") {
        await ensureBearerToken(baseSettings, baseHoppscotch);
        bearerReady = true;
      }

      const result = await processModule(module, baseSettings, baseHoppscotch);
      totalProcessed += result.processed;
      totalFailed += result.failed;

      if (module.moduleId === "sign-in") {
        await ensureBearerToken(baseSettings, baseHoppscotch);
        bearerReady = true;
      }
    } catch (error) {
      console.error(
        `[${module.moduleId}] Failed: ${error instanceof Error ? error.message : error}\n`
      );
      totalFailed += 1;
    }
  }

  console.log(`Summary: processed ${totalProcessed} test(s), ${totalFailed} failed module/test(s).`);
  return totalFailed > 0 ? 1 : 0;
}

const exitCode = await main();
process.exit(exitCode);
