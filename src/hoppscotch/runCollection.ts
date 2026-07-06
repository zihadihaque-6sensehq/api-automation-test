import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import type { Settings } from "../config.js";
import { ensureDir, PROJECT_ROOT } from "../config.js";
import { testEnvironmentName } from "../engine/ensureModuleCollection.js";
import type { HoppscotchSettings } from "./config.js";

export interface HoppscotchCollectionRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  junitPath: string;
}

const HOPP_NODE_HINT =
  "Hoppscotch CLI requires Node.js 22.x (isolated-vm does not build on Node 25+). " +
  "Use `nvm use 22` or run in CI with Node 22.";

function hoppBinaryPath(): string {
  const binName = process.platform === "win32" ? "hopp.cmd" : "hopp";
  return path.join(PROJECT_ROOT, "node_modules", ".bin", binName);
}

function hoppPathEnv(): NodeJS.ProcessEnv {
  const localNodeBin = path.join(PROJECT_ROOT, ".node", "bin");
  if (!fs.existsSync(path.join(localNodeBin, "node"))) {
    return process.env;
  }

  return {
    ...process.env,
    PATH: `${localNodeBin}${path.delimiter}${process.env.PATH ?? ""}`,
  };
}

export function ensureHoppCliAvailable(): void {
  const bin = hoppBinaryPath();
  if (!fs.existsSync(bin)) {
    throw new Error(
      `Hoppscotch CLI not found at ${bin}. Install dependencies with: npm install`
    );
  }

  try {
    execFileSync(bin, ["--version"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: hoppPathEnv(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("isolated_vm") || message.includes("isolated-vm")) {
      throw new Error(`Hoppscotch CLI failed to start. ${HOPP_NODE_HINT}`);
    }
    throw new Error(`Hoppscotch CLI failed to start: ${message}`);
  }
}

export function writeHoppscotchRunEnvironment(
  settings: Settings,
  hoppscotch: HoppscotchSettings
): string {
  const envPath = path.join(hoppscotch.outputDir, "hoppscotch-run", "run-env.json");
  ensureDir(path.dirname(envPath));

  const payload = {
    name: testEnvironmentName(),
    variables: [
      { key: "BASE_URL", value: settings.baseUrl },
      { key: "base_url", value: settings.baseUrl },
      { key: "LOGIN_ENDPOINT", value: settings.loginEndpoint },
      { key: "EMAIL", value: settings.email },
      { key: "PASSWORD", value: settings.password },
      { key: "VALID_EMAIL", value: settings.email },
      { key: "VALID_PASSWORD", value: settings.password },
      { key: "bearer_token", value: "" },
      { key: "BEARER_TOKEN", value: "" },
    ],
  };

  fs.writeFileSync(envPath, JSON.stringify(payload, null, 2), "utf-8");
  return envPath;
}

export function runHoppscotchCollection(
  hoppscotch: HoppscotchSettings,
  junitPath: string,
  environmentRef: string
): HoppscotchCollectionRunResult {
  ensureHoppCliAvailable();

  const args = [
    "test",
    hoppscotch.collectionId,
    "-e",
    environmentRef,
    "--token",
    hoppscotch.personalAccessToken,
    "--reporter-junit",
    junitPath,
  ];

  if (hoppscotch.serverUrl) {
    args.push("--server", hoppscotch.serverUrl);
  }

  const bin = hoppBinaryPath();
  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  try {
    stdout = execFileSync(bin, args, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
      env: hoppPathEnv(),
    });
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string; message?: string };
    exitCode = typeof err.status === "number" ? err.status : 1;
    stdout = err.stdout ?? "";
    stderr = err.stderr?.trim() || err.stdout?.trim() || err.message || "hopp test failed";

    if (!fs.existsSync(junitPath)) {
      if (stderr.includes("isolated_vm") || stderr.includes("isolated-vm")) {
        throw new Error(`Hoppscotch CLI failed to run collection. ${HOPP_NODE_HINT}`);
      }
      throw new Error(stderr);
    }
  }

  if (!fs.existsSync(junitPath)) {
    throw new Error(
      `Hoppscotch CLI did not produce a JUnit report at ${junitPath}. ${stderr || stdout}`
    );
  }

  return { exitCode, stdout: stdout.trim(), stderr: stderr.trim(), junitPath };
}
