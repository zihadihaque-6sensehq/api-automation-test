import { loadSettings } from "./config.js";
import {
  hoppscotchCliOptions,
  loadHoppscotchSettings,
  requireHoppscotchAuth,
} from "./hoppscotch/config.js";
import { runHoppscotchCliJson } from "./hoppscotch/runCli.js";

async function main(): Promise<number> {
  try {
    const hoppscotch = loadHoppscotchSettings();
    requireHoppscotchAuth(hoppscotch);

    if (!hoppscotch.teamId) {
      throw new Error("HOPPSCOTCH_TEAM_ID is required.");
    }

    const app = loadSettings();
    const loginUrl = `${app.baseUrl}${app.loginEndpoint}`;
    const body = JSON.stringify({
      emailAddress: "<<EMAIL>>",
      password: "<<PASSWORD>>",
    });

    const result = runHoppscotchCliJson<{ id: string; title: string }>(
      [
        "request",
        "create",
        "--team",
        hoppscotch.teamId,
        "--collection",
        hoppscotch.devCollectionId,
        "--title",
        "Automation Test - Login (valid credentials)",
        "--method",
        "POST",
        "--url",
        loginUrl,
        "--headers",
        JSON.stringify([
          { key: "Content-Type", value: "application/json", active: true },
        ]),
        "--body",
        body,
        "--body-type",
        "application/json",
        "--description",
        "Created by automation-testing script for Ops4 login QA.",
      ],
      hoppscotchCliOptions(hoppscotch)
    );

    console.log("Created test endpoint in DEV collection:");
    console.log(JSON.stringify(result, null, 2));
    console.error(`\nOpen Hoppscotch → Spudwire → DEV → "${result.title}"`);
    return 0;
  } catch (error) {
    console.error(`Failed to create endpoint: ${error instanceof Error ? error.message : error}`);
    return 1;
  }
}

const exitCode = await main();
process.exit(exitCode);
