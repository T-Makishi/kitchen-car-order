"use client";
/* eslint-disable @next/next/no-img-element -- R2商品画像とユーザー提供写真を同じ表示経路で扱うため */

import { useEffect, useMemo, useState } from "react";
import { createPickupTimes, sampleMenu, type MenuItem } from "@/lib/catalog";
import { calculateOrderTotal, formatYen } from "@/lib/domain";

type CartLine = { key: string; itemId: string; quantity: number; optionChoiceIds: string[]; note: string };
type Dialog = { type: "item"; item: MenuItem } | { type: "cart" } | { type: "status" } | null;
type StoreSetting = { store_name:string; description:string; phone:string; email:string; instagram_url:string|null; minimum_order_amount:number; order_status:string; allergy_notice:string };
type PickupLocation = { id:string; name:string; address:string; mapUrl:string };

const defaultSetting: StoreSetting = {
  store_name: "まちの小さなキッチンカー",
  description: "朝ごはんから、ほっとする一皿まで。小さなキッチンカーから、できたてをお届けします。",
  phone: "",
  email: "",
  instagram_url: "https://www.instagram.com/kitchencar_life.aki/",
  minimum_order_amount: 800,
  order_status: "OPEN",
  allergy_notice: "同じ調理設備で複数のアレルゲンを扱っています。詳細はご注文前に店舗へご確認ください。",
};

function getMapEmbedUrl(address: string) {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}

