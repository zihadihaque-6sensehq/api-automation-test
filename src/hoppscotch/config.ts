import { config } from "dotenv";
import path from "path";
import { PROJECT_ROOT } from "../config.js";
import { runHoppscotchCliJson } from "./runCli.js";

export interface HoppscotchSettings {
  graphqlEndpoint: string;
  sessionCookie: string;
  personalAccessToken: string;
  serverUrl: string;
  teamId: string;
  collectionId: string;
  envId: string;
  outputDir: string;
}

const DEFAULT_ENDPOINT = "https://hoppscotch.io/backend/graphql";

export function loadHoppscotchSettings(envPath?: string): HoppscotchSettings {
  const resolvedEnvPath = envPath ?? path.join(PROJECT_ROOT, ".env");
  config({ path: resolvedEnvPath, override: true });

  return {
    graphqlEndpoint: (process.env.HOPPSCOTCH_GRAPHQL_ENDPOINT ?? DEFAULT_ENDPOINT).trim(),
    sessionCookie: (process.env.HOPPSCOTCH_SESSION_COOKIE ?? "").trim(),
    personalAccessToken: (process.env.HOPPSCOTCH_PAT ?? "").trim(),
    serverUrl: (process.env.HOPPSCOTCH_SERVER_URL ?? "").trim(),
    teamId: (process.env.HOPPSCOTCH_TEAM_ID ?? "").trim(),
    collectionId: (process.env.HOPPSCOTCH_COLLECTION_ID ?? "").trim(),
    envId: (process.env.HOPPSCOTCH_ENV_ID ?? "").trim(),
    outputDir: path.join(PROJECT_ROOT, "output"),
  };
}

export function requireHoppscotchAuth(settings: HoppscotchSettings): void {
  const missing: string[] = [];
  if (!settings.sessionCookie) missing.push("HOPPSCOTCH_SESSION_COOKIE");
  if (!settings.graphqlEndpoint) missing.push("HOPPSCOTCH_GRAPHQL_ENDPOINT");
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}

export function requireHoppscotchRunAuth(settings: HoppscotchSettings): void {
  if (!settings.personalAccessToken) {
    throw new Error("Missing required environment variable: HOPPSCOTCH_PAT");
  }
}

export function hoppscotchCliOptions(settings: HoppscotchSettings) {
  return {
    endpoint: settings.graphqlEndpoint,
    cookie: settings.sessionCookie,
  };
}

export function resolveHoppscotchServerUrl(settings: HoppscotchSettings): string {
  if (settings.serverUrl) return settings.serverUrl.replace(/\/$/, "");

  try {
    const url = new URL(settings.graphqlEndpoint);
    if (url.hostname === "hoppscotch.io") return "";

    const backendPath = url.pathname.replace(/\/graphql\/?$/i, "");
    if (backendPath && backendPath !== "/") {
      return `${url.protocol}//${url.host}${backendPath}`.replace(/\/$/, "");
    }

    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

export function resolveHoppscotchEnvId(
  settings: HoppscotchSettings,
  envName = (process.env.HOPPSCOTCH_ENV_NAME ?? "Test").trim()
): string {
  if (settings.envId) return settings.envId;
  if (!settings.teamId) {
    throw new Error("HOPPSCOTCH_TEAM_ID is required to resolve environment ID.");
  }

  const envs = runHoppscotchCliJson<Array<{ id: string; name: string }>>(
    ["env", "list", "--team", settings.teamId],
    hoppscotchCliOptions(settings)
  );
  const match = envs.find((env) => env.name.toLowerCase() === envName.toLowerCase());

  if (!match) {
    throw new Error(
      `Environment "${envName}" not found in team ${settings.teamId}. ` +
        "Set HOPPSCOTCH_ENV_ID in .env or refresh HOPPSCOTCH_SESSION_COOKIE and re-run sync."
    );
  }

  return match.id;
}
