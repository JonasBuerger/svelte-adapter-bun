import { beforeAll, afterAll } from "bun:test";

beforeAll(async () => {
  await Bun.spawn({
    cmd: ["bun", "run", "build"],
    stdout: "inherit",
  }).exited;
});

afterAll(() => {
  // global teardown
});
