const API_BASE = "https://machino-kitchen-car.makishi0520.chatgpt.site";
const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const state = { menu: [], locations: [], pickupTimes: [], setting: {}, cart: [] };

const $ = (selector) => document.querySelector(selector);
const apiUrl = (path) => `${API_BASE}${path}`;
const formatYen = (value) => yen.format(Number(value || 0));
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function absoluteAsset(url) {
  if (!url) return "";
  return url.startsWith("http") ? url : apiUrl(url);
}

function cartTotal() {
  return state.cart.reduce((sum, line) => {
    const item = state.menu.find((value) => value.id === line.itemId);
    return sum + (item ? item.price * line.quantity : 0);
  }, 0);
}

function renderCartBadge() {
  const count = state.cart.reduce((sum, line) => sum + line.quantity, 0);
  $("[data-cart-count]").textContent = String(count).padStart(2, "0");
  $("[data-cart-total]").textContent = formatYen(cartTotal());
  $("[data-cart-summary]").textContent = `${count}点`;
  $("[data-cart-bar]").hidden = count === 0;
}

function renderFilters() {
  const categories = ["すべて", ...new Set(state.menu.map((item) => item.category))];
  $("[data-category]").innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
}

function renderMenu() {
  const query = $("[data-search]").value.trim();
  const category = $("[data-category]").value || "すべて";
  const items = state.menu.filter((item) => {
    const matchesCategory = category === "すべて" || item.category === category;
    const matchesQuery = `${item.name}${item.description}${item.ingredients}`.includes(query);
    return matchesCategory && matchesQuery;
  });
  $("[data-menu]").innerHTML = items.map((item) => `
    <article class="menu-card">
      <div class="menu-image">${item.imageUrl ? `<img src="${escapeAttr(absoluteAsset(item.imageUrl))}" alt="">` : "TODAY'S FOOD"}</div>
      <div class="menu-body">
        <small>${escapeHtml(item.category)}</small>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <p>アレルゲン：${escapeHtml(item.allergens)}</p>
        <div class="price-row">
          <span class="price">${formatYen(item.price)}</span>
          <button class="mini" type="button" data-add="${escapeAttr(item.id)}" ${item.soldOut ? "disabled" : ""}>${item.soldOut ? "売切" : "追加"}</button>
        </div>
      </div>
    </article>
  `).join("") || "<p>表示できる商品がありません。</p>";
}

function renderLocation() {
  const location = state.locations[0];
  if (!location) {
    $("[data-location]").innerHTML = "<p>本日の販売場所は準備中です。</p>";
    return;
  }
  const mapQuery = encodeURIComponent(`${location.name} ${location.address}`);
  $("[data-location]").innerHTML = `
    <div class="location-card">
      <div class="location-copy">
        <h3>${escapeHtml(location.name)}</h3>
        <p>${escapeHtml(location.address)}</p>
        <a class="button" href="${escapeAttr(location.mapUrl)}" target="_blank" rel="noreferrer">Googleマップで開く</a>
      </div>
      <iframe src="https://www.google.com/maps?q=${mapQuery}&output=embed" title="${escapeAttr(location.name)}の地図" loading="lazy"></iframe>
    </div>
  `;
}

function openCart() {
  const body = $("[data-dialog-body]");
  const total = cartTotal();
  const minimum = Number(state.setting.minimum_order_amount || 0);
  if (!state.cart.length) {
    body.innerHTML = '<div class="dialog-inner"><h2>カート</h2><p>カートは空です。</p></div>';
    $("[data-dialog]").showModal();
    return;
  }
  const lines = state.cart.map((line) => {
    const item = state.menu.find((value) => value.id === line.itemId);
    if (!item) return "";
    return `<div class="cart-line"><div><b>${escapeHtml(item.name)} × ${line.quantity}</b></div><b>${formatYen(item.price * line.quantity)}</b></div>`;
  }).join("");
  body.innerHTML = `
    <div class="dialog-inner">
      <h2>注文内容</h2>
      ${lines}
      <div class="total"><span>合計</span><span>${formatYen(total)}</span></div>
      ${total < minimum ? `<p class="error">最低注文金額は${formatYen(minimum)}です。</p>` : ""}
      <form data-order-form class="form-grid">
        <label>氏名<input name="customerName" required maxlength="80" autocomplete="name"></label>
        <label>フリガナ<input name="customerNameKana" required maxlength="80"></label>
        <label>電話番号<input name="phone" required inputmode="tel" autocomplete="tel" placeholder="090-1234-5678"></label>
        <label>メール<input name="email" type="email" required autocomplete="email"></label>
        <label>受取日<input name="pickupDate" type="date" required min="${today()}" value="${today()}"></label>
        <label>受取時間<select name="pickupTime" required>${state.pickupTimes.map((time) => `<option>${escapeHtml(time)}</option>`).join("")}</select></label>
        <label class="full">受取場所<select name="locationId" required>${state.locations.map((location) => `<option value="${escapeAttr(location.id)}">${escapeHtml(location.name)}</option>`).join("")}</select></label>
        <label class="full">注文への要望<textarea name="note" maxlength="500"></textarea></label>
        <label class="full">アレルギー申告<textarea name="allergyDeclaration" maxlength="500"></textarea></label>
        <label class="full"><input name="privacyAccepted" type="checkbox" required> プライバシーポリシーに同意します</label>
        <button class="button full" type="submit" ${total < minimum ? "disabled" : ""}>注文を確定する</button>
      </form>
      <p data-form-error></p>
    </div>
  `;
  $("[data-dialog]").showModal();
}

