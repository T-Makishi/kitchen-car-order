import { z } from "zod";
import { appEnv, hashPassword, nowIso, requireAdmin, securityHeaders, verifyPassword } from "@/lib/server";

export async function PUT(request: Request) {
  const session = await requireAdmin(request, true);
  const parsed = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "新しいパスワードは12文字以上で英大文字・英小文字・数字を含めてください" }, { status: 400 });
  const row = await appEnv().DB.prepare("SELECT password_hash,password_salt FROM admins WHERE id = ?").bind(session.adminId).first<{ password_hash: string; password_salt: string }>();
  if (!row || !(await verifyPassword(parsed.data.currentPassword, row.password_salt, row.password_hash))) return Response.json({ error: "現在のパスワードが正しくありません" }, { status: 401 });
  const next = await hashPassword(parsed.data.newPassword);
  await appEnv().DB.prepare("UPDATE admins SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = ? WHERE id = ?").bind(next.hash, next.salt, nowIso(), session.adminId).run();
  await appEnv().DB.prepare("DELETE FROM admin_sessions WHERE admin_id = ?").bind(session.adminId).run();
  return new Response(JSON.stringify({ ok: true }), { headers: securityHeaders(new Headers({ "Content-Type": "application/json", "Set-Cookie": "kco_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" })) });
}
