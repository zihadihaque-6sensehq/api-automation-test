import { loadSettings } from "./config.js";
import { settingsForModule } from "./engine/moduleRegistry.js";
import type { ModuleConfig } from "./engine/moduleRegistry.js";
import {
  SheetClient,
  isBackendCategory,
  isQueuedApiTest,
} from "./sheetClient.js";

async function inspect(worksheet: string): Promise<void> {
  const base = loadSettings();
  const module: ModuleConfig = {
    moduleId: worksheet,
    worksheet,
    collectionId: "",
    envName: `${worksheet} - Test`,
    envId: "",
  };
  const settings = settingsForModule(base, module);
  const client = new SheetClient(settings);
  const rows = await client.getWorksheetRows(worksheet);
  const headerRow = settings.headerRow;
  const headers = (rows[headerRow - 1] ?? []).map((h) => h.trim());

  console.log(`\n=== ${worksheet} (HEADER_ROW=${headerRow}) ===`);
  console.log("Headers:", headers.filter(Boolean).join(" | "));
  console.log(
    'Has "API Status":',
    headers.some((h) => h.toLowerCase() === "api status"),
    '| Has "API Endpoint":',
    headers.some((h) => h.toLowerCase() === "api endpoint")
  );

  const all = await client.fetchAllTests();
  const api = all.filter((t) => isBackendCategory(t.category, settings.testCategories));
  const queued = api.filter((t) => isQueuedApiTest(t.apiStatus));

  console.log(`Total rows with Test ID: ${all.length}`);
  console.log(`Category API/Both: ${api.length}`);
  console.log(`Queued (Not_implemented/empty): ${queued.length}\n`);

  for (const test of api) {
    const q = isQueuedApiTest(test.apiStatus) ? "QUEUE" : "skip";
    console.log(
      `  [${q}] row ${test.rowNumber} ${test.testId} | Category="${test.category}" | API Status="${test.apiStatus || "(empty)"}" | Endpoint="${test.endpoint || "(empty)"}"`
    );
  }
}

async function main(): Promise<void> {
  const base = loadSettings();
  const tabs = await new SheetClient(base).listWorksheets();
  const targets = tabs.filter((t) => /sign in|registration/i.test(t));
  for (const tab of targets) await inspect(tab);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
