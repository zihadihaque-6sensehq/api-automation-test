import fs from "fs";
import path from "path";
import { ensureDir } from "./config.js";
import { loadHoppscotchSettings, requireHoppscotchAuth } from "./hoppscotch/config.js";
import { formatEnvHints, listAllCollections } from "./hoppscotch/listCollections.js";

async function main(): Promise<number> {
  try {
    const settings = loadHoppscotchSettings();
    requireHoppscotchAuth(settings);

    if (!settings.teamId) {
      throw new Error("HOPPSCOTCH_TEAM_ID is required. Run ./scripts/hoppscotch_teams.sh first.");
    }

    const collections = await listAllCollections(settings);

    ensureDir(settings.outputDir);
    const jsonPath = path.join(settings.outputDir, "hoppscotch_collections.json");
    fs.writeFileSync(jsonPath, JSON.stringify(collections, null, 2), "utf-8");

    console.log("Hoppscotch collections (team: " + settings.teamId + ")\n");
    console.log(`${"ID".padEnd(28)} PATH`);
    console.log("-".repeat(80));

    for (const entry of collections) {
      const indent = "  ".repeat(entry.depth);
      console.log(`${entry.id.padEnd(28)} ${indent}${entry.title} (${entry.path})`);
    }

    console.log("\n" + formatEnvHints(collections));
    console.error(`\nSaved ${collections.length} collection(s) to ${jsonPath}`);
    return 0;
  } catch (error) {
    console.error(
      `Failed to list collections: ${error instanceof Error ? error.message : error}`
    );
    return 1;
  }
}

const exitCode = await main();
process.exit(exitCode);
