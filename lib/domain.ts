export type OrderStatus = "NEW" | "CONFIRMED" | "COOKING" | "READY" | "PICKED_UP" | "CANCELLED";

export interface PriceLine {
  unitPrice: number;
  quantity: number;
  optionPrices?: number[];
}

export function calculateLineTotal(line: PriceLine): number {
  if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0) throw new Error("商品価格が不正です");
  if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new Error("数量が不正です");
  const options = line.optionPrices ?? [];
  if (options.some((price) => !Number.isInteger(price) || price < 0)) throw new Error("オプション価格が不正です");
  return (line.unitPrice + options.reduce((sum, price) => sum + price, 0)) * line.quantity;
}

export function calculateOrderTotal(lines: PriceLine[]): number {
  return lines.reduce((sum, line) => sum + calculateLineTotal(line), 0);
}

export function timeToMinutes(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("時刻形式が不正です");
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isWithinBusinessHours(time: string, opensAt: string, closesAt: string): boolean {
  const target = timeToMinutes(time);
  const open = timeToMinutes(opensAt);
  const close = timeToMinutes(closesAt);
  return target >= open && target < close;
}

export function isBeforeCutoff(now: Date, pickupAt: Date, cutoffMinutes: number): boolean {
  return pickupAt.getTime() - now.getTime() >= cutoffMinutes * 60_000;
}

export function hasSlotCapacity(reservedCount: number, capacity: number, requested = 1): boolean {
  return [reservedCount, capacity, requested].every(Number.isInteger) && requested > 0 && reservedCount + requested <= capacity;
}

const transitions: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COOKING", "CANCELLED"],
  COOKING: ["READY", "CANCELLED"],
  READY: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: [],
  CANCELLED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return transitions[from].includes(to);
}

export function normalizePhone(value: string): string {
  return value.replace(/[\s()-]/g, "");
}

export function isValidJapanesePhone(value: string): boolean {
  return /^0\d{9,10}$/.test(normalizePhone(value));
}

export function formatYen(value: number): string {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(value);
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}
