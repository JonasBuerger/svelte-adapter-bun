import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { getCerts, getTestProject } from "./helper";

describe("project with tls", () => {
  let test_project, certs;

  beforeAll(async () => {
    test_project = getTestProject();
    certs = getCerts();
    await certs.setup();
    await test_project.setup({
      port: 7007,
      tls: certs.tls,
    });
  });

  afterAll(async () => {
    return await Promise.all([test_project.teardown(), certs.teardown()]);
  });

  test("static file", async () => {
    const response = fetch("https://localhost:7007/hello.html", {
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
    const response = fetch("https://localhost:7007", {
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
    const response = fetch("https://localhost:7007/api", {
      tls: { rejectUnauthorized: false },
    })
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("get route: https://localhost:7007/api");
  }, 100);

  test("POST route", async () => {
    const response = fetch("https://localhost:7007/api", {
      method: "POST",
      tls: { rejectUnauthorized: false },
    })
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("post route: https://localhost:7007/api");
  }, 100);
});
