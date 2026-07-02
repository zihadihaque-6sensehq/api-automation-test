import {
  hoppscotchCliOptions,
  loadHoppscotchSettings,
  requireHoppscotchAuth,
} from "./hoppscotch/config.js";
import { runHoppscotchCliJson } from "./hoppscotch/runCli.js";

interface CollectionSummary {
  id: string;
  title: string;
  path?: string;
}

interface CollectionDetail {
  id: string;
  title: string;
  children?: Array<{ id: string; title: string }>;
}

async function main(): Promise<number> {
  try {
    const settings = loadHoppscotchSettings();
    requireHoppscotchAuth(settings);

    if (!settings.teamId) {
      throw new Error("HOPPSCOTCH_TEAM_ID is required.");
    }

    const targetName = (process.env.HOPPSCOTCH_COLLECTION_NAME ?? "API Automation").trim();
    const opts = hoppscotchCliOptions(settings);

    const fromFind = runHoppscotchCliJson<CollectionSummary[]>(
      ["collection", "find", targetName, "--team", settings.teamId],
      opts
    );

    const exact = fromFind.filter(
      (item) => item.title.trim().toLowerCase() === targetName.toLowerCase()
    );
    const matches = exact.length ? exact : fromFind;

    if (matches.length) {
      console.log(JSON.stringify(matches, null, 2));
      console.error(`\nSet in .env:\nHOPPSCOTCH_COLLECTION_ID=${matches[0].id}`);
      console.error(`Then run: ./scripts/hoppscotch_setup.sh`);
      return 0;
    }

    const roots = runHoppscotchCliJson<Array<{ id: string; title: string }>>(
      ["collection", "list", "--team", settings.teamId],
      opts
    );

    const nested = await searchNestedCollections(roots, targetName, opts);
    if (nested.length) {
      console.log(JSON.stringify(nested, null, 2));
      console.error(`\nSet in .env:\nHOPPSCOTCH_COLLECTION_ID=${nested[0].id}`);
      console.error(`Then run: ./scripts/hoppscotch_setup.sh`);
      return 0;
    }

    console.error(`No collection named "${targetName}" found in team ${settings.teamId}.`);
    console.error("Confirm it exists under Spudwire in Hoppscotch, then run this again.");
    return 1;
  } catch (error) {
    console.error(`Failed to find collection: ${error instanceof Error ? error.message : error}`);
    return 1;
  }
}

async function searchNestedCollections(
  roots: Array<{ id: string; title: string }>,
  targetName: string,
  opts: ReturnType<typeof hoppscotchCliOptions>,
  parentPath = ""
): Promise<CollectionSummary[]> {
  const matches: CollectionSummary[] = [];
  const wanted = targetName.toLowerCase();

  for (const root of roots) {
    const path = parentPath ? `${parentPath} / ${root.title}` : root.title;
    if (root.title.trim().toLowerCase() === wanted) {
      matches.push({ id: root.id, title: root.title, path });
    }

    const detail = runHoppscotchCliJson<CollectionDetail>(
      ["collection", "get", root.id],
      opts
    );

    if (detail.children?.length) {
      const childMatches = await searchNestedCollections(detail.children, targetName, opts, path);
      matches.push(...childMatches);
    }
  }

  return matches;
}

const exitCode = await main();
process.exit(exitCode);
