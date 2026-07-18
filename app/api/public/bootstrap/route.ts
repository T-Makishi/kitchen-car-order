import { appEnv, ensureDatabase, securityHeaders } from "@/lib/server";
import { sampleMenu, createPickupTimes } from "@/lib/catalog";
import { isConfiguredPickupLocation } from "@/lib/domain";

export async function GET() {
  await ensureDatabase();
  const db = appEnv().DB;
  const [setting, menuRows, locationRows] = await Promise.all([
    db.prepare("SELECT * FROM store_settings WHERE id = 'store'").first(),
    db.prepare("SELECT id,category_id,name,description,price,ingredients,allergens,spiciness,image_url,max_per_order,is_sold_out,is_recommended,is_new,is_published FROM menu_items WHERE is_published = 1 ORDER BY sort_order").all<Record<string, unknown>>(),
    db.prepare("SELECT id,name,address,map_url FROM business_locations WHERE is_active = 1 ORDER BY name").all<Record<string, unknown>>(),
  ]);
  const menu = menuRows.results.map((row: Record<string, unknown>) => {
    const base = sampleMenu.find((item) => item.id === row.id);
    return { ...(base ?? { options: [], imageTone: "toriten" }), id: String(row.id), category: String(row.category_id), name: String(row.name), description: String(row.description), price: Number(row.price), ingredients: String(row.ingredients), allergens: String(row.allergens), spiciness: Number(row.spiciness), imageUrl: row.image_url ? String(row.image_url) : null, maxPerOrder: Number(row.max_per_order), soldOut: Boolean(row.is_sold_out), recommended: Boolean(row.is_recommended), isNew: Boolean(row.is_new) };
  });
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const locations = locationRows.results
    .filter((row) => isConfiguredPickupLocation(String(row.map_url), String(row.address)))
    .map((row) => ({ id: String(row.id), name: String(row.name), address: String(row.address), mapUrl: String(row.map_url) }));
  return Response.json({ setting, menu, locations, date, pickupTimes: createPickupTimes(), announcement: locations.length ? `本日の販売場所：${locations[0].name}` : "本日の販売場所は準備中です。" }, { headers: securityHeaders() });
}
