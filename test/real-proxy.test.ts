import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { serve, spawn, spawnSync, type Subprocess } from "bun";
const hostMap = new Map([["/test-project", "localhost:7001"]]);
const hostname = "localhost:7000";
const protocol = "http";
const fetch_handler = async (request: Request) => {
  const requestUrl = new URL(request.url);
  let matched = false;
  hostMap.forEach((host, proxyPath) => {
    if (requestUrl.pathname.startsWith(proxyPath)) {
      requestUrl.host = host;
      requestUrl.pathname = requestUrl.pathname.replace(new RegExp(`^${proxyPath}`), "");
      matched = true;
    }
  }, requestUrl);

  if (!matched) {
    return new Response("Not Found", { status: 404 });
  }

  const proxyRequest = new Request(requestUrl, request);
  proxyRequest.headers.set("X-Forwarded-Proto", protocol);
  proxyRequest.headers.set("X-Forwarded-Host", hostname);
  proxyRequest.headers.set("X-Forwarded-For", "8.8.8.8");
  proxyRequest.headers.set("Origin", `${protocol}://${hostname}`);
  console.info("Proxy received:", request.url);
  console.info("Proxied to:", proxyRequest.url);
  return fetch(proxyRequest, { redirect: "manual" });
};
const proxy_server = serve({ port: 7000, fetch: fetch_handler });
let app_server: Subprocess<"ignore", "pipe", "inherit">;
let adapter_pack_name: string;

describe("test project", () => {
  beforeAll(async () => {
    adapter_pack_name =
      "jonasbuerger-svelte-adapter-bun-" +
      spawnSync(["bun", "x", "semantic-release", "--version"]).stdout.toString().replace("\n", "") +
      ".tgz";
    await spawn({
      cmd: ["npm", "pack", "--pack-destination", "./test/project"],
    }).exited;
    await spawn({
      cmd: ["bun", "remove", "@jonasbuerger/svelte-adapter-bun"],
      cwd: process.cwd() + "/test/project",
    }).exited;
    await spawn({
      cmd: ["bun", "add", "-d", adapter_pack_name],
      cwd: process.cwd() + "/test/project",
    }).exited;
    await spawn({
      cmd: ["bun", "run", "build"],
      cwd: process.cwd() + "/test/project",
    }).exited;

    app_server = spawn({
      cmd: ["bun", "run", "preview"],
      cwd: process.cwd() + "/test/project",
      env: {
        HOST: "localhost",
        PORT: "7001",
      },
    });
    const decoder = new TextDecoder();
    for await (const chunk of app_server.stdout) {
      console.log(decoder.decode(chunk));
    }
  });
  afterAll(async () => {
    app_server.kill();
    proxy_server.stop();
    await spawn({
      cmd: ["rm", "-f", adapter_pack_name, "bun.lockb"],
      cwd: process.cwd() + "/test/project",
    }).exited;
  });
  test("static file", async () => {
    const response = fetch(`${protocol}://${hostname}/test-project/hello.html`)
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("static hello\n");
  }, 100);
});
