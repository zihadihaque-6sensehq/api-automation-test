import { loadSettings } from "./config.js";
import { loadModules, settingsForModule } from "./engine/moduleRegistry.js";
import { printSyncModuleSummary, syncModuleEndpoints } from "./engine/syncModuleEndpoints.js";
import { loadHoppscotchSettings, requireHoppscotchAuth } from "./hoppscotch/config.js";
import { SheetClient } from "./sheetClient.js";

async function main(): Promise<number> {
  try {
    const baseSettings = loadSettings();
    const baseHoppscotch = loadHoppscotchSettings();
    requireHoppscotchAuth(baseHoppscotch);
    const modules = await loadModules(baseSettings, baseHoppscotch, {
      onlyWithApiTests: true,
    });

    let exitCode = 0;
    if (!modules.length) {
      console.log("No worksheets with API/Both test rows.\n");
      return 0;
    }

    for (const module of modules) {
      const settings = settingsForModule(baseSettings, module);
      const client = new SheetClient(settings);
      const allApiTests = await client.fetchApiTests();

      if (!allApiTests.length) {
        console.log(`[${module.moduleId}] No API rows to sync.\n`);
        continue;
      }

      console.log(`Syncing ${allApiTests.length} API test(s) for "${module.worksheet}"...\n`);
      const hoppscotch = {
        ...baseHoppscotch,
        collectionId: module.collectionId,
        envId: module.envId || baseHoppscotch.envId,
      };
      const result = await syncModuleEndpoints(allApiTests, settings, hoppscotch);
      printSyncModuleSummary(result, module.moduleId);
      if (result.failed.length) exitCode = 1;
      console.log("");
    }

    return exitCode;
  } catch (error) {
    console.error(`Sync failed: ${error instanceof Error ? error.message : error}`);
    return 1;
  }
}

const exitCode = await main();
process.exit(exitCode);
