import { loadSettings } from "./config.js";
import { SheetClient } from "./sheetClient.js";

async function main(): Promise<number> {
  try {
    const settings = loadSettings();
    const info = await new SheetClient(settings).connect();
    console.log("Connected to Google Sheet successfully.");
    console.log(JSON.stringify(info, null, 2));
    return 0;
  } catch (error) {
    console.error(`Connection failed: ${error instanceof Error ? error.message : error}`);
    return 1;
  }
}

const exitCode = await main();
process.exit(exitCode);
