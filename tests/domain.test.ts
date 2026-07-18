import test from "node:test";
import assert from "node:assert/strict";
import { calculateLineTotal, calculateOrderTotal, canTransitionOrder, escapeHtml, hasSlotCapacity, isBeforeCutoff, isValidJapanesePhone, isWithinBusinessHours } from "../lib/domain.ts";

test("商品とオプションの税込合計を整数で計算する", () => {
  assert.equal(calculateLineTotal({ unitPrice: 900, quantity: 2, optionPrices: [100, 150] }), 2300);
  assert.equal(calculateOrderTotal([{ unitPrice: 900, quantity: 2, optionPrices: [100] }, { unitPrice: 300, quantity: 1 }]), 2300);
});

test("営業時間は開始を含み終了を含まない", () => {
  assert.equal(isWithinBusinessHours("11:00", "11:00", "15:00"), true);
  assert.equal(isWithinBusinessHours("15:00", "11:00", "15:00"), false);
});

test("締切時間を判定する", () => {
  const now = new Date("2026-07-18T01:00:00Z");
  assert.equal(isBeforeCutoff(now, new Date("2026-07-18T01:30:00Z"), 30), true);
  assert.equal(isBeforeCutoff(now, new Date("2026-07-18T01:29:59Z"), 30), false);
});

test("受取枠上限を超えない場合だけ受け付ける", () => {
  assert.equal(hasSlotCapacity(4, 5), true);
  assert.equal(hasSlotCapacity(5, 5), false);
});

test("注文状態遷移を制限する", () => {
  assert.equal(canTransitionOrder("NEW", "CONFIRMED"), true);
  assert.equal(canTransitionOrder("NEW", "READY"), false);
  assert.equal(canTransitionOrder("PICKED_UP", "CANCELLED"), false);
});

test("電話番号とHTMLを検証する", () => {
  assert.equal(isValidJapanesePhone("090-1234-5678"), true);
  assert.equal(isValidJapanesePhone("123"), false);
  assert.equal(escapeHtml('<script>"x"</script>'), "&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
});
