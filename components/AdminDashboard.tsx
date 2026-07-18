"use client";
/* eslint-disable @next/next/no-img-element -- 管理者が登録したR2商品画像を表示するため */

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatYen } from "@/lib/domain";

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  phone: string;
  pickup_at: string;
  pickup_location_name: string;
  payment_method: string;
  total: number;
  status: string;
  email_status: string;
  allergy_declaration: string;
  created_at: string;
};

type Item = {
  id: string;
  name: string;
  description: string;
  price: number;
  ingredients: string;
  allergens: string;
  image_url: string | null;
  is_sold_out: number;
  is_published: number;
  is_recommended: number;
  stock: number | null;
  category_id: string;
};

type EmailDelivery = {
  id: string;
  order_id: string | null;
  order_number: string | null;
  type: string;
  recipient_masked: string;
  subject: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
};

type DashboardData = { orders: Order[]; menu: Item[]; emails: EmailDelivery[]; emailMode: string };
type StoreLocation = { id: string; name: string; address: string; map_url: string };
type StoreSetting = {
  store_name: string;
  description: string;
  phone: string;
  email: string;
  notification_email: string;
  minimum_order_amount: number;
  order_status: string;
  allergy_notice: string;
  completion_message: string;
  privacy_policy: string;
  terms: string;
};

const statusLabels: Record<string, string> = {
  NEW: "受付",
  CONFIRMED: "確認",
  COOKING: "調理中",
  READY: "受取待ち",
  PICKED_UP: "お渡し済",
  CANCELLED: "取消",
};
const nextStatus: Record<string, string | undefined> = { NEW: "CONFIRMED", CONFIRMED: "COOKING", COOKING: "READY", READY: "PICKED_UP" };
const actionLabels: Record<string, string> = { CONFIRMED: "確認", COOKING: "調理開始", READY: "準備完了", PICKED_UP: "お渡し済" };
const activeStatuses = new Set(["NEW", "CONFIRMED", "COOKING", "READY"]);

