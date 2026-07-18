import { appEnv, nowIso, requireAdmin, securityHeaders, uid } from "@/lib/server";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const signatures = [
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
];

export async function POST(request: Request) {
  const session = await requireAdmin(request, true);
  const data = await request.formData();
  const file = data.get("file");
  if (!(file instanceof File) || !allowed.has(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) return Response.json({ error: "JPEG・PNG・WebPの5MB以下の画像を選択してください" }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = signatures.find((value) => value.type === file.type);
  if (!signature || !signature.bytes.every((byte, index) => bytes[index] === byte)) return Response.json({ error: "画像の内容とファイル形式が一致しません" }, { status: 400 });
  if (file.type === "image/webp" && new TextDecoder().decode(bytes.slice(8, 12)) !== "WEBP") return Response.json({ error: "WebP画像の形式が不正です" }, { status: 400 });
  const uploads=appEnv().UPLOADS;
  if (!uploads) return Response.json({ error: "画像ストレージが設定されていません" }, { status: 503 });
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const key = `menu/${crypto.randomUUID()}.${extension}`;
  await uploads.put(key, bytes, { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" }, customMetadata: { uploadedBy: session.adminId, uploadedAt: nowIso() } });
  await appEnv().DB.prepare("INSERT INTO audit_logs (id,admin_id,action,target_type,target_id,summary,ip_hash,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(uid("audit"), session.adminId, "IMAGE_UPLOADED", "MenuItemImage", key, `画像を登録 (${file.type}, ${file.size} bytes)`, null, nowIso()).run();
  return Response.json({ key, url: `/api/images/${encodeURIComponent(key)}` }, { status: 201, headers: securityHeaders() });
}
