import { env } from "cloudflare:workers";
import { sampleMenu, locations } from "./catalog";

const DEFAULT_STORE_EMAIL = "makishi0520@gmail.com";

type AppEnv = { DB: D1Database; UPLOADS?: R2Bucket; ADMIN_SETUP_TOKEN?: string; EMAIL_MODE?: string; APP_URL?: string; ORDER_NOTIFICATION_EMAIL?: string; EMAIL_API_URL?: string; EMAIL_API_TOKEN?: string; SMTP_HOST?: string; SMTP_PORT?: string; SMTP_USER?: string; SMTP_PASS?: string; SMTP_FROM?: string };

export function appEnv(): AppEnv { return env as unknown as AppEnv; }
export function nowIso(): string { return new Date().toISOString(); }
export function uid(prefix = "id"): string { return `${prefix}_${crypto.randomUUID()}`; }

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function hashPassword(password: string, salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)))): Promise<{ hash: string; salt: string }> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 310_000 }, material, 256);
  return { hash: bytesToBase64(new Uint8Array(bits)), salt };
}

export async function verifyPassword(password: string, salt: string, expected: string): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  if (hash.length !== expected.length) return false;
  let result = 0;
  for (let index = 0; index < hash.length; index += 1) result |= hash.charCodeAt(index) ^ expected.charCodeAt(index);
  return result === 0;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, must_change_password INTEGER NOT NULL DEFAULT 1, failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY, admin_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS store_settings (id TEXT PRIMARY KEY, store_name TEXT NOT NULL, description TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, notification_email TEXT NOT NULL, instagram_url TEXT, logo_url TEXT, hero_url TEXT, currency TEXT NOT NULL, tax_label TEXT NOT NULL, minimum_order_amount INTEGER NOT NULL, payment_methods TEXT NOT NULL, order_status TEXT NOT NULL, completion_message TEXT NOT NULL, privacy_policy TEXT NOT NULL, terms TEXT NOT NULL, allergy_notice TEXT NOT NULL, preparation_minutes INTEGER NOT NULL, booking_days INTEGER NOT NULL, session_minutes INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS business_locations (id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, map_url TEXT NOT NULL, is_active INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS menu_items (id TEXT PRIMARY KEY, category_id TEXT NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL, price INTEGER NOT NULL, ingredients TEXT NOT NULL, allergens TEXT NOT NULL, spiciness INTEGER NOT NULL, preparation_minutes INTEGER NOT NULL, image_url TEXT, stock INTEGER, max_per_order INTEGER NOT NULL, is_published INTEGER NOT NULL, is_sold_out INTEGER NOT NULL, is_recommended INTEGER NOT NULL, is_new INTEGER NOT NULL, sort_order INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, order_number TEXT NOT NULL UNIQUE, verification_hash TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL, customer_name_kana TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, pickup_at TEXT NOT NULL, pickup_location_id TEXT NOT NULL, pickup_location_name TEXT NOT NULL, payment_method TEXT NOT NULL, status TEXT NOT NULL, subtotal INTEGER NOT NULL, total INTEGER NOT NULL, customer_note TEXT, allergy_declaration TEXT, admin_note TEXT, email_status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, menu_item_id TEXT, item_name TEXT NOT NULL, unit_price INTEGER NOT NULL, quantity INTEGER NOT NULL, line_total INTEGER NOT NULL, note TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS order_item_options (id TEXT PRIMARY KEY, order_item_id TEXT NOT NULL, group_name TEXT NOT NULL, choice_name TEXT NOT NULL, additional_price INTEGER NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS email_deliveries (id TEXT PRIMARY KEY, order_id TEXT, type TEXT NOT NULL, recipient_masked TEXT NOT NULL, subject TEXT NOT NULL, text_body TEXT NOT NULL, html_body TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL, last_error TEXT, sent_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, admin_id TEXT, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT, summary TEXT NOT NULL, ip_hash TEXT, created_at TEXT NOT NULL)`,
];

let ready: Promise<void> | undefined;
export function ensureDatabase(): Promise<void> {
  if (!ready) ready = initializeDatabase().catch((error) => { ready = undefined; throw error; });
  return ready;
}

async function initializeDatabase(): Promise<void> {
  const db = appEnv().DB;
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  const row = await db.prepare("SELECT id,store_name,email,notification_email FROM store_settings WHERE id = ?").bind("store").first<{id:string;store_name:string;email:string;notification_email:string}>();
  if (row) {
    const timestamp = nowIso();
    if (row.store_name === "こむぎ日和 Kitchen") {
      await db.batch([
        db.prepare("UPDATE store_settings SET store_name=?,description=?,phone='',email=?,notification_email=?,instagram_url=?,payment_methods=?,updated_at=? WHERE id='store'").bind("まちの小さなキッチンカー","朝ごはんから、ほっとする一皿まで。小さなキッチンカーから、できたてをお届けします。",DEFAULT_STORE_EMAIL,DEFAULT_STORE_EMAIL,"https://www.instagram.com/kitchencar_life.aki/",JSON.stringify(["SQUARE_AT_PICKUP"]),timestamp),
        db.prepare("UPDATE business_locations SET is_active=0,updated_at=?").bind(timestamp),
        db.prepare("INSERT OR REPLACE INTO business_locations (id,name,address,map_url,is_active,created_at,updated_at) VALUES (?,?,?,?,1,?,?)").bind("loc-today","当日の出店場所","Instagramでご確認ください","https://www.instagram.com/kitchencar_life.aki/",timestamp,timestamp),
        db.prepare("UPDATE menu_items SET category_id='ごはん',name='とり天丼',description='サクサクのとり天をごはんにのせた定番メニュー。',price=500,ingredients='店舗へお問い合わせください',allergens='確認中',is_published=1,is_sold_out=0,is_recommended=1,updated_at=? WHERE id='rice-01'").bind(timestamp),
        db.prepare("UPDATE menu_items SET category_id='ごはん',name='とり天南蛮丼',description='とり天に自家製タルタルソースを合わせた人気メニュー。',price=590,ingredients='店舗へお問い合わせください',allergens='確認中',is_published=1,is_sold_out=0,is_recommended=1,updated_at=? WHERE id='rice-02'").bind(timestamp),
        db.prepare("UPDATE menu_items SET category_id='軽食',name='フィッシュドッグ',description='マグロの希少部位をはさんだ軽食メニュー。',price=290,ingredients='店舗へお問い合わせください',allergens='確認中',is_published=1,is_sold_out=0,is_recommended=0,updated_at=? WHERE id='side-01'").bind(timestamp),
        db.prepare("UPDATE menu_items SET is_published=0,updated_at=? WHERE id NOT IN ('rice-01','rice-02','side-01')").bind(timestamp),
      ]);
    } else if (!row.email.trim() || !row.notification_email.trim() || row.notification_email === "orders@example.jp") {
      await db.prepare(`UPDATE store_settings
        SET email=CASE WHEN TRIM(email)='' THEN ? ELSE email END,
            notification_email=CASE WHEN TRIM(notification_email)='' OR notification_email='orders@example.jp' THEN ? ELSE notification_email END,
            updated_at=?
        WHERE id='store'`).bind(DEFAULT_STORE_EMAIL, DEFAULT_STORE_EMAIL, timestamp).run();
    }
    return;
  }
  const timestamp = nowIso();
  await db.batch([
    db.prepare(`INSERT INTO store_settings (id,store_name,description,phone,email,notification_email,instagram_url,currency,tax_label,minimum_order_amount,payment_methods,order_status,completion_message,privacy_policy,terms,allergy_notice,preparation_minutes,booking_days,session_minutes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind("store", "まちの小さなキッチンカー", "朝ごはんから、ほっとする一皿まで。小さなキッチンカーから、できたてをお届けします。", "", DEFAULT_STORE_EMAIL, DEFAULT_STORE_EMAIL, "https://www.instagram.com/kitchencar_life.aki/", "JPY", "税込", 800, JSON.stringify(["SQUARE_AT_PICKUP"]), "OPEN", "ご注文ありがとうございます。受取時刻に注文番号をお知らせください。お支払いは受取時にSquare端末で行います。", "ご注文のために取得した個人情報は、注文対応と必要な連絡にのみ利用します。", "商品の内容、営業場所、受取時刻をご確認のうえご注文ください。", "同じ調理設備で複数のアレルゲンを扱っています。詳細はご注文前に店舗へご確認ください。", 30, 14, 480, timestamp, timestamp),
    ...locations.map((location) => db.prepare("INSERT INTO business_locations (id,name,address,map_url,is_active,created_at,updated_at) VALUES (?,?,?,?,1,?,?)").bind(location.id, location.name, location.address, location.mapUrl, timestamp, timestamp)),
    ...sampleMenu.map((item, index) => db.prepare(`INSERT INTO menu_items (id,category_id,name,slug,description,price,ingredients,allergens,spiciness,preparation_minutes,image_url,stock,max_per_order,is_published,is_sold_out,is_recommended,is_new,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(item.id, item.category, item.name, item.id, item.description, item.price, item.ingredients, item.allergens, item.spiciness, 10, null, item.soldOut ? 0 : 30, item.maxPerOrder, 1, item.soldOut ? 1 : 0, item.recommended ? 1 : 0, item.isNew ? 1 : 0, index, timestamp, timestamp)),
  ]);
}

export type AdminSession = { adminId: string; csrfToken: string; expiresAt: string };

export async function getAdminSession(request: Request): Promise<AdminSession | null> {
  await ensureDatabase();
  const raw = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("kco_session="))?.slice(12);
  if (!raw) return null;
  const tokenHash = await sha256(raw);
  const row = await appEnv().DB.prepare("SELECT admin_id,csrf_token,expires_at FROM admin_sessions WHERE token_hash = ?").bind(tokenHash).first<{ admin_id: string; csrf_token: string; expires_at: string }>();
  if (!row || new Date(row.expires_at) <= new Date()) return null;
  return { adminId: row.admin_id, csrfToken: row.csrf_token, expiresAt: row.expires_at };
}

export async function requireAdmin(request: Request, csrf = false): Promise<AdminSession> {
  const session = await getAdminSession(request);
  if (!session) throw new Response("認証が必要です", { status: 401 });
  if (csrf) {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== new URL(request.url).host) throw new Response("不正な送信元です", { status: 403 });
    if (request.headers.get("x-csrf-token") !== session.csrfToken) throw new Response("CSRFトークンが不正です", { status: 403 });
  }
  return session;
}

export function maskedEmail(value: string): string {
  const [name, domain] = value.split("@");
  return `${name?.slice(0, 2) ?? "**"}***@${domain ?? "***"}`;
}

export async function deliverEmail(input:{orderId?:string;type:string;to:string;subject:string;text:string;html:string}):Promise<"SENT"|"PREVIEW"|"FAILED"> {
  const environment=appEnv(); const timestamp=nowIso(); let status:"SENT"|"PREVIEW"|"FAILED"="PREVIEW"; let lastError:string|null=null;
  if(environment.EMAIL_MODE==="api"&&environment.EMAIL_API_URL&&environment.EMAIL_API_TOKEN){
    try{const response=await fetch(environment.EMAIL_API_URL,{method:"POST",headers:{"Authorization":`Bearer ${environment.EMAIL_API_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({from:environment.SMTP_FROM,to:input.to,subject:input.subject,text:input.text,html:input.html})});if(!response.ok)throw new Error(`メールサービス応答 ${response.status}`);status="SENT"}catch(error){status="FAILED";lastError=error instanceof Error?error.message.slice(0,200):"メール送信に失敗"}
  }
  await environment.DB.prepare("INSERT INTO email_deliveries (id,order_id,type,recipient_masked,subject,text_body,html_body,status,attempts,last_error,sent_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(uid("mail"),input.orderId??null,input.type,maskedEmail(input.to),input.subject,input.text,input.html,status,status==="PREVIEW"?0:1,lastError,status==="SENT"?timestamp:null,timestamp,timestamp).run();
  return status;
}

export function securityHeaders(headers = new Headers()): Headers {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  return headers;
}
