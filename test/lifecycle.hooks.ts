import { beforeAll, afterAll } from "bun:test";

beforeAll(async () => {
  await Bun.spawn({
    cmd: ["bun", "run", "build"],
    stdout: null,
  }).exited;
});

afterAll(() => {
  // global teardown
});
