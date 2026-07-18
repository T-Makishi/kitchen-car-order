import { z } from "zod";
import { appEnv, ensureDatabase, hashPassword, nowIso, securityHeaders, uid } from "@/lib/server";

export async function GET() {
  await ensureDatabase();
  const existingAdmin = await appEnv().DB.prepare("SELECT id FROM admins LIMIT 1").first();
  return Response.json({
    setupRequired: !existingAdmin,
    setupConfigured: Boolean(appEnv().ADMIN_SETUP_TOKEN),
    recoveryConfigured: Boolean(appEnv().ADMIN_RECOVERY_TOKEN),
  }, { headers: securityHeaders() });
}

export async function POST(request: Request) {
  await ensureDatabase();
  const parsed = z.object({
    setupToken: z.string().min(12),
    loginId: z.string().min(4).max(40).regex(/^[A-Za-z0-9._-]+$/),
    password: z.string().min(12).max(128).regex(/[A-Z]/, "英大文字が必要です").regex(/[a-z]/, "英小文字が必要です").regex(/\d/, "数字が必要です"),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "管理者IDと、12文字以上で英大文字・英小文字・数字を含むパスワードを確認してください" }, { status: 400 });
  const exists = await appEnv().DB.prepare("SELECT id FROM admins LIMIT 1").first();
  if (exists) return Response.json({ error: "初回登録は完了しています。「ログイン（普段はこちら）」を選んでください" }, { status: 409 });
  if (!appEnv().ADMIN_SETUP_TOKEN || parsed.data.setupToken !== appEnv().ADMIN_SETUP_TOKEN) return Response.json({ error: "初回登録キーが正しくありません。ローカル確認用として発行されたキーを入力してください" }, { status: 403 });
  const { hash, salt } = await hashPassword(parsed.data.password);
  const timestamp = nowIso();
  await appEnv().DB.batch([
    appEnv().DB.prepare("INSERT INTO admins (id,password_hash,password_salt,must_change_password,failed_attempts,locked_until,created_at,updated_at) VALUES (?,?,?,?,0,NULL,?,?)").bind(parsed.data.loginId, hash, salt, 0, timestamp, timestamp),
    appEnv().DB.prepare("INSERT INTO audit_logs (id,admin_id,action,target_type,target_id,summary,ip_hash,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(uid("audit"), parsed.data.loginId, "ADMIN_SETUP", "Admin", parsed.data.loginId, "初回管理者を設定", null, timestamp),
  ]);
  return Response.json({ ok: true }, { status: 201, headers: securityHeaders() });
}
