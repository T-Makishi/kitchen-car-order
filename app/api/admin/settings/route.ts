import { z } from "zod";
import { appEnv, nowIso, requireAdmin, securityHeaders, uid } from "@/lib/server";

const httpsUrl = z.url().refine((value) => new URL(value).protocol === "https:", "HTTPSのURLを入力してください");

const settingsSchema = z.object({
  storeName: z.string().trim().min(1).max(100),
  description: z.string().max(1000),
  phone: z.string().max(30),
  email: z.email(),
  notificationEmail: z.email(),
  minimumOrderAmount: z.number().int().min(0).max(1_000_000),
  orderStatus: z.enum(["OPEN", "PREPARING", "CLOSED", "TEMPORARY_CLOSED"]),
  allergyNotice: z.string().max(2000),
  completionMessage: z.string().max(1000),
  privacyPolicy: z.string().max(5000),
  terms: z.string().max(5000),
  locationId: z.string().trim().min(1).max(100),
  locationName: z.string().trim().min(1).max(100),
  locationAddress: z.string().trim().min(1).max(300),
  mapUrl: httpsUrl.max(1000),
});

export async function GET(request: Request) {
  await requireAdmin(request);
  const [setting, locations] = await Promise.all([
    appEnv().DB.prepare("SELECT * FROM store_settings WHERE id='store'").first(),
    appEnv().DB.prepare("SELECT * FROM business_locations WHERE is_active=1 ORDER BY name").all(),
  ]);
  return Response.json({ setting, locations: locations.results, emailMode: appEnv().EMAIL_MODE ?? "preview" }, { headers: securityHeaders() });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin(request, true);
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "店舗設定と本日の販売場所を確認してください" }, { status: 400 });

  const input = parsed.data;
  const timestamp = nowIso();
  const db = appEnv().DB;
  await db.batch([
    db.prepare("UPDATE store_settings SET store_name=?,description=?,phone=?,email=?,notification_email=?,minimum_order_amount=?,order_status=?,allergy_notice=?,completion_message=?,privacy_policy=?,terms=?,updated_at=? WHERE id='store'")
      .bind(input.storeName, input.description, input.phone, input.email, input.notificationEmail, input.minimumOrderAmount, input.orderStatus, input.allergyNotice, input.completionMessage, input.privacyPolicy, input.terms, timestamp),
    db.prepare("UPDATE business_locations SET is_active=0,updated_at=?").bind(timestamp),
    db.prepare("INSERT INTO business_locations (id,name,address,map_url,is_active,created_at,updated_at) VALUES (?,?,?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,address=excluded.address,map_url=excluded.map_url,is_active=1,updated_at=excluded.updated_at")
      .bind(input.locationId, input.locationName, input.locationAddress, input.mapUrl, timestamp, timestamp),
    db.prepare("INSERT INTO audit_logs (id,admin_id,action,target_type,target_id,summary,ip_hash,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(uid("audit"), session.adminId, "STORE_SETTINGS_UPDATED", "StoreSetting", "store", "店舗設定と本日の販売場所を更新", null, timestamp),
  ]);
  return Response.json({ ok: true }, { headers: securityHeaders() });
}
