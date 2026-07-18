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

test("メニュー画像と自由入力カテゴリーを管理できる", async () => {
  const [dashboard, createRoute, updateRoute] = await Promise.all([
    readFile(new URL("../components/AdminDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/menu/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/menu/[id]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /商品画像/);
  assert.match(dashboard, /画像を変更/);
  assert.match(dashboard, /menu-categories/);
  assert.match(createRoute, /categoryId: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(40\)/);
  assert.match(updateRoute, /categoryId: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(40\)\.optional\(\)/);
});

test("本日の販売場所は設定から顧客画面と注文検証へ反映される", async () => {
  const [settings, bootstrap, orders, customer, server] = await Promise.all([
    readFile(new URL("../app/api/admin/settings/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/public/bootstrap/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/CustomerApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/server.ts", import.meta.url), "utf8"),
  ]);
  assert.match(settings, /locationAddress/);
  assert.match(settings, /mapUrl/);
  assert.match(bootstrap, /business_locations WHERE is_active = 1/);
  assert.match(orders, /business_locations WHERE id = \? AND is_active = 1/);
  assert.match(customer, /getMapEmbedUrl/);
  assert.match(customer, /privacy-consent/);
  assert.match(server, /frame-src https:\/\/www\.google\.com/);
});

test("管理画面は大量注文を整理しメール未送信状態を明示する", async () => {
  const [dashboard, orderRoute] = await Promise.all([
    readFile(new URL("../components/AdminDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/orders/[id]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /pageSize = 12/);
  assert.match(dashboard, /対応中/);
  assert.match(dashboard, /signal-dot/);
  assert.match(dashboard, /メール未送信/);
  assert.match(orderRoute, /delivery/);
});

test("旧Instagram受取場所をGoogleマップとして誤表示しない", async () => {
  const [domain, bootstrap, orders, customer] = await Promise.all([
    readFile(new URL("../lib/domain.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/public/bootstrap/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/CustomerApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(domain, /isConfiguredPickupLocation/);
  assert.match(domain, /!\/instagram\/i\.test/);
  assert.match(bootstrap, /filter\(\(row\) => isConfiguredPickupLocation/);
  assert.match(orders, /本日の販売場所が設定されていません/);
  assert.match(customer, /販売場所を準備中/);
});

test("ストーリー見出しはスマートフォンでも意味単位の2行を維持する", async () => {
  const [customer, css] = await Promise.all([
    readFile(new URL("../components/CustomerApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(customer, /story-catch/);
  assert.match(customer, /<span>小さいからこそ<\/span><em>ていねいに。<\/em>/);
  assert.match(css, /\.story-catch>span,\.story-catch>em\{display:block;white-space:nowrap;word-break:keep-all\}/);
  assert.match(css, /\.story-catch\{font-size:clamp\(36px,12vw,64px\)!important/);
});