export function CustomerApp() {
  const [category, setCategory] = useState("すべて");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recommended");
  const [menu, setMenu] = useState<MenuItem[]>(sampleMenu);
  const [setting, setSetting] = useState<StoreSetting>(defaultSetting);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("kco_cart");
    if (saved) try { setCart(JSON.parse(saved)); } catch {}
  }, []);
  useEffect(() => {
    fetch("/api/public/bootstrap").then((response) => response.ok ? response.json() : null).then((value) => {
      if (value?.menu) setMenu(value.menu);
      if (value?.setting) setSetting({ ...defaultSetting, ...value.setting });
      if (value?.locations) setPickupLocations(value.locations);
    }).catch(() => {});
  }, []);
  useEffect(() => localStorage.setItem("kco_cart", JSON.stringify(cart)), [cart]);

  const menuCategories = useMemo(() => ["すべて", ...new Set(menu.map((item) => item.category))], [menu]);
  const filtered = useMemo(() => menu
    .filter((item) => (category === "すべて" || item.category === category) && (item.name + item.description + item.ingredients).includes(query))
    .sort((a, b) => sort === "price-low" ? a.price - b.price : sort === "price-high" ? b.price - a.price : Number(Boolean(b.recommended)) - Number(Boolean(a.recommended))), [category, menu, query, sort]);
  const total = calculateOrderTotal(cart.flatMap((line) => {
    const item = menu.find((value) => value.id === line.itemId);
    if (!item) return [];
    const prices = item.options.flatMap((group) => group.choices).filter((choice) => line.optionChoiceIds.includes(choice.id)).map((choice) => choice.price);
    return [{ unitPrice: item.price, quantity: line.quantity, optionPrices: prices }];
  }));
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const todayLocation = pickupLocations[0];
  const isOpen = setting.order_status === "OPEN" && Boolean(todayLocation);

  function add(line: CartLine) {
    setCart((current) => [...current, line]);
    setDialog(null);
    setToast("カートに追加しました");
    setTimeout(() => setToast(""), 2400);
  }

  return <>
    <a className="skip" href="#main">本文へ移動</a>
    <header className="site-header"><div className="shell header-row"><a className="brand" href="#top"><span className="brand-mark" aria-hidden="true">M</span><span><small>MACHI NO CHIISANA</small>{setting.store_name}</span></a><nav className="nav" aria-label="主要メニュー"><a href="#story">私たちについて</a><a href="#menu">メニュー</a><a href="#shop">営業案内</a><button className="button cart-button" onClick={() => setDialog({ type: "cart" })}>CART <span aria-label={`${count}点`}>{String(count).padStart(2, "0")}</span></button></nav></div></header>
    <main id="main">
      <section className="hero" id="top"><div className="shell hero-grid"><div className="hero-copy-column"><p className="eyebrow">PRE-ORDER / PICK UP</p><h1>できたてを、<br/><em>待たずに。</em></h1><p className="hero-copy">受取時間を選んで、店頭で受け取る。<br/>お支払いは受取時にSquareで。</p><div className="hero-actions"><a className="button" href="#menu">メニューを見る <span>↘</span></a><button className="button secondary" onClick={() => setDialog({ type: "status" })}>注文状況を確認</button></div><div className="status-card"><span className={`status-dot ${isOpen ? "" : "closed"}`}/><span><strong>{isOpen ? "事前注文を受付中" : todayLocation ? "ただいま受付時間外です" : "販売場所を準備中"}</strong><small>{todayLocation ? `本日の販売場所：${todayLocation.name}` : "店舗設定から本日の販売場所を登録してください"}</small></span>{todayLocation && <a href="#shop">地図を見る ↓</a>}</div></div><figure className="hero-card"><img src="/og.png" alt="ベージュ色のキッチンカーを描いたダーク・ストリート調のイラスト"/><figcaption><span>NIGHT SHIFT</span><strong>ORDER / PICK UP<br/>ENJOY</strong></figcaption></figure></div></section>
      <section className="marquee" aria-label="店舗コンセプト"><div>BREAKFAST · RICE BOWLS · FISH DOGS · SMOOTHIES · FRIDAY CURRY ·</div></section>
      <section className="section story-section" id="story"><div className="shell story-grid"><div><p className="eyebrow">OUR STORY</p><h2>小さいからこそ、<br/><em>ていねいに。</em></h2></div><div><p>朝のやさしいごはん、気軽に楽しめる丼や軽食、季節のドリンク。いつもの町に、小さな楽しみを運びます。</p><p className="story-note">ORDER AHEAD · PICK UP · PAY WITH SQUARE</p></div></div></section>
      <section className="section alt" id="menu"><div className="shell"><div className="section-title"><div><p className="eyebrow">TODAY&apos;S MENU</p><h2>FRESH FROM<br/><em>THE TRUCK.</em></h2></div><p>{String(filtered.length).padStart(2, "0")} ITEMS</p></div><div className="controls"><input className="search" value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="商品名で検索" aria-label="メニュー検索"/><select className="select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="表示順"><option value="recommended">おすすめ順</option><option value="price-low">価格が安い順</option><option value="price-high">価格が高い順</option></select></div><div className="category-tabs" aria-label="カテゴリー">{menuCategories.map((value) => <button key={value} className={`chip ${category === value ? "active" : ""}`} onClick={() => setCategory(value)} aria-pressed={category === value}>{value}</button>)}</div><div className="menu-grid">{filtered.map((item, index) => <article className="menu-card" key={item.id}><div className={`food-image ${item.imageTone}`} role="img" aria-label={`${item.name}の商品イメージ`}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <><span className="menu-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="food-word" aria-hidden="true">{item.category === "ごはん" ? "RICE BOWL" : "TODAY'S FOOD"}</span></>}<div className="badges">{item.recommended && <span className="badge recommend">POPULAR</span>}{item.isNew && <span className="badge new">NEW</span>}{item.soldOut && <span className="badge sold">SOLD OUT</span>}</div></div><div className="menu-body"><p className="menu-category">{item.category.toUpperCase()}</p><h3>{item.name}</h3><p>{item.description}</p><p className="allergen">アレルゲン：{item.allergens}</p><div className="meta"><span className="price">{formatYen(item.price)} <span className="tax">税込</span></span><button className="mini-button" disabled={item.soldOut || !isOpen} onClick={() => setDialog({ type: "item", item })}>{item.soldOut ? "SOLD OUT" : isOpen ? "ADD +" : "CLOSED"}</button></div></div></article>)}</div>{filtered.length === 0 && <p>条件に合う商品はありません。</p>}</div></section>
      <section className="section editorial"><div className="shell editorial-grid"><figure className="editorial-image"><img src="/brand/menu-board.png" alt="とり天丼、とり天南蛮丼、フィッシュドッグの店頭メニュー"/></figure><div><p className="eyebrow">HOW IT WORKS</p><h2>ORDER.<br/>PICK UP.<br/><em>ENJOY.</em></h2><ol className="steps"><li><span>01</span><div><b>スマートフォンから注文</b><p>商品と受取時間を選択します。</p></div></li><li><span>02</span><div><b>注文番号を保存</b><p>画面に表示される番号を受取時に提示します。</p></div></li><li><span>03</span><div><b>Square端末でお支払い</b><p>商品受取時にクレジットカード・PayPayなどで決済します。</p></div></li></ol></div></div></section>
      <section className="section shop-section" id="shop"><div className="shell"><div className="section-title"><div><p className="eyebrow">FIND THE TRUCK</p><h2>本日の営業案内</h2></div></div>{todayLocation ? <div className="sales-location"><div className="sales-location-copy"><span>01</span><p className="eyebrow">TODAY&apos;S LOCATION</p><h3>{todayLocation.name}</h3><p>{todayLocation.address}</p><a className="button" href={todayLocation.mapUrl} target="_blank" rel="noreferrer">Googleマップで開く ↗</a></div><iframe className="sales-map" src={getMapEmbedUrl(todayLocation.address)} title={`${todayLocation.name}の地図`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></div> : <div className="empty-state"><b>本日の販売場所は準備中です</b></div>}<div className="info-grid compact"><article className="info-card"><span>02</span><h3>お支払い</h3><p>受取時にSquare端末で決済します。クレジットカード・PayPayなどに対応します。</p></article><article className="info-card"><span>03</span><h3>お問い合わせ</h3><p>{setting.phone ? <a href={`tel:${setting.phone.replaceAll("-", "")}`}>{setting.phone}</a> : "電話番号は準備中です"}<br/>{setting.email && <a href={`mailto:${setting.email}`}>{setting.email}</a>}<br/><a href={setting.instagram_url ?? "https://www.instagram.com/kitchencar_life.aki/"} target="_blank" rel="noreferrer">@kitchencar_life.aki</a></p></article></div></div></section>
      <section className="section allergy-section"><div className="shell"><div className="notice"><span aria-hidden="true">ALLERGY</span><div><b>アレルギーをお持ちのお客様へ</b><div>{setting.allergy_notice}</div></div></div></div></section>
    </main>
    <footer className="footer"><div className="shell footer-grid"><div><a className="brand" href="#top"><span className="brand-mark">M</span><span><small>MACHI NO CHIISANA</small>{setting.store_name}</span></a><p>SMALL TRUCK. GOOD FOOD. GOOD DAY.</p></div><div><strong>INFORMATION</strong><p><a href="/privacy">プライバシーポリシー</a><br/><a href="/terms">利用規約</a></p></div><div><strong>FOR STAFF</strong><p><a href="/admin/login">管理画面ログイン</a></p></div></div></footer>
    {count > 0 && <div className="cart-bar" role="region" aria-label="カート"><span><strong>{count}点・{formatYen(total)}</strong><small>税込／最低注文金額 {formatYen(setting.minimum_order_amount)}</small></span><button className="button" onClick={() => setDialog({ type: "cart" })}>注文へ進む</button></div>}
    {dialog?.type === "item" && <ItemDialog item={dialog.item} onClose={() => setDialog(null)} onAdd={add}/>}
    {dialog?.type === "cart" && <CartDialog cart={cart} menu={menu} locations={pickupLocations} total={total} minimumOrder={setting.minimum_order_amount} phone={setting.phone} onClose={() => setDialog(null)} onRemove={(key) => setCart((value) => value.filter((line) => line.key !== key))} onComplete={() => { setCart([]); setDialog(null); }}/>}
    {dialog?.type === "status" && <StatusDialog onClose={() => setDialog(null)}/>}
    {toast && <div className="cart-bar toast" aria-live="polite"><strong>{toast}</strong></div>}
  </>;
}

