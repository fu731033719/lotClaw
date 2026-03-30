import { createRuntimeBanner } from "@lotclaw/agent-core";
import { loadAppConfig } from "@lotclaw/shared-config";

const config = loadAppConfig();

console.log(createRuntimeBanner("api"));
console.log(`API placeholder listening on port ${config.apiPort}`);