export function AdminDashboard({ csrfToken }: { csrfToken: string }) {
  const [data, setData] = useState<DashboardData>({ orders: [], menu: [], emails: [], emailMode: "preview" });
  const [tab, setTab] = useState("orders");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
    if (response.status === 401) {
      location.href = "/admin/login";
      return;
    }
    if (!response.ok) {
      setError("管理データを読み込めませんでした");
      return;
    }
    setData(await response.json());
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
  const todayOrders = data.orders.filter((order) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date(order.pickup_at)) === today);
  const sales = todayOrders.filter((order) => order.status !== "CANCELLED").reduce((sum, order) => sum + order.total, 0);

  async function updateOrder(order: Order, status: string) {
    setError("");
    setFeedback("");
    setUpdatingOrderId(order.id);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ status }),
      });
      const value = await response.json();
      if (!response.ok) {
        setError(value.error ?? "注文状態を更新できませんでした");
        return;
      }
      setFeedback(value.delivery === "SENT" ? "状態更新・メール送信済み" : value.delivery === "FAILED" ? "状態更新済み・メール送信失敗" : "状態更新済み・メール未送信");
      await load();
    } finally {
      setUpdatingOrderId("");
    }
  }

  async function patchItem(item: Item, body: Record<string, unknown>) {
    const response = await fetch(`/api/admin/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(body),
    });
    if (response.ok) await load();
    else setError((await response.json()).error);
  }

  async function deleteItem(item: Item) {
    if (!confirm(`「${item.name}」を削除しますか？ 注文履歴がある場合は非公開になります。`)) return;
    const response = await fetch(`/api/admin/menu/${item.id}`, { method: "DELETE", headers: { "x-csrf-token": csrfToken } });
    const value = await response.json();
    if (response.ok) {
      setFeedback(value.message ?? "商品を削除しました");
      await load();
    } else setError(value.error);
  }

  async function duplicateItem(item: Item) {
    const response = await fetch("/api/admin/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({ name: `${item.name}（複製）`, categoryId: item.category_id, description: item.description, price: item.price, ingredients: item.ingredients, allergens: item.allergens, duplicateFrom: item.id }),
    });
    if (response.ok) await load();
    else setError((await response.json()).error);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", headers: { "x-csrf-token": csrfToken } });
    sessionStorage.removeItem("kco_csrf");
    location.href = "/admin/login";
  }

  return <div className="admin-shell">
    <header className="admin-header"><div className="shell">
      <a className="brand" href="/admin" style={{ color: "white" }}><span className="brand-mark">M</span><span><small>STAFF OPERATIONS</small>まちの小さなキッチンカー</span></a>
      <div className="admin-header-actions"><a className="button secondary" href="/" target="_blank">お客様画面</a><button className="button" onClick={logout}>ログアウト</button></div>
    </div></header>
    <main className="shell admin-main">
      <div className="section-title"><div><p className="eyebrow">SERVICE DASHBOARD</p><h1>今日のオペレーション</h1></div><p>30秒ごとに自動更新</p></div>
      {error && <p className="error" role="alert">{error}</p>}
      {feedback && <p className="operation-feedback" role="status">{feedback}</p>}
      {data.emailMode === "preview" && <div className="mail-mode-banner"><span className="signal-dot mail-off"/>メール未接続：現在は通知履歴のみ保存されます</div>}
      <div className="operation-guide"><div className="operation-card"><strong>店頭注文</strong><div className="operation-flow">受付 → 調理 → Square決済 → お渡し</div></div><div className="operation-card"><strong>事前注文</strong><div className="operation-flow">注文確認 → 調理 → Square決済 → お渡し</div></div></div>
      <div className="stat-grid"><div className="stat"><span>本日の事前注文</span><strong>{todayOrders.length}件</strong></div><div className="stat"><span>受取売上見込</span><strong>{formatYen(sales)}</strong></div><div className="stat"><span>調理中</span><strong>{data.orders.filter((order) => order.status === "COOKING").length}件</strong></div><div className="stat"><span>受取・決済待ち</span><strong>{data.orders.filter((order) => order.status === "READY").length}件</strong></div></div>
      <div className="category-tabs admin-tabs">{[["orders", "事前注文"], ["notifications", "通知履歴"], ["menu", "メニュー"], ["settings", "店舗設定"]].map(([key, label]) => <button key={key} className={`chip ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>{label}{key === "notifications" && data.emails.length > 0 ? <span>{data.emails.length}</span> : null}</button>)}</div>
      {tab === "orders" && <OrdersPanel orders={data.orders} updateOrder={updateOrder} updatingOrderId={updatingOrderId}/>}
      {tab === "notifications" && <NotificationsPanel emails={data.emails} emailMode={data.emailMode}/>}
      {tab === "menu" && <MenuPanel menu={data.menu} csrfToken={csrfToken} reload={load} setError={setError} setFeedback={setFeedback} patchItem={patchItem} duplicateItem={duplicateItem} deleteItem={deleteItem}/>}
      {tab === "settings" && <Settings csrfToken={csrfToken}/>}
    </main>
  </div>;
}

