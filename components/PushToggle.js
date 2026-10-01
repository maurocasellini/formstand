"use client";
import { useEffect, useState } from "react";

const toKey = (b64) => { const p = "=".repeat((4 - (b64.length % 4)) % 4); const raw = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };

// Morgen-Erinnerung per Push ein- und ausschalten (pro Gerät).
export default function PushToggle({ publicKey, save, remove, test }) {
  const [state, setState] = useState("loading"); // loading | unsupported | ios | denied | off | on
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState(ios && !standalone ? "ios" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg && (await reg.pushManager.getSubscription());
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true); setMsg(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
      const r = await save(sub.toJSON());
      if (r?.error) { await sub.unsubscribe(); setMsg(r.error); return; }
      setState("on"); setMsg("Aktiv. Ab morgen früh kommt die Erinnerung.");
    } catch (e) { setMsg("Hat nicht geklappt: " + (e.message || e)); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true); setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg && (await reg.pushManager.getSubscription());
      if (sub) { await remove(sub.endpoint); await sub.unsubscribe(); }
      setState("off");
    } finally { setBusy(false); }
  }
  async function sendTest() { setBusy(true); const r = await test(); setMsg(r?.ok || r?.error); setBusy(false); }

  if (state === "loading") return <p className="note">Prüfe dieses Gerät…</p>;
  if (state === "ios") return <p className="note">Auf dem iPhone: in Safari unten auf <b>Teilen</b> → <b>Zum Home-Bildschirm</b>. Formstand dann vom Home-Bildschirm öffnen und hier die Erinnerung aktivieren.</p>;
  if (state === "unsupported") return <p className="note">Dieser Browser unterstützt keine Push-Nachrichten.</p>;
  if (state === "denied") return <p className="note">Mitteilungen sind für Formstand blockiert. In den Browser- bzw. Systemeinstellungen erlauben und neu laden.</p>;
  return (
    <div className="btnrow">
      {state === "off" ? <button className="btn" onClick={enable} disabled={busy}>{busy ? "Aktiviere…" : "Erinnerung auf diesem Gerät aktivieren"}</button>
        : <><span className="tag on">aktiv auf diesem Gerät</span><button className="btn ghost sm" onClick={sendTest} disabled={busy}>Test senden</button><button className="btn ghost sm" onClick={disable} disabled={busy}>Ausschalten</button></>}
      {msg && <span className="note" style={{ flexBasis: "100%" }}>{msg}</span>}
    </div>
  );
}
