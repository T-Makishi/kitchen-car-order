import { appEnv, securityHeaders } from "@/lib/server";

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  if (!/^[a-zA-Z0-9._/-]+$/.test(key) || key.includes("..")) return new Response("Not found", { status: 404 });
  const object = await appEnv().UPLOADS?.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = securityHeaders(new Headers());
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
