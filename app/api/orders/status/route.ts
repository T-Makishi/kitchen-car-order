import { z } from "zod";
import { appEnv, ensureDatabase, publicApiHeaders, publicOptionsResponse, sha256 } from "@/lib/server";

export async function POST(request: Request) {
  await ensureDatabase();
  const parsed = z.object({ orderNumber: z.string().min(6).max(30), verificationCode: z.string().regex(/^\d{6}$/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "注文番号と6桁の確認コードを入力してください" }, { status: 400, headers: publicApiHeaders(request) });
  const hash = await sha256(parsed.data.verificationCode);
  const row = await appEnv().DB.prepare("SELECT order_number,pickup_at,pickup_location_name,total,status,created_at FROM orders WHERE order_number = ? AND verification_hash = ?").bind(parsed.data.orderNumber, hash).first();
  if (!row) return Response.json({ error: "該当する注文を確認できません" }, { status: 404, headers: publicApiHeaders(request) });
  return Response.json({ order: row }, { headers: publicApiHeaders(request) });
}

export function OPTIONS(request: Request) {
  return publicOptionsResponse(request);
}