function OrdersPanel({ orders, updateOrder, updatingOrderId }: { orders: Order[]; updateOrder: (order: Order, status: string) => void; updatingOrderId: string }) {
  const [scope, setScope] = useState<"active" | "completed" | "all">("active");
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [cancelCandidate, setCancelCandidate] = useState("");
  const pageSize = 12;

  const filtered = useMemo(() => orders
    .filter((order) => scope === "all" || (scope === "active" ? activeStatuses.has(order.status) : !activeStatuses.has(order.status)))
    .filter((order) => !statusFilter || order.status === statusFilter)
    .filter((order) => !query || `${order.order_number}${order.customer_name}${order.phone}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => scope === "active" ? new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime() : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [orders, query, scope, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [scope, statusFilter, query]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  return <section className="panel order-panel">
    <div className="queue-head"><div><p className="eyebrow">PRE-ORDER QUEUE</p><h2>事前注文</h2></div><div className="queue-tools"><input className="search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="注文番号・氏名・電話番号" aria-label="注文を検索"/><select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="注文状態"><option value="">全状態</option>{Object.entries(statusLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div></div>
    <div className="queue-scope" aria-label="注文の表示範囲"><button className={scope === "active" ? "active" : ""} onClick={() => setScope("active")}>対応中 <b>{orders.filter((order) => activeStatuses.has(order.status)).length}</b></button><button className={scope === "completed" ? "active" : ""} onClick={() => setScope("completed")}>完了 <b>{orders.filter((order) => !activeStatuses.has(order.status)).length}</b></button><button className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>すべて</button><a href="/api/admin/orders.csv">CSV</a><button onClick={() => print()}>印刷</button></div>
    {visible.length === 0 ? <div className="empty-state"><b>表示する注文はありません</b></div> : <div className="order-queue">{visible.map((order) => {
      const next = nextStatus[order.status];
      const changing = updatingOrderId === order.id;
      return <article className="order-ticket" key={order.id}>
        <div className="order-ticket-main"><div className="order-number"><span className={`signal-dot status-${order.status.toLowerCase()}`} aria-hidden="true"/><div><b>{order.order_number}</b><small>{new Date(order.created_at).toLocaleString("ja-JP")}</small></div></div><span className={`status-label status-${order.status.toLowerCase()}`}>{statusLabels[order.status] ?? order.status}</span></div>
        <div className="order-ticket-grid"><div><small>受取</small><strong>{new Date(order.pickup_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</strong><span>{order.pickup_location_name}</span></div><div><small>お客様</small><strong>{order.customer_name}</strong><a href={`tel:${order.phone}`}>{order.phone}</a></div><div><small>会計</small><strong>{formatYen(order.total)}</strong><span>Square・受取時</span></div></div>
        {order.allergy_declaration && <p className="allergy-flag">アレルギー：{order.allergy_declaration}</p>}
        <div className="order-ticket-actions"><span className={`mail-chip ${order.email_status === "SENT" ? "sent" : "off"}`}>{order.email_status === "SENT" ? "メール済" : "メールなし"}</span>{next && <button className="mini-button" disabled={changing} onClick={() => updateOrder(order, next)}>{changing ? "更新中" : actionLabels[next]}</button>}{!['PICKED_UP', 'CANCELLED'].includes(order.status) && (cancelCandidate === order.id ? <><button className="mini-button danger" disabled={changing} onClick={() => { setCancelCandidate(""); updateOrder(order, "CANCELLED"); }}>取消確定</button><button className="text-button" onClick={() => setCancelCandidate("")}>戻る</button></> : <button className="text-button danger-text" onClick={() => setCancelCandidate(order.id)}>取消</button>)}</div>
      </article>;
    })}</div>}
    <div className="queue-pagination"><span>{filtered.length}件中 {visible.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)}件</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>前へ</button><b>{page} / {pageCount}</b><button disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>次へ</button></div></div>
  </section>;
}

const emailTypeLabels: Record<string, string> = { ORDER_CONFIRMATION: "お客様への注文受付", NEW_ORDER: "店舗への新規注文通知", STATUS_CONFIRMED: "注文確認済み通知", STATUS_COOKING: "調理開始通知", STATUS_READY: "受取準備完了通知", STATUS_PICKED_UP: "受取完了通知", STATUS_CANCELLED: "キャンセル通知" };
const emailStatusLabels: Record<string, string> = { PREVIEW: "メール未送信", SENT: "送信済み", FAILED: "送信失敗" };

function NotificationsPanel({ emails, emailMode }: { emails: EmailDelivery[]; emailMode: string }) {
  return <section className="panel notification-panel"><div className="section-title"><div><p className="eyebrow">ORDER NOTIFICATIONS</p><h2>通知履歴</h2></div><p>最新50件</p></div>{emailMode === "preview" ? <div className="notification-guide single"><div><b><span className="signal-dot mail-off"/>メール未接続</b><p>注文内容と状態変更は履歴に残りますが、お客様と店舗へのメールは送信されません。</p></div></div> : <div className="notification-guide single"><div><b><span className="signal-dot status-picked_up"/>メール送信中</b><p>注文内容と状態変更を設定済みメールアドレスへ送信します。</p></div></div>}{emails.length === 0 ? <div className="empty-state"><b>通知履歴はまだありません</b></div> : <div className="notification-list">{emails.map((email) => <article key={email.id}><div><b>{emailTypeLabels[email.type] ?? email.type}</b><span>{email.order_number ?? "—"}・{new Date(email.created_at).toLocaleString("ja-JP")}</span></div><div><span>{email.recipient_masked}</span><span className={`delivery-status ${email.status.toLowerCase()}`}>{emailStatusLabels[email.status] ?? email.status}</span></div>{email.last_error && <small className="delivery-error">{email.last_error}</small>}</article>)}</div>}</section>;
}

function MenuPanel({ menu, csrfToken, reload, setError, setFeedback, patchItem, duplicateItem, deleteItem }: { menu: Item[]; csrfToken: string; reload: () => void; setError: (value: string) => void; setFeedback: (value: string) => void; patchItem: (item: Item, body: Record<string, unknown>) => void; duplicateItem: (item: Item) => void; deleteItem: (item: Item) => void }) {
  const categoryOptions = [...new Set(menu.map((item) => item.category_id))];

  async function uploadFile(file: File): Promise<string | null> {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/admin/uploads", { method: "POST", headers: { "x-csrf-token": csrfToken }, body });
    const value = await response.json();
    if (!response.ok) {
      setError(value.error);
      return null;
    }
    return value.url;
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    const response = await fetch("/api/admin/menu", { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ name: form.get("name"), categoryId: form.get("category"), description: form.get("description"), price: Number(form.get("price")), ingredients: form.get("ingredients"), allergens: form.get("allergens") }) });
    const value = await response.json();
    if (!response.ok) {
      setError(value.error);
      return;
    }
    const file = form.get("image");
    if (file instanceof File && file.size > 0) {
      const imageUrl = await uploadFile(file);
      if (imageUrl) await fetch(`/api/admin/menu/${value.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ imageUrl }) });
    }
    target.reset();
    setFeedback("商品を作成しました");
    await reload();
  }

  async function upload(item: Item, file?: File) {
    if (!file) return;
    const imageUrl = await uploadFile(file);
    if (!imageUrl) return;
    await patchItem(item, { imageUrl });
    setFeedback("商品画像を更新しました");
  }

  return <section className="panel menu-admin"><div className="section-title"><div><p className="eyebrow">MENU EDITOR</p><h2>メニュー管理</h2></div><p>画像・カテゴリーも変更できます</p></div><datalist id="menu-categories">{categoryOptions.map((category) => <option value={category} key={category}/>)}</datalist><form className="form-grid menu-create-form" onSubmit={create}><label className="field"><span>商品名</span><input name="name" required maxLength={80}/></label><label className="field"><span>カテゴリー</span><input name="category" list="menu-categories" placeholder="例：ごはん" required maxLength={40}/></label><label className="field full"><span>説明</span><textarea name="description" required maxLength={300}/></label><label className="field"><span>税込価格（円）</span><input name="price" type="number" min="0" step="1" required/></label><label className="field"><span>商品画像</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp"/><small>JPEG・PNG・WebP、5MB以下</small></label><label className="field"><span>原材料</span><input name="ingredients" maxLength={300}/></label><label className="field"><span>アレルゲン</span><input name="allergens" defaultValue="該当なし" maxLength={300}/></label><button className="button">商品を作成</button></form>
    <div className="menu-admin-grid">{menu.map((item) => <article className="menu-admin-card" key={item.id}><div className="menu-admin-image">{item.image_url ? <img src={item.image_url} alt={`${item.name}の商品画像`}/> : <span>NO IMAGE</span>}<label className="image-upload-button">{item.image_url ? "画像を変更" : "画像を追加"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(item, event.target.files?.[0])}/></label></div><div className="menu-admin-body"><input className="menu-name-input" aria-label={`${item.name}の商品名`} defaultValue={item.name} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== item.name) patchItem(item, { name }); }}/><label><small>カテゴリー</small><input list="menu-categories" defaultValue={item.category_id} maxLength={40} onBlur={(event) => { const categoryId = event.target.value.trim(); if (categoryId && categoryId !== item.category_id) patchItem(item, { categoryId }); }}/></label><label><small>税込価格</small><input type="number" min="0" defaultValue={item.price} onBlur={(event) => { const price = Number(event.target.value); if (price !== item.price) patchItem(item, { price }); }}/></label><div className="menu-admin-status"><span>{item.is_published ? "公開" : "非公開"}</span><span>{item.is_sold_out ? "売切" : "販売中"}</span></div><div className="menu-admin-actions"><button className="mini-button" onClick={() => patchItem(item, { isSoldOut: !item.is_sold_out })}>{item.is_sold_out ? "販売再開" : "売切"}</button><button className="mini-button" onClick={() => patchItem(item, { isPublished: !item.is_published })}>{item.is_published ? "非公開" : "公開"}</button><button className="text-button" onClick={() => duplicateItem(item)}>複製</button><button className="text-button danger-text" onClick={() => deleteItem(item)}>削除</button></div></div></article>)}</div>
  </section>;
}