function ItemDialog({ item, onClose, onAdd }: { item:MenuItem; onClose:()=>void; onAdd:(line:CartLine)=>void }) {
  const [quantity, setQuantity] = useState(1);
  const [choices, setChoices] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  function toggle(groupId:string, choiceId:string, max:number) {
    const group = item.options.find((value) => value.id === groupId)!;
    const inGroup = group.choices.filter((choice) => choices.includes(choice.id));
    if (choices.includes(choiceId)) setChoices((values) => values.filter((value) => value !== choiceId));
    else if (max === 1) setChoices((values) => [...values.filter((value) => !group.choices.some((choice) => choice.id === value)), choiceId]);
    else if (inGroup.length < max) setChoices((values) => [...values, choiceId]);
  }
  function submit() {
    for (const group of item.options) {
      const count = group.choices.filter((choice) => choices.includes(choice.id)).length;
      if (count < group.min) { setError(`${group.name}を選択してください`); return; }
    }
    onAdd({ key: crypto.randomUUID(), itemId: item.id, quantity, optionChoiceIds: choices, note });
  }
  const extra = item.options.flatMap((group) => group.choices).filter((choice) => choices.includes(choice.id)).reduce((sum, choice) => sum + choice.price, 0);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="item-title"><header className="dialog-head"><h2 id="item-title">{item.name}</h2><button className="close" onClick={onClose} aria-label="閉じる">×</button></header><div className="dialog-content"><p>{item.description}</p><p><b>原材料：</b>{item.ingredients}<br/><b>アレルゲン：</b>{item.allergens}</p>{item.options.map((group) => <fieldset className="option-group" key={group.id}><legend>{group.name} {group.required && <span className="required">必須</span>} <small>{group.max > 1 ? `${group.max}個まで` : "1つ選択"}</small></legend>{group.choices.map((choice) => <div className="option-row" key={choice.id}><label><input type={group.max === 1 ? "radio" : "checkbox"} name={group.id} checked={choices.includes(choice.id)} onChange={() => toggle(group.id, choice.id, group.max)}/>{choice.name}</label><span>{choice.price ? `+${formatYen(choice.price)}` : "追加料金なし"}</span></div>)}</fieldset>)}<label className="field"><span>商品への備考</span><textarea value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} placeholder="例：ソースは別添え"/></label><div className="option-row"><b>数量</b><div className="quantity"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="数量を減らす">−</button><strong>{quantity}</strong><button onClick={() => setQuantity((value) => Math.min(item.maxPerOrder, value + 1))} aria-label="数量を増やす">＋</button></div></div>{error && <p className="error" role="alert">{error}</p>}<button className="button" style={{ width: "100%" }} onClick={submit}>{formatYen((item.price + extra) * quantity)}でカートに追加</button></div></section></div>;
}