async function submitOrder(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {
    idempotencyKey: uuid(),
    customerName: form.get("customerName"),
    customerNameKana: form.get("customerNameKana"),
    phone: form.get("phone"),
    email: form.get("email"),
    pickupDate: form.get("pickupDate"),
    pickupTime: form.get("pickupTime"),
    locationId: form.get("locationId"),
    paymentMethod: "SQUARE_AT_PICKUP",
    note: form.get("note") || "",
    allergyDeclaration: form.get("allergyDeclaration") || "",
    privacyAccepted: form.get("privacyAccepted") === "on",
    items: state.cart.map((line) => ({ itemId: line.itemId, quantity: line.quantity, optionChoiceIds: [], note: "" })),
  };
  const error = $("[data-form-error]");
  error.className = "";
  error.textContent = "送信中です";
  try {
    const response = await fetch(apiUrl("/api/orders"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "注文を確定できませんでした");
    state.cart = [];
    renderCartBadge();
    $("[data-dialog-body]").innerHTML = `
      <div class="dialog-inner success">
        <h2>注文を受け付けました</h2>
        <p>注文番号<br><b>${escapeHtml(data.order.orderNumber)}</b></p>
        <p>確認コード<br><b>${escapeHtml(data.order.verificationCode)}</b></p>
        <p>受取時のお支払い：${formatYen(data.order.total)}</p>
      </div>
    `;
  } catch (reason) {
    error.className = "error";
    error.textContent = reason instanceof Error ? reason.message : "通信エラーが発生しました";
  }
}

function openStatus() {
  $("[data-dialog-body]").innerHTML = `
    <div class="dialog-inner">
      <h2>注文状況を確認</h2>
      <form data-status-form class="form-grid">
        <label>注文番号<input name="orderNumber" required placeholder="KH-XXXXXXXXXX"></label>
        <label>確認コード<input name="verificationCode" required pattern="[0-9]{6}" maxlength="6" inputmode="numeric"></label>
        <button class="button full" type="submit">確認する</button>
      </form>
      <p data-status-result></p>
    </div>
  `;
  $("[data-dialog]").showModal();
}

async function submitStatus(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const result = $("[data-status-result]");
  result.className = "";
  result.textContent = "確認中です";
  try {
    const response = await fetch(apiUrl("/api/orders/status"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber: form.get("orderNumber"), verificationCode: form.get("verificationCode") }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "注文を確認できませんでした");
    result.className = "success";
    result.textContent = `現在の状態：${data.order.status}／受取場所：${data.order.pickup_location_name}／合計：${formatYen(data.order.total)}`;
  } catch (reason) {
    result.className = "error";
    result.textContent = reason instanceof Error ? reason.message : "通信エラーが発生しました";
  }
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

document.addEventListener("click", (event) => {
  const add = event.target.closest("[data-add]");
  if (add) {
    state.cart.push({ itemId: add.dataset.add, quantity: 1 });
    renderCartBadge();
  }
  if (event.target.closest("[data-open-cart]")) openCart();
  if (event.target.closest("[data-open-status]")) openStatus();
  if (event.target.closest("[data-close-dialog]")) $("[data-dialog]").close();
});

document.addEventListener("submit", (event) => {
  if (event.target.matches("[data-order-form]")) submitOrder(event);
  if (event.target.matches("[data-status-form]")) submitStatus(event);
});

$("[data-search]").addEventListener("input", renderMenu);
$("[data-category]").addEventListener("change", renderMenu);

try {
  const response = await fetch(apiUrl("/api/public/bootstrap"), { cache: "no-store" });
  const data = await response.json();
  state.menu = data.menu || [];
  state.locations = data.locations || [];
  state.pickupTimes = data.pickupTimes || [];
  state.setting = data.setting || {};
  $("[data-open-state]").textContent = state.setting.order_status === "OPEN" ? "事前注文受付中" : "受付停止中";
  renderFilters();
  renderMenu();
  renderLocation();
  renderCartBadge();
} catch {
  $("[data-open-state]").textContent = "接続確認中";
  $("[data-menu]").innerHTML = '<p class="error">メニューを読み込めませんでした。</p>';
}
