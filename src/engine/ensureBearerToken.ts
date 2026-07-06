import type { Settings } from "../config.js";
import type { HoppscotchSettings } from "../hoppscotch/config.js";
import { resolveHoppscotchEnvId } from "../hoppscotch/config.js";
import {
  buildTeamEnvironmentVariables,
  updateTeamEnvironmentById,
} from "./syncModuleEnvironment.js";
import { testEnvironmentName } from "./ensureModuleCollection.js";

function extractAccessToken(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";

  const body = payload as Record<string, unknown>;
  const direct = body.accessToken || body.token || body.access_token;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  if (body.data && typeof body.data === "object") {
    const data = body.data as Record<string, unknown>;
    const nested = data.accessToken || data.token || data.access_token;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }

  return "";
}

export async function loginForBearerToken(settings: Settings): Promise<string> {
  const url = `${settings.baseUrl}${settings.loginEndpoint}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      emailAddress: settings.email,
      password: settings.password,
    }),
  });

  const raw = await response.text();
  let payload: unknown;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Login response was not JSON (HTTP ${response.status}).`);
  }

  const token = extractAccessToken(payload);
  if (!token) {
    const message =
      payload &&
      typeof payload === "object" &&
      typeof (payload as Record<string, unknown>).message === "string"
        ? String((payload as Record<string, unknown>).message)
        : raw.slice(0, 200);
    throw new Error(
      `Login did not return an access token (HTTP ${response.status}): ${message}`
    );
  }

  return token;
}

export function updateTeamBearerToken(
  settings: Settings,
  hoppscotch: HoppscotchSettings,
  token: string
): void {
  if (!hoppscotch.teamId) {
    throw new Error("HOPPSCOTCH_TEAM_ID is required to update bearer_token.");
  }

  const envName = testEnvironmentName();
  const envId = resolveHoppscotchEnvId(hoppscotch, envName);
  const variables = buildTeamEnvironmentVariables(settings, token);

  updateTeamEnvironmentById(hoppscotch, envId, envName, variables);
}

export async function ensureBearerToken(
  settings: Settings,
  hoppscotch: HoppscotchSettings
): Promise<string> {
  const token = await loginForBearerToken(settings);
  updateTeamBearerToken(settings, hoppscotch, token);
  console.log(`Team environment "${testEnvironmentName()}" updated with bearer_token.`);
  return token;
}