function getMapEmbedUrl(address: string) {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}

function Settings({ csrfToken }: { csrfToken: string }) {
  const [setting, setSetting] = useState<StoreSetting | null>(null);
  const [location, setLocation] = useState<StoreLocation | null>(null);
  const [emailMode, setEmailMode] = useState("preview");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings").then((response) => response.json()).then((value) => {
      setSetting(value.setting);
      setLocation(value.locations?.[0] ?? { id: "loc-today", name: "本日の販売場所", address: "", map_url: "https://maps.google.com/" });
      setEmailMode(value.emailMode ?? "preview");
    });
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const body = { storeName: form.get("storeName"), description: form.get("description"), phone: form.get("phone"), email: form.get("email"), notificationEmail: form.get("notificationEmail"), minimumOrderAmount: Number(form.get("minimumOrderAmount")), orderStatus: form.get("orderStatus"), allergyNotice: form.get("allergyNotice"), completionMessage: form.get("completionMessage"), privacyPolicy: form.get("privacyPolicy"), terms: form.get("terms"), locationId: form.get("locationId"), locationName: form.get("locationName"), locationAddress: form.get("locationAddress"), mapUrl: form.get("mapUrl") };
    const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify(body) });
    const value = await response.json();
    if (response.ok) {
      setSetting((current) => current ? { ...current, store_name: String(body.storeName), description: String(body.description), phone: String(body.phone), email: String(body.email), notification_email: String(body.notificationEmail), minimum_order_amount: Number(body.minimumOrderAmount), order_status: String(body.orderStatus), allergy_notice: String(body.allergyNotice), completion_message: String(body.completionMessage), privacy_policy: String(body.privacyPolicy), terms: String(body.terms) } : current);
      setLocation({ id: String(body.locationId), name: String(body.locationName), address: String(body.locationAddress), map_url: String(body.mapUrl) });
      setMessage("店舗設定と本日の販売場所を保存しました");
    } else setMessage(value.error);
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/password", { method: "PUT", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ currentPassword: form.get("current"), newPassword: form.get("next") }) });
    const value = await response.json();
    setMessage(response.ok ? "パスワードを変更しました。再度ログインしてください。" : value.error);
    if (response.ok) setTimeout(() => { window.location.href = "/admin/login"; }, 1500);
  }

  if (!setting || !location) return <section className="panel"><p>設定を読み込んでいます…</p></section>;

  return <section className="panel settings-panel"><div className="section-title"><div><p className="eyebrow">STORE SETTINGS</p><h2>店舗設定</h2></div><p>保存後すぐにお客様画面へ反映</p></div><form className="form-grid" onSubmit={save}><input type="hidden" name="locationId" value={location.id}/><label className="field"><span>店舗名</span><input name="storeName" defaultValue={setting.store_name} required/></label><label className="field"><span>注文受付状態</span><select name="orderStatus" defaultValue={setting.order_status}><option value="OPEN">注文受付中</option><option value="PREPARING">準備中</option><option value="CLOSED">受付終了</option><option value="TEMPORARY_CLOSED">臨時休業</option></select></label><label className="field full"><span>店舗紹介</span><textarea name="description" defaultValue={setting.description}/></label><div className="settings-section full"><div><p className="eyebrow">TODAY&apos;S LOCATION</p><h3>本日の販売場所</h3></div><div className="form-grid"><label className="field"><span>場所名</span><input name="locationName" value={location.name} onChange={(event) => setLocation((current) => current ? { ...current, name: event.target.value } : current)} required/></label><label className="field"><span>住所</span><input name="locationAddress" value={location.address} onChange={(event) => setLocation((current) => current ? { ...current, address: event.target.value } : current)} required/></label><label className="field full"><span>GoogleマップURL</span><input name="mapUrl" type="url" value={location.map_url} onChange={(event) => setLocation((current) => current ? { ...current, map_url: event.target.value } : current)} required/><small>Googleマップの「共有」からコピーしたリンクを貼り付けます。</small></label></div>{location.address && <iframe className="settings-map" src={getMapEmbedUrl(`${location.name} ${location.address}`)} title="本日の販売場所の地図" loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>}</div><label className="field"><span>電話番号</span><input name="phone" defaultValue={setting.phone}/></label><label className="field"><span>店舗の連絡先メール</span><input name="email" type="email" defaultValue={setting.email} required/></label><label className="field"><span>注文通知先メール</span><input name="notificationEmail" type="email" defaultValue={setting.notification_email} required/></label><label className="field"><span>最低注文金額</span><input name="minimumOrderAmount" type="number" min="0" step="1" defaultValue={setting.minimum_order_amount}/></label><label className="field full"><span>アレルギー注意事項</span><textarea name="allergyNotice" defaultValue={setting.allergy_notice}/></label><label className="field full"><span>注文完了メッセージ</span><textarea name="completionMessage" defaultValue={setting.completion_message}/></label><label className="field full"><span>プライバシーポリシー</span><textarea name="privacyPolicy" defaultValue={setting.privacy_policy}/></label><label className="field full"><span>利用規約</span><textarea name="terms" defaultValue={setting.terms}/></label><button className="button">店舗設定を保存</button></form><div className={`mail-settings-card ${emailMode === "preview" ? "off" : "on"}`}><span className={`signal-dot ${emailMode === "preview" ? "mail-off" : "status-picked_up"}`}/><div><b>{emailMode === "preview" ? "メールは現在送信されません" : "メール送信は有効です"}</b><p>{emailMode === "preview" ? "注文と状態変更は通知履歴にだけ保存されます。" : `注文通知は ${setting.notification_email} へ送信されます。`}</p></div></div><div className="panel password-panel"><h3>管理パスワード変更</h3><form className="form-grid" onSubmit={changePassword}><label className="field"><span>現在のパスワード</span><input name="current" type="password" required/></label><label className="field"><span>新しいパスワード</span><input name="next" type="password" minLength={12} required/><small>英大文字・英小文字・数字を含む12文字以上</small></label><button className="button">変更する</button></form></div>{message && <p className={message.includes("保存しました") || message.includes("変更しました") ? "success" : "error"} role="status">{message}</p>}</section>;
}
