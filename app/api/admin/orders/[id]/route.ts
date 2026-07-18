import { z } from "zod";
import { canTransitionOrder, type OrderStatus } from "@/lib/domain";
import { appEnv, deliverEmail, nowIso, requireAdmin, securityHeaders, uid } from "@/lib/server";

const customerStatusLabels: Record<string,string> = { CONFIRMED:"注文確認済み", COOKING:"調理中", READY:"受取準備完了", PICKED_UP:"決済・受渡し完了", CANCELLED:"キャンセル" };

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(request, true);
  const { id } = await context.params;
  const parsed = z.object({ status: z.enum(["NEW", "CONFIRMED", "COOKING", "READY", "PICKED_UP", "CANCELLED"]), adminNote: z.string().max(500).optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "更新内容が不正です" }, { status: 400 });
  const current = await appEnv().DB.prepare("SELECT status,order_number,email,customer_name,pickup_at,pickup_location_name,total FROM orders WHERE id = ?").bind(id).first<{ status: OrderStatus;order_number:string;email:string;customer_name:string;pickup_at:string;pickup_location_name:string;total:number }>();
  if (!current) return Response.json({ error: "注文が見つかりません" }, { status: 404 });
  if (parsed.data.status !== current.status && !canTransitionOrder(current.status, parsed.data.status)) return Response.json({ error: "許可されていない状態変更です" }, { status: 409 });
  const timestamp = nowIso();
  await appEnv().DB.batch([
    appEnv().DB.prepare("UPDATE orders SET status = ?, admin_note = COALESCE(?,admin_note), updated_at = ? WHERE id = ?").bind(parsed.data.status, parsed.data.adminNote ?? null, timestamp, id),
    appEnv().DB.prepare("INSERT INTO audit_logs (id,admin_id,action,target_type,target_id,summary,ip_hash,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(uid("audit"), session.adminId, "ORDER_STATUS_CHANGED", "Order", id, `${current.status} → ${parsed.data.status}`, null, timestamp),
  ]);
  let delivery: "SENT" | "PREVIEW" | "FAILED" | "SKIPPED" = "SKIPPED";
  if (parsed.data.status !== current.status) {
    const statusLabel = customerStatusLabels[parsed.data.status] ?? parsed.data.status;
    const subject = parsed.data.status === "READY"
      ? `【${current.order_number}】受取準備ができました`
      : parsed.data.status === "CANCELLED"
        ? `【${current.order_number}】注文をキャンセルしました`
        : `【${current.order_number}】注文状況を更新しました`;
    const text = `${current.customer_name} 様\n注文 ${current.order_number} の状態: ${statusLabel}\n受取場所: ${current.pickup_location_name}`;
    delivery = await deliverEmail({ orderId: id, type: `STATUS_${parsed.data.status}`, to: current.email, subject, text, html: `<p>${current.customer_name} 様</p><p>注文 <strong>${current.order_number}</strong> の状態を更新しました。</p><p>${statusLabel}</p>` });
  }
  return Response.json({ ok: true, delivery }, { headers: securityHeaders() });
}
