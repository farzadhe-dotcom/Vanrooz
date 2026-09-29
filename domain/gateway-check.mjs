import test from "node:test";
import assert from "node:assert/strict";
import gateway from "./gateway.mjs";

test("public edition forwards to fixed origin without visitor credentials", async (t) => {
  let received;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    received = { url: String(url), init };
    return new Response('{"edition":null}', { headers: { "Content-Type": "application/json", "Set-Cookie": "unexpected=1" } });
  });
  const response = await gateway.fetch(new Request("https://www.parsivancouver.com/api/editions/2026-09-28?target=https://elsewhere.invalid", {
    headers: { Authorization: "test-only-token", Cookie: "session=test-only" },
  }));
  assert.equal(response.status, 200);
  assert.equal(received.url, "https://vanrooz.farzadhe.workers.dev/api/editions/2026-09-28");
  assert.equal(new Headers(received.init.headers).has("Authorization"), false);
  assert.equal(new Headers(received.init.headers).has("Cookie"), false);
  assert.equal(response.headers.has("Set-Cookie"), false);
  assert.deepEqual(await response.json(), { edition: null });
});

test("private endpoints and mutation methods never reach the Worker", async (t) => {
  const spy = t.mock.method(globalThis, "fetch", async () => { throw Error("must not fetch"); });
  for (const path of ["/api/admin/status", "/api/admin/run", "/api/unrecognized"]) {
    assert.equal((await gateway.fetch(new Request("https://www.parsivancouver.com" + path))).status, 404);
  }
  assert.equal((await gateway.fetch(new Request("https://www.parsivancouver.com/", { method: "POST", body: "test" }))).status, 405);
  assert.equal(spy.mock.callCount(), 0);
});

test("an upstream redirect is not followed", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.equal(init.redirect, "manual");
    return new Response(null, { status: 302, headers: { Location: "https://elsewhere.invalid" } });
  });
  assert.equal((await gateway.fetch(new Request("https://www.parsivancouver.com/"))).status, 502);
});

test("upstream outages produce a bounded public error without exception text", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw Error("private diagnostic"); });
  const response = await gateway.fetch(new Request("https://www.parsivancouver.com/api/health"));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "SERVICE_UNAVAILABLE" });
});
