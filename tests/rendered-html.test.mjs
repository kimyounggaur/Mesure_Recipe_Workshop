import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the measure recipe workshop", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>마디 레시피 공방 \| 멜로디아 음악이론 어드벤처<\/title>/i);
  assert.match(html, /마디 레시피 공방/);
  assert.match(html, /오늘의 주문을 채워요/);
  assert.match(html, /음표 재료/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview|react-loading-skeleton/);
});

test("exposes the learning flow in the rendered product shell", async () => {
  const html = await (await render()).text();
  assert.match(html, /조립/);
  assert.match(html, /연주/);
  assert.match(html, /길이의 합/);
  assert.match(html, /4\/4/);
  assert.match(html, /설정 열기/);
});
