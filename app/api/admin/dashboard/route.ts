import { appEnv, ensureDatabase, requireAdmin, securityHeaders } from "@/lib/server";

export async function GET(request: Request) {
  await ensureDatabase();
  await requireAdmin(request);
  const db = appEnv().DB;
  const orders = await db.prepare("SELECT id,order_number,customer_name,phone,pickup_at,pickup_location_name,payment_method,total,status,email_status,customer_note,allergy_declaration,admin_note,created_at FROM orders ORDER BY pickup_at DESC LIMIT 200").all();
  const items = await db.prepare("SELECT id,name,description,price,ingredients,allergens,image_url,is_sold_out,is_published,is_recommended,is_new,stock,category_id FROM menu_items ORDER BY sort_order").all();
  const emails = await db.prepare("SELECT e.id,e.order_id,o.order_number,e.type,e.recipient_masked,e.subject,e.status,e.attempts,e.last_error,e.created_at FROM email_deliveries e LEFT JOIN orders o ON o.id=e.order_id ORDER BY e.created_at DESC LIMIT 50").all();
  return Response.json({ orders: orders.results, menu: items.results, emails: emails.results, emailMode: appEnv().EMAIL_MODE ?? "preview" }, { headers: securityHeaders() });
}
