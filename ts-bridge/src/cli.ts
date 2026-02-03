import { loadConfig, applyConfigArgs } from "./config";
import { Bridge } from "./bridge";

const [command = "run", ...args] = process.argv.slice(2);

switch (command) {
  case "start":
  case "run":
    await runBridge(command === "start", args);
    break;
  case "help":
  case "--help":
  case "-h":
    printUsage();
    break;
  default:
    printUsage(`Unknown command: ${command}`);
    process.exit(1);
}

async function runBridge(promptConfig: boolean, args: string[]): Promise<void> {
  if (promptConfig || args.length > 0) {
    await applyConfigArgs(args);
  }
  const config = await loadConfig();
  console.log(`Bridge UID: ${config.uid}`);
  const bridge = new Bridge(config);
  await bridge.start();
  console.log("OpenClaw Bridge (bun) running. Press Ctrl+C to stop.");

  const shutdown = async () => {
    await bridge.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function printUsage(error?: string): void {
  if (error) {
    console.error(error);
  }
  console.log(
    `
Usage:
  bun run src/cli.ts start [webhook_url=ws://...]
  bun run src/cli.ts run [webhook_url=ws://...]

Notes:
  This Bun version runs in the foreground. Use Ctrl+C to stop.
`.trim(),
  );
}
