import { expect, test, describe, afterAll } from "bun:test";
import { serve } from "bun";
const hostMap = new Map([
  ["/service1", "127.0.0.1:7001"],
  ["/service2", "127.0.0.1:7002"],
]);
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

const app_server1 = serve({
  port: 7001,
  async fetch() {
    console.info("App Server 1");
    return new Response("This is service 1!");
  },
});
const app_server2 = serve({
  port: 7002,
  async fetch() {
    console.info("App Server 2");
    return new Response("This is service 2!");
  },
});
describe("reachable", () => {
  afterAll(() => {
    proxy_server.stop();
    app_server1.stop();
    app_server2.stop();
  });
  test("service 1", async () => {
    const response = fetch(`${protocol}://${hostname}/service1`)
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("This is service 1!");
  }, 100);
  test("service 2", async () => {
    const response = fetch(`${protocol}://${hostname}/service2`)
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("This is service 2!");
  }, 100);
});
