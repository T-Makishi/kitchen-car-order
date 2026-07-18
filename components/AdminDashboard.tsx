"use client";

import { useCallback, useEffect, useState } from "react";
import { formatYen } from "@/lib/domain";

type Order = { id:string; order_number:string; customer_name:string; phone:string; pickup_at:string; pickup_location_name:string; payment_method:string; total:number; status:string; email_status:string; allergy_declaration:string; created_at:string };
type Item = { id:string; name:string; price:number; is_sold_out:number; is_published:number; is_recommended:number; stock:number|null; category_id:string };
type EmailDelivery = { id:string; order_id:string|null; order_number:string|null; type:string; recipient_masked:string; subject:string; status:string; attempts:number; last_error:string|null; created_at:string };
const labels:Record<string,string>={NEW:"新規受付",CONFIRMED:"確認済み",COOKING:"調理中",READY:"受取準備完了",PICKED_UP:"受取済み",CANCELLED:"キャンセル"};
const next:Record<string,string|undefined>={NEW:"CONFIRMED",CONFIRMED:"COOKING",COOKING:"READY",READY:"PICKED_UP"};
const actionLabels:Record<string,string>={CONFIRMED:"注文を確認",COOKING:"調理を開始",READY:"受渡し準備完了",PICKED_UP:"Square決済・受渡し完了"};

