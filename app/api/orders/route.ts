import { z } from "zod";
import { calculateOrderTotal, escapeHtml, isValidJapanesePhone } from "@/lib/domain";
import { appEnv, deliverEmail, ensureDatabase, nowIso, securityHeaders, sha256, uid } from "@/lib/server";
import { sampleMenu } from "@/lib/catalog";

const orderSchema = z.object({
  idempotencyKey: z.string().uuid(),
  customerName: z.string().trim().min(1).max(80),
  customerNameKana: z.string().trim().min(1).max(80),
  phone: z.string().refine(isValidJapanesePhone, "電話番号の形式が正しくありません"),
  email: z.email(),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/),
  locationId: z.string(),
  paymentMethod: z.enum(["SQUARE_AT_PICKUP", "CASH", "CASHLESS"]),
  note: z.string().max(500).optional().default(""),
  allergyDeclaration: z.string().max(500).optional().default(""),
  privacyAccepted: z.literal(true),
  items: z.array(z.object({ itemId: z.string(), quantity: z.number().int().min(1).max(20), optionChoiceIds: z.array(z.string()).max(10).default([]), note: z.string().max(200).optional().default("") })).min(1).max(30),
});

export async function POST(request: Request) {
  await ensureDatabase();
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 100_000) return Response.json({ error: "送信内容が大きすぎます" }, { status: 413 });
  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "入力内容を確認してください", fields: z.flattenError(parsed.error).fieldErrors }, { status: 400, headers: securityHeaders() });
  const input = parsed.data;
  const db = appEnv().DB;
  const setting = await db.prepare("SELECT minimum_order_amount,order_status,notification_email FROM store_settings WHERE id = 'store'").first<{minimum_order_amount:number;order_status:string;notification_email:string}>();
  if (!setting || setting.order_status !== "OPEN") return Response.json({ error: "現在、事前注文の受付を停止しています" }, { status: 409 });
  const existing = await db.prepare("SELECT order_number,verification_hash,pickup_at,pickup_location_name,total,status FROM orders WHERE idempotency_key = ?").bind(input.idempotencyKey).first();
  if (existing) return Response.json({ duplicate: true, order: existing }, { headers: securityHeaders() });

  const location = await db.prepare("SELECT id,name,address,map_url FROM business_locations WHERE id = ? AND is_active = 1").bind(input.locationId).first<{ id:string;name:string;address:string;map_url:string }>();
  if (!location) return Response.json({ error: "受取場所が不正です" }, { status: 400 });
  const pickupLocal = `${input.pickupDate}T${input.pickupTime}:00+09:00`;
  const pickup = new Date(pickupLocal);
  if (!Number.isFinite(pickup.getTime()) || pickup <= new Date()) return Response.json({ error: "過去または受付終了後の受取時刻は選択できません" }, { status: 400 });
  const minutes = Number(input.pickupTime.slice(0, 2)) * 60 + Number(input.pickupTime.slice(3));
  if (minutes < 690 || minutes > 840 || minutes % 15 !== 0) return Response.json({ error: "営業時間内の受取枠を選択してください" }, { status: 400 });

  const currentRows = await db.prepare(`SELECT id,name,price,max_per_order,is_sold_out,is_published FROM menu_items WHERE id IN (${input.items.map(() => "?").join(",")})`).bind(...input.items.map((line) => line.itemId)).all<Record<string, unknown>>();
  let resolved;
  try { resolved = input.items.map((line) => {
    const row = currentRows.results.find((value: Record<string, unknown>) => value.id === line.itemId);
    const base = sampleMenu.find((value) => value.id === line.itemId);
    if (!row || !row.is_published || row.is_sold_out) throw new Error("売り切れまたは受付停止の商品が含まれています");
    const item = { ...(base ?? { options: [] }), id: String(row.id), name: String(row.name), price: Number(row.price), maxPerOrder: Number(row.max_per_order) };
    if (line.quantity > item.maxPerOrder) throw new Error(`${item.name}は1注文${item.maxPerOrder}点までです`);
    const selected = item.options.flatMap((group) => group.choices.filter((choice) => line.optionChoiceIds.includes(choice.id)).map((choice) => ({ group: group.name, ...choice })));
    for (const group of item.options) {
      const count = group.choices.filter((choice) => line.optionChoiceIds.includes(choice.id)).length;
      if (count < group.min || count > group.max) throw new Error(`${group.name}の選択数を確認してください`);
    }
    return { line, item, selected };
  }); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "商品を再確認してください" }, { status: 409 }); }
  const total = calculateOrderTotal(resolved.map(({ item, line, selected }) => ({ unitPrice: item.price, quantity: line.quantity, optionPrices: selected.map((choice) => choice.price) })));
  if (total < setting.minimum_order_amount) return Response.json({ error: `最低注文金額は${setting.minimum_order_amount}円です` }, { status: 400 });

  const verificationCode = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const verificationHash = await sha256(verificationCode);
  const orderId = uid("ord");
  const orderNumber = `KH-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  const timestamp = nowIso();
  const statements = [
    db.prepare(`INSERT INTO orders (id,order_number,verification_hash,idempotency_key,customer_name,customer_name_kana,phone,email,pickup_at,pickup_location_id,pickup_location_name,payment_method,status,subtotal,total,customer_note,allergy_declaration,admin_note,email_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(orderId, orderNumber, verificationHash, input.idempotencyKey, input.customerName, input.customerNameKana, input.phone, input.email, pickup.toISOString(), location.id, location.name, input.paymentMethod, "NEW", total, total, input.note, input.allergyDeclaration, "", "QUEUED", timestamp, timestamp),
  ];
  for (const { item, line, selected } of resolved) {
    const itemId = uid("line");
    const optionTotal = selected.reduce((sum, choice) => sum + choice.price, 0);
    statements.push(db.prepare("INSERT INTO order_items (id,order_id,menu_item_id,item_name,unit_price,quantity,line_total,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(itemId, orderId, item.id, item.name, item.price, line.quantity, (item.price + optionTotal) * line.quantity, line.note, timestamp));
    for (const choice of selected) statements.push(db.prepare("INSERT INTO order_item_options (id,order_item_id,group_name,choice_name,additional_price,created_at) VALUES (?,?,?,?,?,?)").bind(uid("opt"), itemId, choice.group, choice.name, choice.price, timestamp));
  }
  await db.batch(statements);

  const subject = `【${orderNumber}】事前注文を受け付けました`;
  const safeName = escapeHtml(input.customerName);
  const textBody = `${input.customerName} 様\nご注文番号: ${orderNumber}\n受取: ${input.pickupDate} ${input.pickupTime} ${location.name}\n受取時のお支払い: ${total}円\n店頭のSquare端末で決済後、商品をお渡しします。`;
  const htmlBody = `<h1>事前注文を受け付けました</h1><p>${safeName} 様</p><p>注文番号: <strong>${orderNumber}</strong></p><p>受取: ${escapeHtml(input.pickupDate)} ${escapeHtml(input.pickupTime)} ${escapeHtml(location.name)}</p><p>受取時のお支払い: ${total}円（税込）</p><p>店頭のSquare端末で決済後、商品をお渡しします。</p>`;
  const customerMail=await deliverEmail({orderId,type:"ORDER_CONFIRMATION",to:input.email,subject,text:textBody,html:htmlBody});
  const storeMail=await deliverEmail({orderId,type:"NEW_ORDER",to:setting.notification_email||appEnv().ORDER_NOTIFICATION_EMAIL||"makishi0520@gmail.com",subject:`新規事前注文 ${orderNumber}`,text:textBody,html:htmlBody});
  await db.prepare("UPDATE orders SET email_status=?,updated_at=? WHERE id=?").bind(customerMail==="FAILED"||storeMail==="FAILED"?"FAILED":customerMail==="PREVIEW"?"PREVIEW":"SENT",nowIso(),orderId).run();
  return Response.json({ order: { orderNumber, verificationCode, pickupAt: pickup.toISOString(), pickupLocationName: location.name, total, status: "NEW" } }, { status: 201, headers: securityHeaders() });
}
