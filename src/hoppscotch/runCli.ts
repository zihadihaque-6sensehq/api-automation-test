import { execFileSync } from "child_process";
import path from "path";
import { PROJECT_ROOT } from "../config.js";

export interface HoppscotchCliOptions {
  json?: boolean;
  cookie?: string;
  endpoint?: string;
}

export function runHoppscotchCli(
  args: string[],
  options: HoppscotchCliOptions = {}
): string {
  const bin = path.join(PROJECT_ROOT, "node_modules", ".bin", "agent-hoppscotch");
  const fullArgs: string[] = [];

  if (options.json) fullArgs.push("--json");
  if (options.endpoint) fullArgs.push("--endpoint", options.endpoint);
  if (options.cookie) fullArgs.push("--cookie", options.cookie);
  fullArgs.push(...args);

  try {
    return execFileSync(bin, fullArgs, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const err = error as { stderr?: string; stdout?: string; message?: string };
    const message = err.stderr?.trim() || err.stdout?.trim() || err.message || "CLI failed";
    throw new Error(message);
  }
}

export function runHoppscotchCliJson<T>(
  args: string[],
  options: HoppscotchCliOptions = {}
): T {
  const output = runHoppscotchCli(args, { ...options, json: true });
  return JSON.parse(output) as T;
}
