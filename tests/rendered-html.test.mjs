import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the v3.5 learning farm shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Monad 像素农场<\/title>/i);
  assert.match(html, /MONAD 像素农场/);
  assert.match(html, /Monad 像素农场标题画面/);
  assert.match(html, /点击空白处开始|正在读取农场记录/);
  assert.match(html, /知识会发芽，验证会结果/);
  assert.match(html, /可探索的 Monad 像素农场/);
  assert.match(html, /自动带路/);
  assert.match(html, /WASD/);
  assert.match(html, /Monad 农场学徒/);
  assert.match(html, /知识塔/);
  assert.match(html, /种子小铺/);
  assert.match(html, /进步工坊/);
  assert.match(html, /course-field-layer/);
  assert.match(html, /data-field-stage="wild"/);
  assert.match(html, /data-course-plot="web3"/);
  assert.match(html, /data-course-plots="web3,monad,contract"/);
  assert.match(html, /data-contract-field-stage="wild"/);
  assert.match(html, /data-course-grid-slots="9"/);
  assert.match(html, /data-seed-count="0"/);
  assert.match(html, /course-field-wild-v4\.png/);
  assert.match(html, /course-grid-slot is-active/);
  assert.match(html, /course-grid-slot is-locked/);
  assert.match(html, /course-grid-slot is-reserved/);
  assert.match(html, /data-course-slot="9"/);
  assert.doesNotMatch(html, /\/7 块|知识节点正在把田地逐块种满/);
  assert.match(html, /播放农场环境音乐/);
  assert.doesNotMatch(html, /Kuru|aPriori|Moss|Swap|质押|修复温室/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});
