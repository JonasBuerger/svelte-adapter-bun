import { expect, test, describe, afterAll, beforeAll } from "bun:test";
import { serve, type Server } from "bun";
import { getProxy } from "./helper";

const proxy_map = new Map([
  ["/service1", "localhost:7005"],
  ["/service2", "localhost:7006"],
]);
let app_server1: Server;
let app_server2: Server;

describe("mock proxy for tests", () => {
  let proxy;

  beforeAll(async () => {
    proxy = getProxy();
    await proxy.setup({ proxy_map, port: 7004 });
    app_server1 = serve({
      port: 7005,
      async fetch() {
        return new Response("This is service 1!");
      },
    });
    app_server2 = serve({
      port: 7006,
      async fetch() {
        return new Response("This is service 2!");
      },
    });
  });

  afterAll(async () => {
    await proxy.teardown();
    app_server1.stop(true);
    app_server2.stop(true);
  });

  test("service 1 direct", async () => {
    const response = fetch("http://localhost:7005/")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("This is service 1!");
  }, 100);

  test("service 2 direct", async () => {
    const response = fetch("http://localhost:7006/")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("This is service 2!");
  }, 100);

  test("service 1 proxy", async () => {
    const response = fetch(proxy.server.url.origin + "/service1")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("This is service 1!");
  }, 100);

  test("service 2 proxy", async () => {
    const response = fetch(proxy.server.url.origin + "/service2")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("This is service 2!");
  }, 100);
});
