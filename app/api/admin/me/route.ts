import { getAdminSession, securityHeaders } from "@/lib/server";

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session) return Response.json({ authenticated: false }, { status: 401, headers: securityHeaders() });
  return Response.json({ authenticated: true, csrfToken: session.csrfToken, expiresAt: session.expiresAt }, { headers: securityHeaders() });
}
