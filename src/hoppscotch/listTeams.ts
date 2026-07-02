import { hoppscotchCliOptions, type HoppscotchSettings } from "./config.js";
import { runHoppscotchCliJson } from "./runCli.js";
import type { HoppscotchTeam } from "./types.js";

export function listAllTeams(settings: HoppscotchSettings): HoppscotchTeam[] {
  return runHoppscotchCliJson<HoppscotchTeam[]>(
    ["team", "list"],
    hoppscotchCliOptions(settings)
  );
}

export function formatTeamEnvHints(teams: HoppscotchTeam[]): string {
  const lines = [
    "# Copy one of these into .env:",
    "# HOPPSCOTCH_TEAM_ID=<id>",
    "",
  ];

  for (const team of teams) {
    const role = team.myRole ? ` (${team.myRole})` : "";
    lines.push(`# ${team.name}${role}`);
    lines.push(`HOPPSCOTCH_TEAM_ID=${team.id}`);
    lines.push("");
  }

  return lines.join("\n");
}
