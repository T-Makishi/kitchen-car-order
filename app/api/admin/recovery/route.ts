import { z } from "zod";
import { appEnv, constantTimeEqual, ensureDatabase, hashPassword, nowIso, securityHeaders, uid } from "@/lib/server";

const recoveryInput = z.object({
  recoveryToken: z.string().min(32).max(256),
  loginId: z.string().min(4).max(40).regex(/^[A-Za-z0-9._-]+$/),
  password: z.string().min(12).max(128)
    .regex(/[A-Z]/, "英大文字が必要です")
    .regex(/[a-z]/, "英小文字が必要です")
    .regex(/\d/, "数字が必要です"),
});

export async function POST(request: Request) {
  await ensureDatabase();
  const parsed = recoveryInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "再設定キー、管理者ID、12文字以上で英大文字・英小文字・数字を含むパスワードを確認してください" },
      { status: 400, headers: securityHeaders() },
    );
  }

  const configuredToken = appEnv().ADMIN_RECOVERY_TOKEN;
  if (!configuredToken) {
    return Response.json(
      { error: "管理者再設定は現在無効です。公開管理者へ再設定を依頼してください" },
      { status: 503, headers: securityHeaders() },
    );
  }
  if (!(await constantTimeEqual(parsed.data.recoveryToken, configuredToken))) {
    return Response.json(
      { error: "管理者再設定キーが正しくありません" },
      { status: 403, headers: securityHeaders() },
    );
  }

  const existingAdmin = await appEnv().DB.prepare("SELECT id FROM admins LIMIT 1").first();
  if (!existingAdmin) {
    return Response.json(
      { error: "管理者はまだ登録されていません。初回登録を使用してください" },
      { status: 409, headers: securityHeaders() },
    );
  }

  const { hash, salt } = await hashPassword(parsed.data.password);
  const timestamp = nowIso();
  await appEnv().DB.batch([
    appEnv().DB.prepare("DELETE FROM admin_sessions"),
    appEnv().DB.prepare("DELETE FROM admins"),
    appEnv().DB.prepare("INSERT INTO admins (id,password_hash,password_salt,must_change_password,failed_attempts,locked_until,created_at,updated_at) VALUES (?,?,?,?,0,NULL,?,?)")
      .bind(parsed.data.loginId, hash, salt, 0, timestamp, timestamp),
    appEnv().DB.prepare("INSERT INTO audit_logs (id,admin_id,action,target_type,target_id,summary,ip_hash,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(uid("audit"), null, "ADMIN_RECOVERY", "Admin", parsed.data.loginId, "再設定キーで管理者を再作成", null, timestamp),
  ]);

  return Response.json({ ok: true }, { status: 201, headers: securityHeaders() });
}