export function AdminDashboard({csrfToken}:{csrfToken:string}) {
  const [data,setData]=useState<{orders:Order[];menu:Item[];emails:EmailDelivery[]}>({orders:[],menu:[],emails:[]});
  const [tab,setTab]=useState("orders"); const [filter,setFilter]=useState(""); const [error,setError]=useState("");
  const load=useCallback(async()=>{const response=await fetch("/api/admin/dashboard",{cache:"no-store"});if(response.status===401){location.href="/admin/login";return}setData(await response.json())},[]);
  useEffect(()=>{load();const timer=setInterval(load,30_000);return()=>clearInterval(timer)},[load]);
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo"}).format(new Date());
  const todayOrders=data.orders.filter(order=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo"}).format(new Date(order.pickup_at))===today);
  const sales=todayOrders.filter(order=>order.status!=="CANCELLED").reduce((sum,order)=>sum+order.total,0);

  async function updateOrder(order:Order,status:string){if(!confirm(`注文 ${order.order_number} を「${labels[status]}」へ変更しますか？`))return;const response=await fetch(`/api/admin/orders/${order.id}`,{method:"PATCH",headers:{"Content-Type":"application/json","x-csrf-token":csrfToken},body:JSON.stringify({status})});const value=await response.json();if(!response.ok)setError(value.error);else load()}
  async function patchItem(item:Item,body:Record<string,unknown>){const response=await fetch(`/api/admin/menu/${item.id}`,{method:"PATCH",headers:{"Content-Type":"application/json","x-csrf-token":csrfToken},body:JSON.stringify(body)});if(response.ok)load();else setError((await response.json()).error)}
  async function deleteItem(item:Item){if(!confirm(`「${item.name}」を削除しますか？ 注文履歴がある場合は非公開になります。`))return;const response=await fetch(`/api/admin/menu/${item.id}`,{method:"DELETE",headers:{"x-csrf-token":csrfToken}});const value=await response.json();if(response.ok){if(value.message)alert(value.message);load()}else setError(value.error)}
  async function duplicateItem(item:Item){const response=await fetch("/api/admin/menu",{method:"POST",headers:{"Content-Type":"application/json","x-csrf-token":csrfToken},body:JSON.stringify({name:`${item.name}（複製）`,categoryId:item.category_id,description:"複製した商品です。説明を編集してください。",price:item.price,ingredients:"",allergens:"該当なし",duplicateFrom:item.id})});if(response.ok)load();else setError((await response.json()).error)}
  async function logout(){await fetch("/api/admin/logout",{method:"POST",headers:{"x-csrf-token":csrfToken}});sessionStorage.removeItem("kco_csrf");location.href="/admin/login"}

  return <div className="admin-shell"><header className="admin-header"><div className="shell"><a className="brand" href="/admin" style={{color:"white"}}><span className="brand-mark">M</span><span><small>STAFF OPERATIONS</small>まちの小さなキッチンカー</span></a><div style={{display:"flex",gap:8}}><a className="button secondary" href="/" target="_blank">お客様画面</a><button className="button" onClick={logout}>ログアウト</button></div></div></header><main className="shell admin-main">
    <div className="section-title"><div><p className="eyebrow">SERVICE DASHBOARD</p><h1 style={{fontSize:52}}>今日のオペレーション</h1></div><p>事前注文を30秒ごとに自動確認</p></div>
    {error&&<p className="error">{error}</p>}
    <div className="operation-guide"><div className="operation-card"><strong>店頭注文</strong><div className="operation-flow">店頭で受付 → 調理 → Square端末で決済 → 商品をお渡し</div></div><div className="operation-card"><strong>事前注文</strong><div className="operation-flow">メール・注文一覧で確認 → 調理 → Square端末で決済 → 商品をお渡し</div></div></div>
    <div className="stat-grid" style={{marginTop:20}}><div className="stat"><span>本日の事前注文</span><strong>{todayOrders.length}件</strong></div><div className="stat"><span>受取売上見込</span><strong>{formatYen(sales)}</strong></div><div className="stat"><span>調理中</span><strong>{data.orders.filter(order=>order.status==="COOKING").length}件</strong></div><div className="stat"><span>受取・決済待ち</span><strong>{data.orders.filter(order=>order.status==="READY").length}件</strong></div></div>
    <div className="category-tabs admin-tabs" style={{marginTop:24}}>{[["orders","事前注文"],["notifications","通知履歴"],["menu","メニュー"],["settings","店舗設定"]].map(([key,label])=><button key={key} className={`chip ${tab===key?"active":""}`} onClick={()=>setTab(key)}>{label}{key==="notifications"&&data.emails.length>0?<span>{data.emails.length}</span>:null}</button>)}</div>
    {tab==="orders"&&(
      <OrdersPanel orders={data.orders.filter(order=>!filter||order.status===filter)} filter={filter} setFilter={setFilter} updateOrder={updateOrder}/>
    )}
    {tab==="notifications"&&(
      <NotificationsPanel emails={data.emails}/>
    )}
    {tab==="menu"&&(
      <MenuPanel menu={data.menu} csrfToken={csrfToken} reload={load} setError={setError} patchItem={patchItem} duplicateItem={duplicateItem} deleteItem={deleteItem}/>
    )}
    {tab==="settings"&&(
      <Settings csrfToken={csrfToken}/>
    )}
  </main></div>;
}

function OrdersPanel({orders,filter,setFilter,updateOrder}:{orders:Order[];filter:string;setFilter:(value:string)=>void;updateOrder:(order:Order,status:string)=>void}){return <section className="panel"><div className="section-title"><h2>事前注文キュー</h2><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><select className="select" value={filter} onChange={event=>setFilter(event.target.value)}><option value="">全状態</option>{Object.entries(labels).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select><a className="button secondary" href="/api/admin/orders.csv">CSV出力</a><button className="button secondary" onClick={()=>print()}>印刷</button></div></div>{orders.length===0?<p>該当する事前注文はありません。</p>:<table><thead><tr><th>注文番号／受付</th><th>お客様</th><th>受取</th><th>支払い／通知</th><th>状態</th><th>次の操作</th></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td><b>{order.order_number}</b><br/><span className="order-source">WEB PRE-ORDER</span><br/><small>{new Date(order.created_at).toLocaleString("ja-JP")}</small></td><td>{order.customer_name}<br/><a href={`tel:${order.phone}`}>{order.phone}</a>{order.allergy_declaration&&<><br/><b style={{color:"#9b321c"}}>申告：{order.allergy_declaration}</b></>}</td><td>{new Date(order.pickup_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}<br/>{order.pickup_location_name}</td><td><b>{formatYen(order.total)}</b><br/><small>Square端末・受取時</small><br/><small>メール：{order.email_status}</small></td><td><span className="badge">{labels[order.status]}</span></td><td>{next[order.status]&&<button className="mini-button" onClick={()=>updateOrder(order,next[order.status]!)}>{actionLabels[next[order.status]!]}</button>} {!['PICKED_UP','CANCELLED'].includes(order.status)&&<button className="mini-button" style={{background:"#7f2d20"}} onClick={()=>updateOrder(order,"CANCELLED")}>取消</button>}</td></tr>)}</tbody></table>}</section>}

const emailTypeLabels:Record<string,string>={ORDER_CONFIRMATION:"お客様への注文受付",NEW_ORDER:"店舗への新規注文通知",STATUS_CONFIRMED:"注文確認済み通知",STATUS_COOKING:"調理開始通知",STATUS_READY:"受取準備完了通知",STATUS_PICKED_UP:"受取完了通知",STATUS_CANCELLED:"キャンセル通知"};
const emailStatusLabels:Record<string,string>={PREVIEW:"開発環境に保存",SENT:"送信済み",FAILED:"送信失敗"};
function NotificationsPanel({emails}:{emails:EmailDelivery[]}){return <section className="panel notification-panel"><div className="section-title"><div><p className="eyebrow">ORDER NOTIFICATIONS</p><h2>注文通知・メール履歴</h2></div><p>新しい履歴から最大50件</p></div><div className="notification-guide"><div><b>ローカル確認</b><p>開発環境ではメールを外部送信せず、この画面へ配送内容を保存します。</p></div><div><b>本番運用</b><p>店舗設定の「注文通知先」に登録したメールアドレスへ新規注文通知を送ります。</p></div></div>{emails.length===0?<div className="empty-state"><b>通知履歴はまだありません</b><p>お客様画面から事前注文を送信すると、ここに記録されます。</p></div>:<table><thead><tr><th>日時</th><th>用途</th><th>注文番号</th><th>送信先</th><th>件名</th><th>状態</th></tr></thead><tbody>{emails.map(email=><tr key={email.id}><td>{new Date(email.created_at).toLocaleString("ja-JP")}</td><td>{emailTypeLabels[email.type]??email.type}</td><td>{email.order_number??"—"}</td><td>{email.recipient_masked}</td><td>{email.subject}</td><td><span className={`delivery-status ${email.status.toLowerCase()}`}>{emailStatusLabels[email.status]??email.status}</span>{email.last_error&&<><br/><small className="delivery-error">{email.last_error}</small></>}</td></tr>)}</tbody></table>}</section>}

function MenuPanel({menu,csrfToken,reload,setError,patchItem,duplicateItem,deleteItem}:{menu:Item[];csrfToken:string;reload:()=>void;setError:(value:string)=>void;patchItem:(item:Item,body:Record<string,unknown>)=>void;duplicateItem:(item:Item)=>void;deleteItem:(item:Item)=>void}){
  async function create(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);const response=await fetch("/api/admin/menu",{method:"POST",headers:{"Content-Type":"application/json","x-csrf-token":csrfToken},body:JSON.stringify({name:form.get("name"),categoryId:form.get("category"),description:form.get("description"),price:Number(form.get("price")),ingredients:form.get("ingredients"),allergens:form.get("allergens")})});const value=await response.json();if(response.ok){event.currentTarget.reset();reload()}else setError(value.error)}
  async function upload(item:Item,file?:File){if(!file)return;const body=new FormData();body.append("file",file);const response=await fetch("/api/admin/uploads",{method:"POST",headers:{"x-csrf-token":csrfToken},body});const value=await response.json();if(!response.ok){setError(value.error);return}await patchItem(item,{imageUrl:value.url});alert("画像を商品へ登録しました")}
  return <section className="panel"><h2>メニュー管理</h2><form className="form-grid" onSubmit={create}><label className="field"><span>商品名</span><input name="name" required maxLength={80}/></label><label className="field"><span>カテゴリー</span><select name="category"><option>ごはん</option><option>軽食</option><option>ドリンク</option></select></label><label className="field full"><span>説明</span><textarea name="description" required maxLength={300}/></label><label className="field"><span>税込価格（円）</span><input name="price" type="number" min="0" step="1" required/></label><label className="field"><span>原材料</span><input name="ingredients" maxLength={300}/></label><label className="field full"><span>アレルゲン</span><input name="allergens" defaultValue="該当なし" maxLength={300}/></label><button className="button">新しい商品を作成</button></form>
    <table style={{marginTop:24}}><thead><tr><th>商品</th><th>価格</th><th>在庫／状態</th><th>操作</th></tr></thead><tbody>{menu.map(item=><tr key={item.id}><td><b>{item.name}</b><br/><small>{item.category_id}</small></td><td><input aria-label={`${item.name}の価格`} style={{width:100}} type="number" defaultValue={item.price} onBlur={event=>{const price=Number(event.target.value);if(price!==item.price)patchItem(item,{price})}}/></td><td>{item.stock??"無制限"}<br/>{item.is_published?"公開":"非公開"}／{item.is_sold_out?"売り切れ":"販売中"}</td><td><button className="mini-button" onClick={()=>patchItem(item,{isSoldOut:!item.is_sold_out})}>{item.is_sold_out?"販売再開":"売切"}</button> <button className="mini-button" onClick={()=>patchItem(item,{isPublished:!item.is_published})}>{item.is_published?"非公開":"公開"}</button> <button className="mini-button" onClick={()=>duplicateItem(item)}>複製</button> <button className="mini-button" style={{background:"#7f2d20"}} onClick={()=>deleteItem(item)}>削除</button><br/><label className="chip" style={{display:"inline-block",marginTop:8}}>画像を選択<input style={{display:"none"}} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>upload(item,event.target.files?.[0])}/></label></td></tr>)}</tbody></table>
  </section>;
}

