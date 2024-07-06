import { expect, test, describe, afterAll, beforeAll } from "bun:test";
import { serve, type Server } from "bun";
import { proxy } from "./helper";

const proxy_map = new Map([
  ["/service1", "localhost:7001"],
  ["/service2", "localhost:7002"],
]);
let proxy_server: Server;
let app_server1: Server;
let app_server2: Server;

describe("reachable", () => {
  beforeAll(() => {
    proxy_server = proxy({ proxy_map });
    app_server1 = serve({
      port: 7001,
      async fetch() {
        console.info("App Server 1");
        return new Response("This is service 1!");
      },
    });
    app_server2 = serve({
      port: 7002,
      async fetch() {
        console.info("App Server 2");
        return new Response("This is service 2!");
      },
    });
  });
  afterAll(() => {
    proxy_server.stop(true);
    app_server1.stop(true);
    app_server2.stop(true);
  });
  test("service 1 direct", async () => {
    const response = fetch("http://localhost:7001/")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("This is service 1!");
  }, 100);
  test("service 2 direct", async () => {
    const response = fetch("http://localhost:7002/")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("This is service 2!");
  }, 100);
  test("service 1 proxy", async () => {
    const response = fetch(proxy_server.url.origin + "/service1")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("This is service 1!");
  }, 100);
  test("service 2 proxy", async () => {
    const response = fetch(proxy_server.url.origin + "/service2")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("This is service 2!");
  }, 100);
});
