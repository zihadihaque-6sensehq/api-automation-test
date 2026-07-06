import type { Settings } from "../config.js";
import type { HoppscotchSettings } from "../hoppscotch/config.js";
import { testEnvironmentName } from "./ensureModuleCollection.js";
import { hoppscotchCliOptions } from "../hoppscotch/config.js";
import { runHoppscotchCliJson } from "../hoppscotch/runCli.js";

interface TeamEnvironment {
  id: string;
  name: string;
}

export interface SyncEnvironmentResult {
  id: string;
  name: string;
  created: boolean;
  updated: boolean;
}

export function buildTeamEnvironmentVariables(
  settings: Settings,
  bearerToken = ""
): string {
  return JSON.stringify([
    { key: "BASE_URL", value: settings.baseUrl, secret: false },
    { key: "base_url", value: settings.baseUrl, secret: false },
    { key: "LOGIN_ENDPOINT", value: settings.loginEndpoint, secret: false },
    { key: "EMAIL", value: settings.email, secret: false },
    { key: "PASSWORD", value: settings.password, secret: true },
    { key: "VALID_EMAIL", value: settings.email, secret: false },
    { key: "VALID_PASSWORD", value: settings.password, secret: true },
    { key: "bearer_token", value: bearerToken, secret: true },
    { key: "BEARER_TOKEN", value: bearerToken, secret: true },
  ]);
}

function listTeamEnvironments(hoppscotch: HoppscotchSettings): TeamEnvironment[] {
  return runHoppscotchCliJson<TeamEnvironment[]>(
    ["env", "list", "--team", hoppscotch.teamId],
    hoppscotchCliOptions(hoppscotch)
  );
}

export function updateTeamEnvironmentById(
  hoppscotch: HoppscotchSettings,
  envId: string,
  name: string,
  variables: string
): void {
  updateTeamEnvironment(hoppscotch, envId, name, variables);
}

function updateTeamEnvironment(
  hoppscotch: HoppscotchSettings,
  envId: string,
  name: string,
  variables: string
): void {
  runHoppscotchCliJson<TeamEnvironment>(
    [
      "env",
      "update",
      envId,
      "--team",
      hoppscotch.teamId,
      "--name",
      name,
      "--variables",
      variables,
    ],
    hoppscotchCliOptions(hoppscotch)
  );
}

function readExistingBearerToken(hoppscotch: HoppscotchSettings, envId: string): string {
  try {
    const detail = runHoppscotchCliJson<{ variables: string }>(
      ["env", "get", envId, "--team", hoppscotch.teamId],
      hoppscotchCliOptions(hoppscotch)
    );
    const vars = JSON.parse(detail.variables || "[]") as Array<{ key: string; value?: string }>;
    const hit = vars.find((item) => item.key === "bearer_token" || item.key === "BEARER_TOKEN");
    return (hit?.value || "").trim();
  } catch {
    return "";
  }
}

export function syncModuleEnvironment(
  settings: Settings,
  hoppscotch: HoppscotchSettings
): SyncEnvironmentResult {
  if (!hoppscotch.teamId) {
    throw new Error("HOPPSCOTCH_TEAM_ID is required.");
  }

  const resolvedName = testEnvironmentName();
  const existing = listTeamEnvironments(hoppscotch);
  const byName = existing.find((env) => env.name.toLowerCase() === resolvedName.toLowerCase());
  const configuredId = (hoppscotch.envId || process.env.HOPPSCOTCH_ENV_ID || "").trim();

  let bearerToken = "";
  if (byName) {
    bearerToken = readExistingBearerToken(hoppscotch, byName.id);
  } else if (configuredId) {
    bearerToken = readExistingBearerToken(hoppscotch, configuredId);
  }

  const variables = buildTeamEnvironmentVariables(settings, bearerToken);

  if (byName) {
    updateTeamEnvironment(hoppscotch, byName.id, resolvedName, variables);
    return { id: byName.id, name: resolvedName, created: false, updated: true };
  }

  if (configuredId) {
    updateTeamEnvironment(hoppscotch, configuredId, resolvedName, variables);
    return { id: configuredId, name: resolvedName, created: false, updated: true };
  }

  const created = runHoppscotchCliJson<TeamEnvironment>(
    [
      "env",
      "create",
      "--team",
      hoppscotch.teamId,
      "--name",
      resolvedName,
      "--variables",
      variables,
    ],
    hoppscotchCliOptions(hoppscotch)
  );

  return { id: created.id, name: created.name, created: true, updated: false };
}
