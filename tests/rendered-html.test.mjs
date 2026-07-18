import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("顧客画面に注文導線と日本語メタデータがある", async () => {
  const [page, layout, manifest, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /CustomerApp/);
  assert.match(layout, /lang="ja"/);
  assert.match(layout, /og\.png/);
  assert.match(manifest, /まちの小さなキッチンカー 事前注文/);
  assert.match(css, /prefers-reduced-motion/);
});

test("注文APIに冪等性とサーバー価格再計算がある", async () => {
  const source = await readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8");
  assert.match(source, /idempotencyKey/);
  assert.match(source, /calculateOrderTotal/);
  assert.match(source, /INSERT INTO orders/);
  assert.match(source, /deliverEmail/);
});
