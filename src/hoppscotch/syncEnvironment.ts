import type { Settings } from "../config.js";
import type { HoppscotchSettings } from "./config.js";
import { hoppscotchCliOptions } from "./config.js";
import { runHoppscotchCliJson } from "./runCli.js";

interface TeamEnvironment {
  id: string;
  name: string;
  variables: string;
}

const DEFAULT_ENV_NAME = "Sign In - Test";

export interface SyncEnvironmentResult {
  id: string;
  name: string;
  created: boolean;
  updated: boolean;
}

export function buildTeamEnvironmentVariables(settings: Settings): string {
  return JSON.stringify([
    { key: "BASE_URL", value: settings.baseUrl, secret: false },
    { key: "base_url", value: settings.baseUrl, secret: false },
    { key: "LOGIN_ENDPOINT", value: settings.loginEndpoint, secret: false },
    { key: "EMAIL", value: settings.email, secret: false },
    { key: "PASSWORD", value: settings.password, secret: true },
    { key: "VALID_EMAIL", value: settings.email, secret: false },
    { key: "VALID_PASSWORD", value: settings.password, secret: true },
  ]);
}

export function syncSignInEnvironment(
  settings: Settings,
  hoppscotch: HoppscotchSettings
): SyncEnvironmentResult {
  if (!hoppscotch.teamId) {
    throw new Error("HOPPSCOTCH_TEAM_ID is required.");
  }

  const envName = (process.env.HOPPSCOTCH_ENV_NAME ?? DEFAULT_ENV_NAME).trim();
  const variables = buildTeamEnvironmentVariables(settings);
  const opts = hoppscotchCliOptions(hoppscotch);

  const configuredId = (process.env.HOPPSCOTCH_ENV_ID ?? "").trim();
  if (configuredId) {
    runHoppscotchCliJson<TeamEnvironment>(
      ["env", "update", configuredId, "--team", hoppscotch.teamId, "--name", envName, "--variables", variables],
      opts
    );
    return { id: configuredId, name: envName, created: false, updated: true };
  }

  const existing = runHoppscotchCliJson<TeamEnvironment[]>(
    ["env", "list", "--team", hoppscotch.teamId],
    opts
  );
  const match = existing.find((env) => env.name.toLowerCase() === envName.toLowerCase());

  if (match) {
    runHoppscotchCliJson<TeamEnvironment>(
      ["env", "update", match.id, "--team", hoppscotch.teamId, "--name", envName, "--variables", variables],
      opts
    );
    return { id: match.id, name: envName, created: false, updated: true };
  }

  const created = runHoppscotchCliJson<TeamEnvironment>(
    ["env", "create", "--team", hoppscotch.teamId, "--name", envName, "--variables", variables],
    opts
  );

  return { id: created.id, name: created.name, created: true, updated: false };
}