function CartDialog({ cart, menu, locations, total, minimumOrder, phone, onClose, onRemove, onComplete }: { cart:CartLine[]; menu:MenuItem[]; locations:PickupLocation[]; total:number; minimumOrder:number; phone:string; onClose:()=>void; onRemove:(key:string)=>void; onComplete:()=>void }) {
  const [step, setStep] = useState<"cart" | "checkout" | "done">("cart");
  const [result, setResult] = useState<{orderNumber:string;verificationCode:string;pickupAt:string;pickupLocationName:string;total:number}|null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?.id ?? "");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const selectedLocation = locations.find((value) => value.id === selectedLocationId) ?? locations[0];

  useEffect(() => { if (!selectedLocationId && locations[0]) setSelectedLocationId(locations[0].id); }, [locations, selectedLocationId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!navigator.onLine) { setError("オフライン中は注文を確定できません"); return; }
    if (!selectedLocationId) { setError("受取場所が設定されていません"); return; }
    setSending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = { idempotencyKey: crypto.randomUUID(), customerName: form.get("name"), customerNameKana: form.get("kana"), phone: form.get("phone"), email: form.get("email"), pickupDate: form.get("date"), pickupTime: form.get("time"), locationId: selectedLocationId, paymentMethod: "SQUARE_AT_PICKUP", note: form.get("note"), allergyDeclaration: form.get("allergy"), privacyAccepted: form.get("privacy") === "on", items: cart.map(({ itemId, quantity, optionChoiceIds, note }) => ({ itemId, quantity, optionChoiceIds, note })) };
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "注文を確定できませんでした");
      setResult(data.order);
      setStep("done");
      localStorage.removeItem("kco_cart");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "通信エラーが発生しました。同じ内容で再度お試しください");
    } finally {
      setSending(false);
    }
  }

  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
  const today = dateFormatter.format(now);
  const timeParts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(now).split(":").map(Number);
  const defaultDate = timeParts[0] * 60 + timeParts[1] >= 14 * 60 ? dateFormatter.format(new Date(now.getTime() + 86400000)) : today;

  return <div className="dialog-backdrop"><section className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="cart-title"><header className="dialog-head"><h2 id="cart-title">{step === "cart" ? "YOUR CART" : step === "checkout" ? "PICKUP DETAILS" : "ORDER RECEIVED"}</h2><button className="close" onClick={onClose} aria-label="閉じる">×</button></header><div className="dialog-content">
    {step === "cart" && <>{cart.length === 0 ? <p>カートは空です。</p> : cart.map((line) => { const item = menu.find((value) => value.id === line.itemId); if (!item) return null; const options = item.options.flatMap((group) => group.choices).filter((choice) => line.optionChoiceIds.includes(choice.id)); const lineTotal = (item.price + options.reduce((sum, choice) => sum + choice.price, 0)) * line.quantity; return <div className="cart-line" key={line.key}><div><strong>{item.name} × {line.quantity}</strong><p>{options.map((value) => value.name).join("、") || "オプションなし"}{line.note && `／${line.note}`}</p></div><div><b>{formatYen(lineTotal)}</b><br/><button onClick={() => onRemove(line.key)}>削除</button></div></div>; })}<div className="total-row"><span>合計 <small>税込</small></span><span>{formatYen(total)}</span></div>{total < minimumOrder && <p className="error">最低注文金額は{formatYen(minimumOrder)}です。</p>}<button className="button" style={{ width: "100%" }} disabled={cart.length === 0 || total < minimumOrder || locations.length === 0} onClick={() => setStep("checkout")}>{locations.length ? "受取情報を入力する" : "販売場所の設定待ち"}</button></>}
    {step === "checkout" && <form onSubmit={submit}><div className="notice"><span>SQUARE</span><div><b>お支払いは商品受取時です</b><div>店頭のSquare端末でクレジットカード・PayPayなどをご利用いただけます。</div></div></div><div className="form-grid checkout-grid"><label className="field"><span>氏名 <i className="required">必須</i></span><input name="name" required maxLength={80} autoComplete="name"/></label><label className="field"><span>氏名（フリガナ） <i className="required">必須</i></span><input name="kana" required maxLength={80}/></label><label className="field"><span>電話番号 <i className="required">必須</i></span><input name="phone" required inputMode="tel" autoComplete="tel" placeholder="090-1234-5678"/></label><label className="field"><span>メールアドレス <i className="required">必須</i></span><input name="email" type="email" required autoComplete="email"/></label><label className="field"><span>受取日 <i className="required">必須</i></span><input name="date" type="date" required min={today} defaultValue={defaultDate}/></label><label className="field"><span>受取時間 <i className="required">必須</i></span><select name="time" required defaultValue="12:00">{createPickupTimes().map((value) => <option key={value}>{value}</option>)}</select></label><label className="field full"><span>受取場所 <i className="required">必須</i></span><select name="location" required value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)}>{locations.map((value) => <option value={value.id} key={value.id}>{value.name}（{value.address}）</option>)}</select></label>{selectedLocation && <div className="pickup-map-card full"><iframe src={getMapEmbedUrl(selectedLocation.address)} title={`${selectedLocation.name}の受取地図`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/><div><b>{selectedLocation.name}</b><span>{selectedLocation.address}</span><a href={selectedLocation.mapUrl} target="_blank" rel="noreferrer">Googleマップで確認 ↗</a></div></div>}<label className="field full"><span>注文全体への要望</span><textarea name="note" maxLength={500}/></label><label className="field full"><span>アレルギーに関する申告</span><textarea name="allergy" maxLength={500} placeholder="該当なしの場合は空欄で構いません"/></label><label className="privacy-consent full"><input name="privacy" type="checkbox" required/><span><a href="/privacy" target="_blank">プライバシーポリシー</a>に同意します <i className="required">必須</i></span></label></div>{error && <p className="error" role="alert">{error}</p>}<div className="total-row"><span>受取時のお支払い <small>税込</small></span><span>{formatYen(total)}</span></div><button className="button green" style={{ width: "100%" }} disabled={sending}>{sending ? "注文を送信しています…" : "この内容で注文を確定する"}</button><button className="button secondary" type="button" style={{ width: "100%", marginTop: 10 }} onClick={() => setStep("cart")}>カートへ戻る</button></form>}
    {step === "done" && result && <div className="success"><h3>注文を受け付けました</h3><p>注文番号<br/><strong style={{ fontSize: 26 }}>{result.orderNumber}</strong></p><p>確認コード<br/><strong style={{ fontSize: 26 }}>{result.verificationCode}</strong></p><p><b>受取：</b>{new Date(result.pickupAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}<br/><b>場所：</b>{result.pickupLocationName}<br/><b>受取時のお支払い：</b>{formatYen(result.total)}</p><p>店頭のSquare端末で決済後、商品をお渡しします。注文状況の確認には注文番号と確認コードが必要です。</p>{phone && <><a href={`tel:${phone.replaceAll("-", "")}`}>店舗へ電話する</a><br/></>}<button className="button" style={{ marginTop: 16 }} onClick={onComplete}>閉じる</button></div>}
  </div></section></div>;
}

