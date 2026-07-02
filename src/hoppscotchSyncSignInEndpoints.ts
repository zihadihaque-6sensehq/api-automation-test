import { loadHoppscotchSettings, requireHoppscotchAuth } from "./hoppscotch/config.js";
import { printSyncSummary, syncSignInEndpoints } from "./hoppscotch/syncSignInEndpoints.js";

async function main(): Promise<number> {
  try {
    const hoppscotch = loadHoppscotchSettings();
    requireHoppscotchAuth(hoppscotch);

    console.log("Syncing Sign In endpoints, scripts, and team environment to Hoppscotch...\n");
    const result = await syncSignInEndpoints(hoppscotch);
    printSyncSummary(result);

    return result.failed.length ? 1 : 0;
  } catch (error) {
    console.error(`Sync failed: ${error instanceof Error ? error.message : error}`);
    return 1;
  }
}

const exitCode = await main();
process.exit(exitCode);
