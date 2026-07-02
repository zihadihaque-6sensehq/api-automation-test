import { config } from "dotenv";
import path from "path";
import { PROJECT_ROOT } from "../config.js";

export interface HoppscotchSettings {
  graphqlEndpoint: string;
  sessionCookie: string;
  teamId: string;
  collectionId: string;
  devCollectionId: string;
  outputDir: string;
}

const DEFAULT_ENDPOINT = "https://hoppscotch.io/backend/graphql";

export function loadHoppscotchSettings(envPath?: string): HoppscotchSettings {
  const resolvedEnvPath = envPath ?? path.join(PROJECT_ROOT, ".env");
  config({ path: resolvedEnvPath });

  return {
    graphqlEndpoint: (process.env.HOPPSCOTCH_GRAPHQL_ENDPOINT ?? DEFAULT_ENDPOINT).trim(),
    sessionCookie: (process.env.HOPPSCOTCH_SESSION_COOKIE ?? "").trim(),
    teamId: (process.env.HOPPSCOTCH_TEAM_ID ?? "").trim(),
    collectionId: (process.env.HOPPSCOTCH_COLLECTION_ID ?? "").trim(),
    devCollectionId: (process.env.HOPPSCOTCH_DEV_COLLECTION_ID ?? "cml9efio000nt10pf72qy88d5").trim(),
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

export function hoppscotchCliOptions(settings: HoppscotchSettings) {
  return {
    endpoint: settings.graphqlEndpoint,
    cookie: settings.sessionCookie,
  };
}
