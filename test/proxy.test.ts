import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { getCerts, getProxy, getTestProject } from "./helper";

let proxiedBunServer1: import("bun").Server;
let proxiedBunServer2: import("bun").Server;
describe("simple server behind mock proxy", () => {
  let proxy = getProxy();

  beforeAll(async () => {
    await proxy.setup({
      proxy_map: new Map([
        ["/service1", "localhost:7005"],
        ["/service2", "localhost:7006"],
      ]),
      port: 7004,
    });
    proxiedBunServer1 = Bun.serve({
      port: 7005,
      async fetch() {
        return new Response("This is service 1!");
      },
    });
    proxiedBunServer2 = Bun.serve({
      port: 7006,
      async fetch() {
        return new Response("This is service 2!");
      },
    });
  });

  afterAll(async () => {
    await proxy.teardown();
    proxiedBunServer1.stop(true);
    proxiedBunServer2.stop(true);
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

describe("project behind proxy with X-Forwarded-* headers", () => {
  let proxy = getProxy();
  let test_project = getTestProject();

  beforeAll(async () => {
    return await Promise.all([
      proxy.setup({ proxy_map: new Map([["/test-project", "localhost:7001"]]), port: 7000 }),
      test_project.setup({
        port: 7001,
        protocol_header: "X-Forwarded-Proto",
        host_header: "X-Forwarded-Host",
        xff_depth: 1,
      }),
    ]);
  });

  afterAll(async () => {
    return await Promise.all([proxy.teardown(), test_project.teardown()]);
  });

  test("static file", async () => {
    const response = fetch(proxy.server.url.origin + "/test-project/hello.html")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("static hello\n");
  }, 100);

  test("page route", async () => {
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

describe("project behind tls proxy", () => {
  let certs = getCerts();
  let proxy = getProxy();
  let test_project = getTestProject();

  beforeAll(async () => {
    await certs.setup();
    return await Promise.all([
      proxy.setup({
        proxy_map: new Map([["/test-project", "localhost:7003"]]),
        tls: certs.tls,
        port: 7002,
      }),
      test_project.setup({
        port: 7003,
        protocol_header: "X-Forwarded-Proto",
        host_header: "X-Forwarded-Host",
        xff_depth: 1,
      }),
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

describe("project behind proxy with Forwarded header", () => {
  let proxy = getProxy();
  let test_project = getTestProject();

  beforeAll(async () => {
    return await Promise.all([
      proxy.setup({
        proxy_map: new Map([["/test-project", "localhost:7009"]]),
        port: 7008,
        forwarded_header: true,
      }),
      test_project.setup({
        port: 7009,
        forwarded: true,
        xff_depth: 1,
      }),
    ]);
  });

  afterAll(async () => {
    return await Promise.all([proxy.teardown(), test_project.teardown()]);
  });

  test("static file", async () => {
    const response = fetch(proxy.server.url.origin + "/test-project/hello.html")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("static hello\n");
  }, 100);

  test("page route", async () => {
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
