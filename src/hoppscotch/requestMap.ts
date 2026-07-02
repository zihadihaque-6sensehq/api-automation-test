import type { HoppscotchSettings } from "./config.js";
import { hoppscotchCliOptions } from "./config.js";
import { requestTitleMatchesTestId } from "./signInRequests.js";
import { runHoppscotchCliJson } from "./runCli.js";

export interface CollectionRequest {
  id: string;
  title: string;
}

const LEGACY_REQUEST_TITLES: Record<string, string[]> = {
  TC_010: ["Sign in- Valid"],
};

export function listCollectionRequests(hoppscotch: HoppscotchSettings): CollectionRequest[] {
  if (!hoppscotch.collectionId) {
    throw new Error("HOPPSCOTCH_COLLECTION_ID is required.");
  }

  return runHoppscotchCliJson<CollectionRequest[]>(
    ["request", "list", "--collection", hoppscotch.collectionId],
    hoppscotchCliOptions(hoppscotch)
  );
}

export function findRequestIdForTest(
  testId: string,
  requests: CollectionRequest[]
): string | null {
  const match = requests.find((item) => requestTitleMatchesTestId(item.title, testId));
  if (match) return match.id;

  const legacyTitles = LEGACY_REQUEST_TITLES[testId] ?? [];
  const legacy = requests.find((item) =>
    legacyTitles.some((title) => item.title.trim().toLowerCase() === title.toLowerCase())
  );

  return legacy?.id ?? null;
}
