import { z } from "zod";
import { appEnv, nowIso, requireAdmin, securityHeaders, uid } from "@/lib/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(request, true);
  const { id } = await context.params;
  const parsed = z.object({ isSoldOut: z.boolean().optional(), isPublished: z.boolean().optional(), isRecommended: z.boolean().optional(), price: z.number().int().min(0).max(1_000_000).optional(), name: z.string().trim().min(1).max(80).optional(), description: z.string().trim().min(1).max(300).optional(), categoryId: z.string().trim().min(1).max(40).optional(), allergens: z.string().max(300).optional(), ingredients: z.string().max(300).optional(), imageUrl: z.string().max(500).nullable().optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "更新内容が不正です" }, { status: 400 });
  const row = await appEnv().DB.prepare("SELECT * FROM menu_items WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!row) return Response.json({ error: "商品が見つかりません" }, { status: 404 });
  await appEnv().DB.batch([
    appEnv().DB.prepare("UPDATE menu_items SET is_sold_out = ?, is_published = ?, is_recommended = ?, price = ?, name = ?, description = ?, category_id = ?, allergens = ?, ingredients = ?, image_url = ?, updated_at = ? WHERE id = ?").bind(parsed.data.isSoldOut === undefined ? row.is_sold_out : Number(parsed.data.isSoldOut), parsed.data.isPublished === undefined ? row.is_published : Number(parsed.data.isPublished), parsed.data.isRecommended === undefined ? row.is_recommended : Number(parsed.data.isRecommended), parsed.data.price ?? row.price, parsed.data.name ?? row.name, parsed.data.description ?? row.description, parsed.data.categoryId ?? row.category_id, parsed.data.allergens ?? row.allergens, parsed.data.ingredients ?? row.ingredients, parsed.data.imageUrl === undefined ? row.image_url : parsed.data.imageUrl, nowIso(), id),
    appEnv().DB.prepare("INSERT INTO audit_logs (id,admin_id,action,target_type,target_id,summary,ip_hash,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(uid("audit"), session.adminId, "MENU_UPDATED", "MenuItem", id, "商品設定を更新", null, nowIso()),
  ]);
  return Response.json({ ok: true }, { headers: securityHeaders() });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(request, true); const { id } = await context.params;
  const referenced = await appEnv().DB.prepare("SELECT id FROM order_items WHERE menu_item_id = ? LIMIT 1").bind(id).first();
  if (referenced) {
    await appEnv().DB.prepare("UPDATE menu_items SET is_published = 0, updated_at = ? WHERE id = ?").bind(nowIso(),id).run();
    return Response.json({ ok:true, archived:true, message:"注文履歴があるため非公開にしました" }, { headers:securityHeaders() });
  }
  await appEnv().DB.batch([
    appEnv().DB.prepare("DELETE FROM menu_items WHERE id = ?").bind(id),
    appEnv().DB.prepare("INSERT INTO audit_logs (id,admin_id,action,target_type,target_id,summary,ip_hash,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(uid("audit"),session.adminId,"MENU_DELETED","MenuItem",id,"商品を削除",null,nowIso()),
  ]);
  return Response.json({ok:true},{headers:securityHeaders()});
}
