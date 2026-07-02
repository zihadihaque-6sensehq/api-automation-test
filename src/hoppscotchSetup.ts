import { hoppscotchCliOptions, loadHoppscotchSettings, requireHoppscotchAuth } from "./hoppscotch/config.js";
import { runHoppscotchCli } from "./hoppscotch/runCli.js";

async function main(): Promise<number> {
  try {
    const settings = loadHoppscotchSettings();
    requireHoppscotchAuth(settings);
    const opts = hoppscotchCliOptions(settings);

    runHoppscotchCli(
      ["auth", "set-endpoint", settings.graphqlEndpoint],
      opts
    );
    runHoppscotchCli(["auth", "set-cookie", settings.sessionCookie], opts);

    const defaultArgs = ["auth", "set-default"];
    if (settings.teamId) defaultArgs.push("--team", settings.teamId);
    if (settings.collectionId) defaultArgs.push("--collection", settings.collectionId);
    if (settings.teamId || settings.collectionId) {
      runHoppscotchCli(defaultArgs, opts);
    }

    const status = runHoppscotchCli(["auth", "status", "--json"], opts);
    console.log("Hoppscotch CLI configured successfully.");
    console.log(status);
    return 0;
  } catch (error) {
    console.error(`Hoppscotch setup failed: ${error instanceof Error ? error.message : error}`);
    return 1;
  }
}

const exitCode = await main();
process.exit(exitCode);
