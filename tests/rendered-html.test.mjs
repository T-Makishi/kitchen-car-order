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

test("管理者再設定は一時キーで保護し業務データを削除しない", async () => {
  const [route, login] = await Promise.all([
    readFile(new URL("../app/api/admin/recovery/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/AdminLogin.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /ADMIN_RECOVERY_TOKEN/);
  assert.match(route, /constantTimeEqual/);
  assert.match(route, /DELETE FROM admin_sessions/);
  assert.match(route, /DELETE FROM admins/);
  assert.doesNotMatch(route, /DELETE FROM orders/);
  assert.doesNotMatch(route, /DELETE FROM menu_items/);
  assert.match(login, /管理者再設定/);
});

test("パスワードハッシュは公開基盤のPBKDF2上限と保存形式を守る", async () => {
  const source = await readFile(new URL("../lib/server.ts", import.meta.url), "utf8");
  assert.match(source, /CURRENT_PASSWORD_ITERATIONS = 100_000/);
  assert.match(source, /PASSWORD_SALT_SCHEME = "pbkdf2-sha256"/);
  assert.match(source, /parsePasswordSalt\(salt\)/);
  assert.match(source, /error\.name === "NotSupportedError"/);
});
