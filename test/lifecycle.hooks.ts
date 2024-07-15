import { beforeAll, afterAll } from "bun:test";

beforeAll(async () => {
  let result = Bun.spawnSync({
    cmd: ["bun", "run", "build"],
  });
  if (result.exitCode !== 0) {
    console.info(result.stdout.toString());
    console.error(result.stderr.toString());
    throw new Error("Project build failed");
  }
  if (!(await Bun.file("test/project/bun.lockb").exists())) {
    result = Bun.spawnSync({
      cmd: ["bun", "install"],
      cwd: process.cwd() + "/test/project",
    });
    if (result.exitCode !== 0) {
      console.info(result.stdout.toString());
      console.error(result.stderr.toString());
      throw new Error("Test project install failed");
    }
  }
});

afterAll(() => {
  // global teardown
});
