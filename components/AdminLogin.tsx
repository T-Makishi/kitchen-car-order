"use client";
/* eslint-disable @next/next/no-img-element -- ユーザー提供の実車写真を背景として表示するため */

import { useEffect, useState } from "react";

type SetupStatus = { setupRequired: boolean; setupConfigured: boolean };

export function AdminLogin(){
  const [setup,setSetup]=useState(false);
  const [setupStatus,setSetupStatus]=useState<SetupStatus|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    fetch("/api/admin/setup",{cache:"no-store"})
      .then(response=>response.json())
      .then((status:SetupStatus)=>{setSetupStatus(status);if(status.setupRequired)setSetup(true)})
      .catch(()=>setSetupStatus(null));
  },[]);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    setLoading(true);
    setError("");
    const form=new FormData(event.currentTarget);
    const url=setup?"/api/admin/setup":"/api/admin/login";
    const body=setup
      ?{setupToken:form.get("token"),loginId:form.get("loginId"),password:form.get("password")}
      :{loginId:form.get("loginId"),password:form.get("password")};
    try{
      const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const data=await response.json();
      if(!response.ok){if(data.setupRequired)setSetup(true);throw new Error(data.error)}
      if(setup){setSetup(false);setError("初回設定が完了しました。作成した管理者IDとパスワードでログインしてください。")}else{sessionStorage.setItem("kco_csrf",data.csrfToken);location.assign("/admin")}
    }catch(reason){setError(reason instanceof Error?reason.message:"処理に失敗しました")}finally{setLoading(false)}
  }

  return <main className="login-page">
    <section className="login-visual" aria-label="まちの小さなキッチンカー">
      <img src="/og.png" alt=""/>
      <div className="login-visual-copy"><p>STAFF OPERATIONS</p><h2>SMALL TRUCK.<br/><em>SMOOTH SERVICE.</em></h2></div>
    </section>
    <section className="login-panel"><div className="login-card">
      <a className="brand" href="/"><span className="brand-mark">M</span><span><small>MACHI NO CHIISANA</small>まちの小さなキッチンカー</span></a>
      <h1>{setup?"初回管理者設定":"管理画面ログイン"}</h1>
      <p>{setup?"この作業は最初の1回だけです。普段使う管理者IDとパスワードをここで作ります。":"作成済みの管理者IDとパスワードを入力すると、注文管理画面へ入れます。"}</p>
      <div className="login-tabs" role="tablist" aria-label="管理画面の入口">
        <button type="button" className={setup?"":"active"} onClick={()=>{setSetup(false);setError("")}}>ログイン（普段はこちら）</button>
        <button type="button" className={setup?"active":""} disabled={setupStatus?.setupRequired===false} onClick={()=>{setSetup(true);setError("")}}>{setupStatus?.setupRequired===false?"初回登録（完了済み）":"初回登録（最初の1回）"}</button>
      </div>
      <div className="login-guide" aria-live="polite">
        <b>{setup?"初回登録の手順":"通常ログインの手順"}</b>
        {setup
          ?<ol><li>公開時に発行した「初回登録キー」を入力</li><li>自分で決めた管理者IDとパスワードを入力</li><li>登録後、「ログイン（普段はこちら）」から入る</li></ol>
          :<ol><li>初回登録で作った管理者IDを入力</li><li>初回登録で作ったパスワードを入力</li><li>「ログイン」を押す</li></ol>}
        {setup&&setupStatus&&<p className={setupStatus.setupConfigured?"setup-ready":"setup-missing"}>{setupStatus.setupConfigured?"✓ 初回登録キーは設定済みです":"初回登録キーがアプリに設定されていません"}</p>}
        {!setup&&setupStatus?.setupRequired===false&&<p className="setup-ready">✓ 初回登録は完了しています。普段はこちらからログインします。</p>}
      </div>
      <form className="stack" onSubmit={submit}>
        {setup&&<label className="field"><span>初回登録キー</span><input name="token" type="password" required minLength={12} autoComplete="off"/><small>管理者本人だけが最初の登録に使う、一度限りの合鍵です。公開準備の際に発行します。</small></label>}
        <label className="field"><span>{setup?"これから使う管理者ID":"管理者ID"}</span><input name="loginId" required minLength={4} maxLength={40} pattern="[A-Za-z0-9._-]+" autoComplete="username" placeholder="例：kitchen-owner"/><small>{setup?"ご自身で決めます。半角英数字と . _ - が使えます。":"初回登録のときにご自身で決めたIDです。"}</small></label>
        <label className="field"><span>{setup?"これから使う管理パスワード":"管理パスワード"}</span><input name="password" type="password" required minLength={setup?12:1} autoComplete={setup?"new-password":"current-password"}/><small>{setup?"ご自身で決めます。12文字以上で、英大文字・英小文字・数字を含めます。":"初回登録のときにご自身で決めたパスワードです。"}</small></label>
        {error&&<p className={error.includes("完了")?"success":"error"} role="alert">{error}</p>}
        <button className="button" disabled={loading||(setup&&setupStatus?.setupConfigured===false)}>{loading?"確認しています…":setup?"管理者アカウントを作成":"ログイン"}</button>
      </form>
      {setup&&<div className="setup-help"><b>大切な点</b><br/>初回登録キー、管理者ID、管理パスワードは別のものです。初回登録キーは最初の登録だけに使い、普段のログインには管理者IDと管理パスワードだけを使います。</div>}
    </div></section>
  </main>;
}
