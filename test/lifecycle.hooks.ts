import { beforeAll, afterAll } from "bun:test";

beforeAll(async () => {
  await Bun.spawn({
    cmd: ["bun", "run", "build"],
    stdout: "inherit",
  }).exited;
  if (!(await Bun.file("test/project/bun.lockb").exists())) {
    await Bun.spawn({
      cmd: ["bun", "install"],
      cwd: process.cwd() + "/test/project",
      stdout: "inherit",
    }).exited;
  }
});

afterAll(() => {
  // global teardown
});
