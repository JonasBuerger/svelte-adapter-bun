import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { proxy, test_project } from "./helper";
const proxy_map = new Map([["/test-project", "localhost:7001"]]);

describe("test project", () => {
  beforeAll(async () => {
    return await Promise.all([proxy.setup({ proxy_map }), test_project.setup()]);
  });

  afterAll(async () => {
    return await Promise.all([proxy.teardown(), test_project.teardown()]);
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
    const response = fetch(proxy.server.url.origin + "/test-project/hello.html")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("static hello\n");
  }, 100);

  test("route direct", async () => {
    const response = fetch("http://localhost:7001/")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toContain("Hello, World!");
  }, 100);

  test("route by proxy", async () => {
    const response = fetch(proxy.server.url.origin + "/test-project/")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toContain("Hello, World!");
  }, 100);
  test("GET route", async () => {
    const response = fetch(proxy.server.url.origin + "/test-project/api")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("get route: " + proxy.server.url.origin + "/api");
  }, 100);
  test("POST route", async () => {
    const response = fetch(proxy.server.url.origin + "/test-project/api", { method: "POST" })
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("post route: " + proxy.server.url.origin + "/api");
  }, 100);
});
