import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { getCerts, getProxy, getTestProject } from "./helper";
const proxy_map = new Map([["/test-project", "localhost:7003"]]);

describe("test project", () => {
  let proxy, test_project;

  beforeAll(async () => {
    proxy = getProxy();
    test_project = getTestProject();
    return await Promise.all([
      proxy.setup({ proxy_map, port: 7000 }),
      test_project.setup({ port: 7001 }),
    ]);
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

  test("page route direct", async () => {
    const response = fetch("http://localhost:7001/")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toContain("Hello, World!");
  }, 100);

  test("page route proxy", async () => {
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

describe("test project with tls", () => {
  let proxy, test_project, certs;

  beforeAll(async () => {
    proxy = getProxy();
    test_project = getTestProject();
    certs = getCerts();
    await certs.setup();
    return await Promise.all([
      proxy.setup({ proxy_map, tls: certs.tls, port: 7002 }),
      test_project.setup({ port: 7003 }),
    ]);
  });

  afterAll(async () => {
    return await Promise.all([proxy.teardown(), test_project.teardown(), certs.teardown()]);
  });

  test("static file", async () => {
    const response = fetch(proxy.server.url.origin + "/test-project/hello.html", {
      tls: { rejectUnauthorized: false },
    })
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("static hello\n");
  }, 100);

  test("page route", async () => {
    const response = fetch(proxy.server.url.origin + "/test-project/", {
      tls: { rejectUnauthorized: false },
    })
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toContain("Hello, World!");
  }, 100);

  test("GET route", async () => {
    const response = fetch(proxy.server.url.origin + "/test-project/api", {
      tls: { rejectUnauthorized: false },
    })
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("get route: " + proxy.server.url.origin + "/api");
  }, 100);

  test("POST route", async () => {
    const response = fetch(proxy.server.url.origin + "/test-project/api", {
      method: "POST",
      tls: { rejectUnauthorized: false },
    })
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("post route: " + proxy.server.url.origin + "/api");
  }, 100);
});
