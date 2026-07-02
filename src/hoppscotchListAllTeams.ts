import fs from "fs";
import path from "path";
import { ensureDir } from "./config.js";
import { loadHoppscotchSettings, requireHoppscotchAuth } from "./hoppscotch/config.js";
import { formatTeamEnvHints, listAllTeams } from "./hoppscotch/listTeams.js";

async function main(): Promise<number> {
  try {
    const settings = loadHoppscotchSettings();
    requireHoppscotchAuth(settings);

    const teams = listAllTeams(settings);

    ensureDir(settings.outputDir);
    const jsonPath = path.join(settings.outputDir, "hoppscotch_teams.json");
    fs.writeFileSync(jsonPath, JSON.stringify(teams, null, 2), "utf-8");

    console.log("Hoppscotch teams\n");
    console.log(`${"ID".padEnd(28)} NAME${" ".repeat(18)} ROLE`);
    console.log("-".repeat(80));

    for (const team of teams) {
      console.log(
        `${team.id.padEnd(28)} ${team.name.padEnd(24)} ${team.myRole ?? "-"}`
      );
    }

    console.log("\n" + formatTeamEnvHints(teams));
    console.error(`\nSaved ${teams.length} team(s) to ${jsonPath}`);
    return 0;
  } catch (error) {
    console.error(`Failed to list teams: ${error instanceof Error ? error.message : error}`);
    return 1;
  }
}

const exitCode = await main();
process.exit(exitCode);
