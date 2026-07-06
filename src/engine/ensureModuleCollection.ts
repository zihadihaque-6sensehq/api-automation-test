import type { HoppscotchSettings } from "../hoppscotch/config.js";
import { hoppscotchCliOptions } from "../hoppscotch/config.js";
import { runHoppscotchCliJson } from "../hoppscotch/runCli.js";
import type { ModuleConfig } from "./moduleRegistry.js";

interface CollectionNode {
  id: string;
  title: string;
}

interface CollectionDetail {
  id: string;
  title: string;
  children?: CollectionNode[];
}

function testFolderName(): string {
  return (process.env.HOPPSCOTCH_TEST_FOLDER_NAME ?? "TEST").trim();
}

export function testEnvironmentName(): string {
  return (process.env.HOPPSCOTCH_ENV_NAME ?? "Test").trim();
}

export function worksheetToCollectionSlug(worksheet: string): string {
  const fromModule = worksheet
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return fromModule || "module";
}

function titlesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function findChildByTitle(children: CollectionNode[], ...candidates: string[]): CollectionNode | undefined {
  for (const candidate of candidates) {
    const match = children.find((child) => titlesMatch(child.title, candidate));
    if (match) return match;
  }
  return undefined;
}

function resolveTestFolderId(hoppscotch: HoppscotchSettings): string {
  const configured = (process.env.HOPPSCOTCH_TEST_FOLDER_ID ?? "").trim();
  if (configured) return configured;

  const opts = hoppscotchCliOptions(hoppscotch);
  const folderName = testFolderName();
  const roots = runHoppscotchCliJson<CollectionNode[]>(
    ["collection", "list", "--team", hoppscotch.teamId],
    opts
  );

  const rootMatch = roots.find((item) => titlesMatch(item.title, folderName));
  if (rootMatch) return rootMatch.id;

  for (const root of roots) {
    const detail = runHoppscotchCliJson<CollectionDetail>(
      ["collection", "get", root.id],
      opts
    );
    const nested = findChildByTitle(detail.children ?? [], folderName);
    if (nested) return nested.id;
  }

  const created = runHoppscotchCliJson<CollectionNode>(
    ["collection", "create", "--team", hoppscotch.teamId, "--title", folderName],
    opts
  );
  console.log(`Created Hoppscotch folder "${folderName}" (${created.id})`);
  return created.id;
}

function listTestFolderChildren(
  testFolderId: string,
  hoppscotch: HoppscotchSettings
): CollectionNode[] {
  const detail = runHoppscotchCliJson<CollectionDetail>(
    ["collection", "get", testFolderId],
    hoppscotchCliOptions(hoppscotch)
  );
  return detail.children ?? [];
}

function createModuleCollection(
  testFolderId: string,
  title: string,
  hoppscotch: HoppscotchSettings
): string {
  const created = runHoppscotchCliJson<CollectionNode>(
    ["collection", "create", "--parent", testFolderId, "--title", title],
    hoppscotchCliOptions(hoppscotch)
  );
  console.log(`Created Hoppscotch collection ${testFolderName()} → ${title} (${created.id})`);
  return created.id;
}

export function ensureModuleCollection(
  module: ModuleConfig,
  hoppscotch: HoppscotchSettings
): string {
  if (module.collectionId) return module.collectionId;

  if (!hoppscotch.teamId) {
    throw new Error("HOPPSCOTCH_TEAM_ID is required to create module collections.");
  }

  const testFolderId = resolveTestFolderId(hoppscotch);
  const slug = worksheetToCollectionSlug(module.worksheet);
  const children = listTestFolderChildren(testFolderId, hoppscotch);

  const existing = findChildByTitle(children, slug, module.worksheet, module.moduleId);
  if (existing) {
    console.log(
      `[${module.moduleId}] Using collection ${testFolderName()} → "${existing.title}" (${existing.id})`
    );
    return existing.id;
  }

  return createModuleCollection(testFolderId, slug, hoppscotch);
}

export async function resolveModuleCollections(
  modules: ModuleConfig[],
  hoppscotch: HoppscotchSettings
): Promise<ModuleConfig[]> {
  const envName = testEnvironmentName();
  const resolved: ModuleConfig[] = [];

  for (const module of modules) {
    const collectionId = ensureModuleCollection(module, hoppscotch);
    resolved.push({ ...module, collectionId, envName, envId: "" });
  }

  return resolved;
}
