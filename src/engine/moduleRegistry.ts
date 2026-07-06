import type { Settings } from "../config.js";
import type { HoppscotchSettings } from "../hoppscotch/config.js";
import {
  resolveModuleCollections,
  testEnvironmentName,
  worksheetToCollectionSlug,
} from "./ensureModuleCollection.js";
import { SheetClient } from "../sheetClient.js";

export interface ModuleConfig {
  moduleId: string;
  worksheet: string;
  collectionId: string;
  envName: string;
  envId: string;
}

function parseSkipWorksheets(): Set<string> {
  const raw = (process.env.SHEET_SKIP_WORKSHEETS ?? "").trim();
  if (!raw) return new Set();

  return new Set(
    raw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
  );
}

function scanAllWorksheets(): boolean {
  return !["0", "false", "no"].includes(
    (process.env.AGENT_ALL_WORKSHEETS ?? "true").toLowerCase()
  );
}

function moduleFromWorksheet(worksheet: string): ModuleConfig {
  const slug = worksheetToCollectionSlug(worksheet);

  return {
    moduleId: slug,
    worksheet,
    collectionId: "",
    envName: testEnvironmentName(),
    envId: (process.env.HOPPSCOTCH_ENV_ID ?? "").trim(),
  };
}

async function discoverWorksheetNames(settings: Settings): Promise<string[]> {
  const client = new SheetClient(settings);
  const skip = parseSkipWorksheets();

  if (!scanAllWorksheets()) {
    return [settings.worksheetName];
  }

  const titles = await client.listWorksheets();
  return titles.filter((title) => !skip.has(title.trim().toLowerCase()));
}

async function filterModulesWithApiTests(
  settings: Settings,
  modules: ModuleConfig[]
): Promise<ModuleConfig[]> {
  const withApi: ModuleConfig[] = [];

  for (const module of modules) {
    const moduleSettings = settingsForModule(settings, module);
    const apiTests = await new SheetClient(moduleSettings).fetchApiTests();
    if (apiTests.length) withApi.push(module);
  }

  return withApi;
}

async function filterModulesWithQueuedTests(
  settings: Settings,
  modules: ModuleConfig[]
): Promise<ModuleConfig[]> {
  const withQueue: ModuleConfig[] = [];

  for (const module of modules) {
    const moduleSettings = settingsForModule(settings, module);
    const pending = await new SheetClient(moduleSettings).fetchPendingApiTests(false);
    if (pending.length) withQueue.push(module);
  }

  return withQueue;
}

export async function loadModules(
  settings: Settings,
  hoppscotch?: HoppscotchSettings,
  options?: { onlyWithQueuedTests?: boolean; onlyWithApiTests?: boolean }
): Promise<ModuleConfig[]> {
  const onlyWithQueued = options?.onlyWithQueuedTests ?? false;
  const onlyWithApi = options?.onlyWithApiTests ?? false;
  const worksheetNames = await discoverWorksheetNames(settings);
  let modules = worksheetNames.map((worksheet) => moduleFromWorksheet(worksheet));

  if (onlyWithQueued) {
    modules = await filterModulesWithQueuedTests(settings, modules);
  } else if (onlyWithApi) {
    modules = await filterModulesWithApiTests(settings, modules);
  }

  if (!hoppscotch) return modules;

  const resolved = await resolveModuleCollections(modules, hoppscotch);

  // Shared team env — do not carry a stale per-module env id from .env
  const sharedEnvId = (process.env.HOPPSCOTCH_ENV_ID ?? "").trim();
  return resolved.map((module) => ({ ...module, envId: sharedEnvId }));
}

export function settingsForModule(settings: Settings, module: ModuleConfig): Settings {
  return { ...settings, worksheetName: module.worksheet };
}
