import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { type Server, sleep, spawn, spawnSync, type Subprocess } from "bun";
import { proxy } from "./helper";
const proxy_map = new Map([["/test-project", "localhost:7001"]]);
let proxy_server: Server;
let app_server: Subprocess<"ignore", "pipe", "inherit">;
let adapter_pack_name: string;

describe("test project", () => {
  beforeAll(async () => {
    await spawn({
      cmd: ["bun", "install"],
      cwd: process.cwd() + "/test/project",
      stdout: null,
    }).exited;
    await spawn({
      cmd: ["bun", "run", "build"],
      cwd: process.cwd() + "/test/project",
      stdout: null,
    }).exited;
    app_server = spawn({
      cmd: ["bun", "./build/index.js"],
      cwd: process.cwd() + "/test/project",
      env: {
        HOST: "localhost",
        PORT: "7001",
      },
    });
    proxy_server = proxy({ proxy_map });
    await sleep(2000);
  });

  afterAll(async () => {
    app_server.kill();
    proxy_server.stop(true);
    spawn({
      cmd: ["rm", "-f", "bun.lockb"],
      cwd: process.cwd() + "/test/project",
    });
    spawn({
      cmd: ["rm", "-rf", "build", ".svelte-kit"],
      cwd: process.cwd() + "/test/project",
    });
  });

  test("static file direct", async () => {
    const response = fetch("http://localhost:7001/hello.html")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("static hello\n");
  }, 100);

  test("static file proxy", async () => {
    const response = fetch(proxy_server.url.origin + "/test-project/hello.html")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("static hello\n");
  }, 100);
});
