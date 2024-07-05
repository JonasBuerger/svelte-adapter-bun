import { beforeAll, afterAll } from "bun:test";
import { execSync } from "node:child_process";
let packName = "";

beforeAll(() => {
  // global setup
  const packOut = execSync("npm pack --pack-destination ./test/project").toString().split("\n");
  packName = packOut.at(packOut.length - 2);
  execSync("cd ./test/project && bun remove @jonasbuerger/svelte-adapter-bun");
  execSync(`cd ./test/project && bun add -d "${packName}"`);
  execSync("cd ./test/project && bun run build");
});

afterAll(() => {
  execSync(`rm -f ./test/project/"${packName}"`);
});
