import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCeteMoney, formatPolishLogMoney } from "./cete-format";
import { formatTRY } from "../lib/utils";
test("Polish lira formatting is local while TR and EN retain the existing formatter", () => {
  for (const n of [0, 12, 12345, -12345, 45.5]) {
    assert.equal(formatCeteMoney(n, "tr"), formatTRY(n));
    assert.equal(formatCeteMoney(n, "en"), formatTRY(n));
  }
  assert.equal(formatCeteMoney(12345, "pl"), "12\u00a0345 ₺");
  assert.equal(formatCeteMoney(-12345, "pl"), "-12\u00a0345 ₺");
});

test("historical lira amounts keep their value with Polish separators", () => {
  assert.equal(
    formatPolishLogMoney("Wpłata 12.345 ₺, kurs 42.1 ₺."),
    "Wpłata 12\u00a0345 ₺, kurs 42,1 ₺.",
  );
  assert.equal(formatPolishLogMoney("Koszt −1.234.567 ₺."), "Koszt −1\u00a0234\u00a0567 ₺.");
});
