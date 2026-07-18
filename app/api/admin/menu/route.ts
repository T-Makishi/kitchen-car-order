import { z } from "zod";
import { appEnv, nowIso, requireAdmin, securityHeaders, uid } from "@/lib/server";

const createSchema = z.object({ name: z.string().trim().min(1).max(80), categoryId: z.string().trim().min(1).max(40), description: z.string().trim().min(1).max(300), price: z.number().int().min(0).max(1_000_000), ingredients: z.string().max(300).default(""), allergens: z.string().max(300).default("該当なし"), duplicateFrom: z.string().optional() });

export async function POST(request: Request) {
  const session = await requireAdmin(request, true);
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "商品名、カテゴリー、説明、税込価格を確認してください" }, { status: 400 });
  const input = parsed.data;
  const id = uid("menu"); const timestamp = nowIso();
  await appEnv().DB.batch([
    appEnv().DB.prepare(`INSERT INTO menu_items (id,category_id,name,slug,description,price,ingredients,allergens,spiciness,preparation_minutes,image_url,stock,max_per_order,is_published,is_sold_out,is_recommended,is_new,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,0,10,NULL,NULL,10,0,0,0,1,999,?,?)`).bind(id,input.categoryId,input.name,`${input.name}-${id}`.toLowerCase(),input.description,input.price,input.ingredients,input.allergens,timestamp,timestamp),
    appEnv().DB.prepare("INSERT INTO audit_logs (id,admin_id,action,target_type,target_id,summary,ip_hash,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(uid("audit"),session.adminId,"MENU_CREATED","MenuItem",id,`商品「${input.name}」を作成`,null,timestamp),
  ]);
  return Response.json({ id }, { status: 201, headers: securityHeaders() });
}
