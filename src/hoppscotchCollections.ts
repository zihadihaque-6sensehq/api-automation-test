import {
  hoppscotchCliOptions,
  loadHoppscotchSettings,
  requireHoppscotchAuth,
} from "./hoppscotch/config.js";
import { runHoppscotchCliJson } from "./hoppscotch/runCli.js";
import type { HoppscotchCollectionSummary } from "./hoppscotch/types.js";

async function main(): Promise<number> {
  try {
    const settings = loadHoppscotchSettings();
    requireHoppscotchAuth(settings);

    if (!settings.teamId) {
      throw new Error("HOPPSCOTCH_TEAM_ID is required. Run ./scripts/hoppscotch_teams.sh first.");
    }

    const args = ["collection", "list", "--team", settings.teamId];
    const collections = runHoppscotchCliJson<HoppscotchCollectionSummary[]>(
      args,
      hoppscotchCliOptions(settings)
    );

    console.log(JSON.stringify(collections, null, 2));
    console.error(`\nFound ${collections.length} root collection(s).`);
    return 0;
  } catch (error) {
    console.error(`Failed to list collections: ${error instanceof Error ? error.message : error}`);
    return 1;
  }
}

const exitCode = await main();
process.exit(exitCode);
