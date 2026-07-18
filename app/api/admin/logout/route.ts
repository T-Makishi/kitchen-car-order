import { appEnv, requireAdmin, securityHeaders, sha256 } from "@/lib/server";

export async function POST(request: Request) {
  await requireAdmin(request, true);
  const token = request.headers.get("cookie")?.split(";").map((value) => value.trim()).find((value) => value.startsWith("kco_session="))?.slice(12);
  if (token) await appEnv().DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return new Response(JSON.stringify({ ok: true }), { headers: securityHeaders(new Headers({ "Content-Type": "application/json", "Set-Cookie": "kco_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" })) });
}
