import { z } from "zod";
import { appEnv, ensureDatabase, nowIso, securityHeaders, sha256, uid, verifyPassword } from "@/lib/server";

export async function POST(request: Request) {
  await ensureDatabase();
  const parsed = z.object({ loginId: z.string().min(1).max(40), password: z.string().min(1).max(128) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "管理者IDとパスワードを入力してください" }, { status: 400 });
  const row = await appEnv().DB.prepare("SELECT id,password_hash,password_salt,failed_attempts,locked_until,must_change_password FROM admins WHERE id = ?").bind(parsed.data.loginId).first<{ id: string; password_hash: string; password_salt: string; failed_attempts: number; locked_until: string | null; must_change_password: number }>();
  if (!row) {
    const anyAdmin = await appEnv().DB.prepare("SELECT id FROM admins LIMIT 1").first();
    return anyAdmin
      ? Response.json({ error: "管理者IDまたはパスワードが正しくありません" }, { status: 401 })
      : Response.json({ error: "初回設定が必要です", setupRequired: true }, { status: 428 });
  }
  if (row.locked_until && new Date(row.locked_until) > new Date()) return Response.json({ error: "ログイン試行回数が上限に達しました。時間をおいて再度お試しください" }, { status: 429 });
  if (!(await verifyPassword(parsed.data.password, row.password_salt, row.password_hash))) {
    const failures = row.failed_attempts + 1;
    const lockedUntil = failures >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
    await appEnv().DB.prepare("UPDATE admins SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?").bind(failures, lockedUntil, nowIso(), row.id).run();
    return Response.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }
  await appEnv().DB.prepare("UPDATE admins SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?").bind(nowIso(), row.id).run();
  const token = crypto.randomUUID() + crypto.randomUUID();
  const csrfToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60_000).toISOString();
  await appEnv().DB.prepare("INSERT INTO admin_sessions (id,admin_id,token_hash,csrf_token,expires_at,last_seen_at,created_at) VALUES (?,?,?,?,?,?,?)").bind(uid("session"), row.id, await sha256(token), csrfToken, expiresAt, nowIso(), nowIso()).run();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const headers = securityHeaders(new Headers({ "Content-Type": "application/json", "Set-Cookie": `kco_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}` }));
  return new Response(JSON.stringify({ ok: true, csrfToken, mustChangePassword: Boolean(row.must_change_password) }), { headers });
}
