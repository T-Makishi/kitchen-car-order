import { appEnv, ensureDatabase, requireAdmin } from "@/lib/server";

function csv(value: unknown): string { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
export async function GET(request: Request) {
  await ensureDatabase();
  await requireAdmin(request);
  const rows = await appEnv().DB.prepare("SELECT order_number,created_at,customer_name,phone,pickup_at,pickup_location_name,total,payment_method,status,customer_note,allergy_declaration,email_status FROM orders ORDER BY created_at DESC").all<Record<string, unknown>>();
  const columns = ["order_number", "created_at", "customer_name", "phone", "pickup_at", "pickup_location_name", "total", "payment_method", "status", "customer_note", "allergy_declaration", "email_status"];
  const body = [columns.join(","), ...rows.results.map((row: Record<string, unknown>) => columns.map((column) => csv(row[column])).join(","))].join("\r\n");
  return new Response(`\uFEFF${body}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
