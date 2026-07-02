import fs from "fs";
import path from "path";
import { ensureDir } from "./config.js";
import {
  hoppscotchCliOptions,
  loadHoppscotchSettings,
  requireHoppscotchAuth,
} from "./hoppscotch/config.js";
import { parseHoppscotchExport } from "./hoppscotch/parseEndpoints.js";
import { runHoppscotchCli } from "./hoppscotch/runCli.js";

async function main(): Promise<number> {
  try {
    const settings = loadHoppscotchSettings();
    requireHoppscotchAuth(settings);

    if (!settings.teamId) {
      throw new Error("HOPPSCOTCH_TEAM_ID is required. Run ./scripts/hoppscotch_teams.sh first.");
    }

    const args = ["collection", "export", "--team", settings.teamId];
    if (settings.collectionId) {
      args.push("--collection", settings.collectionId);
    }

    const rawExport = runHoppscotchCli(args, hoppscotchCliOptions(settings));
    const endpoints = parseHoppscotchExport(rawExport);

    ensureDir(settings.outputDir);
    const exportPath = path.join(settings.outputDir, "hoppscotch_export.json");
    const endpointsPath = path.join(settings.outputDir, "hoppscotch_endpoints.json");

    fs.writeFileSync(exportPath, rawExport, "utf-8");
    fs.writeFileSync(endpointsPath, JSON.stringify(endpoints, null, 2), "utf-8");

    console.log(JSON.stringify(endpoints, null, 2));
    console.error(`\nSaved ${endpoints.length} endpoint(s):`);
    console.error(`  Raw export: ${exportPath}`);
    console.error(`  Endpoints:  ${endpointsPath}`);
    return 0;
  } catch (error) {
    console.error(
      `Failed to fetch Hoppscotch endpoints: ${error instanceof Error ? error.message : error}`
    );
    return 1;
  }
}

const exitCode = await main();
process.exit(exitCode);
