import { expect, test, describe } from "bun:test";
import { serve } from "bun";
const hostMap = new Map([
  ["/service1", "127.0.0.1:7001"],
  ["/service2", "127.0.0.1:7002"],
]);
const hostname = "localhost:7000";
const protocol = "http";

serve({
  port: 7000,
  async fetch(request) {
    const requestUrl = new URL(request.url);
    let matched = false;
    hostMap.forEach((host, proxyPath) => {
      if (requestUrl.pathname.startsWith(proxyPath)) {
        requestUrl.host = host;
        matched = true;
      }
    }, requestUrl);

    const proxyRequest = new Request(requestUrl, request);
    proxyRequest.headers.set("X-Forwarded-Proto", protocol);
    proxyRequest.headers.set("X-Forwarded-Host", hostname);
    proxyRequest.headers.set("X-Forwarded-For", "8.8.8.8");
    proxyRequest.headers.set("Origin", `${protocol}://${hostname}`);
    return fetch(proxyRequest, { redirect: "manual" });
  },
});
serve({
  port: 7001,
  async fetch() {
    return new Response("This is service 1!");
  },
});
serve({
  port: 7002,
  async fetch() {
    return new Response("This is service 2!");
  },
});
describe("reachable", () => {
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
