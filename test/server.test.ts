import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getTestProject } from "./helper";

describe("simple project server", () => {
  let test_project = getTestProject();

  beforeAll(async () => {
    return await Promise.all([
      test_project.setup({
        port: 7009,
      }),
    ]);
  });

  afterAll(async () => {
    return await test_project.teardown();
  });

  test("static file", async () => {
    const response = fetch("http://localhost:7009/hello.html")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("static hello\n");
  }, 100);

  test("page route", async () => {
    const response = fetch("http://localhost:7009/")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toContain("Hello, World!");
  }, 100);

  test("GET route", async () => {
    const response = fetch("http://localhost:7009/api")
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("get route: http://localhost:7009/api");
  }, 100);

  test("POST route", async () => {
    const response = fetch("http://localhost:7009/api", { method: "POST" })
      .then(res => {
        expect(res.ok).toBeTrue();
        return res;
      })
      .then(res => res.text())
      .catch(e => console.error(e));
    expect(response).resolves.toEqual("post route: http://localhost:7009/api");
  }, 100);
});
