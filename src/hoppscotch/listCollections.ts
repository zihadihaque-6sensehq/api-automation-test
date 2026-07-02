import { hoppscotchCliOptions, type HoppscotchSettings } from "./config.js";
import { runHoppscotchCliJson } from "./runCli.js";

export interface CollectionEntry {
  id: string;
  title: string;
  path: string;
  depth: number;
  parentId: string | null;
}

interface CollectionDetail {
  id: string;
  title: string;
  parentID?: string | null;
  children?: Array<{ id: string; title: string }>;
}

export async function listAllCollections(settings: HoppscotchSettings): Promise<CollectionEntry[]> {
  const opts = hoppscotchCliOptions(settings);
  const roots = runHoppscotchCliJson<Array<{ id: string; title: string }>>(
    ["collection", "list", "--team", settings.teamId],
    opts
  );

  const entries: CollectionEntry[] = [];

  for (const root of roots) {
    await walkCollection(root.id, root.title, "", null, 0, settings, entries);
  }

  return entries;
}

async function walkCollection(
  collectionId: string,
  title: string,
  parentPath: string,
  parentId: string | null,
  depth: number,
  settings: HoppscotchSettings,
  entries: CollectionEntry[]
): Promise<void> {
  const path = parentPath ? `${parentPath} / ${title}` : title;

  entries.push({
    id: collectionId,
    title,
    path,
    depth,
    parentId,
  });

  const detail = runHoppscotchCliJson<CollectionDetail>(
    ["collection", "get", collectionId],
    hoppscotchCliOptions(settings)
  );

  for (const child of detail.children ?? []) {
    await walkCollection(child.id, child.title, path, collectionId, depth + 1, settings, entries);
  }
}

export function formatEnvHints(entries: CollectionEntry[]): string {
  const lines = [
    "# Copy one of these into .env:",
    "# HOPPSCOTCH_COLLECTION_ID=<id>   # used by fetch/export scripts",
    "",
  ];

  for (const entry of entries) {
    const indent = "  ".repeat(entry.depth);
    lines.push(`# ${indent}${entry.path}`);
    lines.push(`HOPPSCOTCH_COLLECTION_ID=${entry.id}`);
    lines.push("");
  }

  return lines.join("\n");
}
