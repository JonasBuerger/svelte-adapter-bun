import { beforeAll, afterAll } from "bun:test";

beforeAll(async () => {
  await Bun.spawn({
    cmd: ["bun", "run", "build"],
    stdout: "inherit",
  }).exited;
  await Bun.spawn({
    cmd: ["bun", "install"],
    cwd: process.cwd() + "/test/project",
    stdout: "inherit",
  }).exited;
});

afterAll(() => {
  // global teardown
});