function StatusDialog({ onClose }: { onClose:()=>void }) {
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/orders/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber: form.get("number"), verificationCode: form.get("code") }) });
    const data = await response.json();
    if (!response.ok) setError(data.error);
    else setOrder(data.order);
  }
  return <div className="dialog-backdrop"><section className="dialog" role="dialog" aria-modal="true"><header className="dialog-head"><h2>注文状況を確認</h2><button className="close" onClick={onClose}>×</button></header><div className="dialog-content"><form className="stack" onSubmit={submit}><label className="field"><span>注文番号</span><input name="number" required placeholder="KH-XXXXXXXXXX"/></label><label className="field"><span>6桁の確認コード</span><input name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6}/></label>{error && <p className="error">{error}</p>}<button className="button">確認する</button></form>{order && <div className="success" style={{ marginTop: 18 }}><b>現在の状態：{statusLabel(String(order.status))}</b><p>受取：{new Date(String(order.pickup_at)).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}<br/>場所：{String(order.pickup_location_name)}<br/>合計：{formatYen(Number(order.total))}</p></div>}</div></section></div>;
}

function statusLabel(value: string) {
  return ({ NEW: "新規受付", CONFIRMED: "確認済み", COOKING: "調理中", READY: "受取準備完了", PICKED_UP: "受取済み", CANCELLED: "キャンセル" } as Record<string, string>)[value] ?? value;
}
