import { appEnv, ensureDatabase, securityHeaders } from "@/lib/server";

export async function GET() {
  try {
    await ensureDatabase();
    await appEnv().DB.prepare("SELECT 1 AS ok").first();
    return Response.json({ status: "ok", database: "ok", timestamp: new Date().toISOString() }, { headers: securityHeaders() });
  } catch {
    return Response.json({ status: "degraded", database: "unavailable", timestamp: new Date().toISOString() }, { status: 503, headers: securityHeaders() });
  }
}
