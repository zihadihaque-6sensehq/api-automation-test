import { buildLoginPayload } from "../testParser.js";
import {
  parseKeyValueCell,
  payloadLooksMalformed,
  resolveTestValue,
} from "./parseTestData.js";

export function buildTestPayload(
  testData: string,
  env: Record<string, string>
): Record<string, string> {
  const parsed = parseKeyValueCell(testData);
  if (!Object.keys(parsed).length || payloadLooksMalformed(parsed)) {
    return buildLoginPayload(testData, env);
  }

  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    payload[key] = resolveTestValue(String(value), env, key);
  }
  return payload;
}

export function variableNameForKey(key: string): string {
  const upper = key.toUpperCase();
  if (upper === "EMAILADDRESS" || upper === "EMAIL") return "EMAIL";
  if (upper === "PASSWORD") return "PASSWORD";
  return upper;
}

export function payloadToRequestVariables(
  payload: Record<string, string>
): Array<{ key: string; value: string; active: boolean }> {
  const variables: Array<{ key: string; value: string; active: boolean }> = [];
  const seen = new Set<string>();

  const add = (key: string, value: string) => {
    const upper = key.toUpperCase();
    if (seen.has(upper)) return;
    seen.add(upper);
    variables.push({ key, value, active: true });
  };

  for (const [key, value] of Object.entries(payload)) {
    add(variableNameForKey(key), value);
  }

  return variables;
}

export function payloadToHoppscotchBody(
  payload: Record<string, string>,
  method: string
): string {
  if (["GET", "HEAD", "DELETE"].includes(method.toUpperCase())) {
    return "";
  }

  return JSON.stringify(payload, null, 2);
}
