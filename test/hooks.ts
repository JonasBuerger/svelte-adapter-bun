import { beforeAll, afterAll } from "bun:test";
import { execSync } from "node:child_process";
import { Glob } from "bun";

beforeAll(() => {
  // global setup
  execSync("npm pack");
  const glob = new Glob("jonasbuerger-svelte-adapter-bun-*.*.*.tgz");
  for (const name of glob.scanSync()) {
    execSync(`mv ${name} ./test/project/adapter.tgz`);
  }
  execSync("cd ./test/project && bun install");
  execSync("ls");
});

afterAll(() => {
  // global teardown
});