type StoreSetting={store_name:string;description:string;phone:string;email:string;notification_email:string;minimum_order_amount:number;order_status:string;allergy_notice:string;completion_message:string;privacy_policy:string;terms:string};
function Settings({csrfToken}:{csrfToken:string}){
  const [setting,setSetting]=useState<StoreSetting|null>(null);
  const [message,setMessage]=useState("");

  useEffect(()=>{fetch("/api/admin/settings").then(response=>response.json()).then(value=>setSetting(value.setting))},[]);

  async function save(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    setMessage("");
    const form=new FormData(event.currentTarget);
    const body={storeName:form.get("storeName"),description:form.get("description"),phone:form.get("phone"),email:form.get("email"),notificationEmail:form.get("notificationEmail"),minimumOrderAmount:Number(form.get("minimumOrderAmount")),orderStatus:form.get("orderStatus"),allergyNotice:form.get("allergyNotice"),completionMessage:form.get("completionMessage"),privacyPolicy:form.get("privacyPolicy"),terms:form.get("terms")};
    const response=await fetch("/api/admin/settings",{method:"PATCH",headers:{"Content-Type":"application/json","x-csrf-token":csrfToken},body:JSON.stringify(body)});
    const value=await response.json();
    if(response.ok)setSetting(current=>current?{...current,store_name:String(body.storeName),description:String(body.description),phone:String(body.phone),email:String(body.email),notification_email:String(body.notificationEmail),minimum_order_amount:Number(body.minimumOrderAmount),order_status:String(body.orderStatus),allergy_notice:String(body.allergyNotice),completion_message:String(body.completionMessage),privacy_policy:String(body.privacyPolicy),terms:String(body.terms)}:current);
    setMessage(response.ok?"店舗設定を保存しました。次の注文から新しい通知先が使われます。":value.error);
  }

  async function changePassword(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const response=await fetch("/api/admin/password",{method:"PUT",headers:{"Content-Type":"application/json","x-csrf-token":csrfToken},body:JSON.stringify({currentPassword:form.get("current"),newPassword:form.get("next")})});
    const value=await response.json();
    setMessage(response.ok?"パスワードを変更しました。再度ログインしてください。":value.error);
    if(response.ok)setTimeout(()=>location.href="/admin/login",1500);
  }

  if(!setting)return <section className="panel"><p>設定を読み込んでいます…</p></section>;

  return <section className="panel">
    <div className="section-title"><div><p className="eyebrow">STORE SETTINGS</p><h2>店舗設定</h2></div><p>変更後は必ず「店舗設定を保存」を押してください。</p></div>
    <form className="form-grid" onSubmit={save}>
      <label className="field"><span>店舗名</span><input name="storeName" defaultValue={setting.store_name} required/></label>
      <label className="field"><span>注文受付状態</span><select name="orderStatus" defaultValue={setting.order_status}><option value="OPEN">注文受付中</option><option value="PREPARING">準備中</option><option value="CLOSED">受付終了</option><option value="TEMPORARY_CLOSED">臨時休業</option></select></label>
      <label className="field full"><span>店舗紹介</span><textarea name="description" defaultValue={setting.description}/></label>
      <label className="field"><span>電話番号</span><input name="phone" defaultValue={setting.phone}/></label>
      <label className="field"><span>店舗の連絡先メール</span><input name="email" type="email" defaultValue={setting.email} required/><small>お客様画面のお問い合わせ先に表示されます。</small></label>
      <label className="field"><span>注文通知を受け取るメール</span><input name="notificationEmail" type="email" defaultValue={setting.notification_email} required/><small>新しい事前注文のお知らせが届く宛先です。設定画面からいつでも変更できます。</small></label>
      <label className="field"><span>最低注文金額</span><input name="minimumOrderAmount" type="number" min="0" step="1" defaultValue={setting.minimum_order_amount}/></label>
      <label className="field full"><span>アレルギー注意事項</span><textarea name="allergyNotice" defaultValue={setting.allergy_notice}/></label>
      <label className="field full"><span>注文完了メッセージ</span><textarea name="completionMessage" defaultValue={setting.completion_message}/></label>
      <label className="field full"><span>プライバシーポリシー</span><textarea name="privacyPolicy" defaultValue={setting.privacy_policy}/></label>
      <label className="field full"><span>利用規約</span><textarea name="terms" defaultValue={setting.terms}/></label>
      <button className="button">店舗設定を保存</button>
    </form>
    <div className="panel"><h3>メール通知について</h3><p>現在の通知先は <b>{setting.notification_email}</b> です。開発中は実際のメールを送らず「通知履歴」に内容を保存します。本番公開後は、メール送信サービスの接続が完了している場合にこの宛先へ届きます。</p></div>
    <div className="panel"><h3>管理パスワード変更</h3><form className="form-grid" onSubmit={changePassword}><label className="field"><span>現在のパスワード</span><input name="current" type="password" required/></label><label className="field"><span>新しいパスワード</span><input name="next" type="password" minLength={12} required/><small>英大文字・英小文字・数字を含む12文字以上</small></label><button className="button">変更する</button></form></div>
    {message&&<p className={message.includes("保存しました")||message.includes("変更しました")?"success":"error"} role="status">{message}</p>}
  </section>;
}
