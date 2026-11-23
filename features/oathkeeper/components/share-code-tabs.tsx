"use client";
import { useId, useState } from "react";
import { QRCode } from "@/components/ui/qr-code";

/** Presentation only: never creates or broadens an invite. QR rendering is local. */
export function ShareCodeTabs({ code, defaultUrl = "", label = "Invite", allowDestination = true }: { code: string; defaultUrl?: string; label?: string; allowDestination?: boolean }) {
  const [mode, setMode] = useState<"manual" | "qr">("manual");
  const [destination, setDestination] = useState(defaultUrl);
  const [status, setStatus] = useState("");
  const id = useId();
  let value = code, error = "";
  if (destination.trim()) {
    try {
      const url = new URL(destination);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error();
      url.hash = code; value = url.href;
    } catch { error = "Enter a complete http:// or https:// destination URL."; }
  }
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setStatus("Copied"); }
    catch { setStatus("Could not copy automatically. Select the code and copy it manually."); }
  };
  const field = "w-full min-w-0 rounded-xl border border-black bg-black/55 px-3 py-2.5 text-base sm:text-[13px] leading-5 text-white/85 shadow-[inset_0_1px_3px_rgb(0_0_0/.5)]";
  return <div className="grid min-w-0 gap-4">
    <div role="tablist" aria-label="Share format" className="grid grid-cols-2 gap-[3px] rounded-xl bg-[#08090a] p-[3px]">
      {(["manual", "qr"] as const).map((tab, index) => <button key={tab} id={`${id}-${tab}`} role="tab" type="button" tabIndex={mode === tab ? 0 : -1} aria-selected={mode === tab} aria-controls={`${id}-panel`} onClick={() => { setMode(tab); setStatus(""); }} onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "manual" : event.key === "End" ? "qr" : index ? "manual" : "qr"; setMode(next); document.getElementById(`${id}-${next}`)?.focus(); } }} className={`h-9 rounded-[9px] text-[10px] font-semibold uppercase tracking-[.1em] ${mode === tab ? "bg-[var(--oathkeeper-panel,#202224)] text-white/85 shadow-sm" : "text-white/35"}`}>{tab === "manual" ? "Manual ID" : "QR code"}</button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${mode}`} className="grid min-w-0 gap-3">
      {mode === "manual" ? <><label className="grid gap-2 text-xs text-white/60">{label}<textarea readOnly rows={4} className={field} value={code} onFocus={event => event.currentTarget.select()}/></label><button type="button" disabled={!code} className="lab-primary oathkeeper-raised-control rounded-xl px-3 py-2.5 text-xs" onClick={() => void copy(code)}>Copy code</button></> : <>
        {allowDestination ? <><label className="grid gap-2 text-xs text-white/60">Destination URL (optional)<input type="url" className={field} placeholder="https://your-app.example/vibeghost" value={destination} onChange={event => { setDestination(event.target.value); setStatus(""); }}/></label>
        <p className="text-[11px] leading-5 text-white/35">Leave blank to encode the connection code. Set a compatible app URL to open it with this invite.</p></> : null}
        {error ? <p role="alert" className="text-xs text-[#efa09a]">{error}</p> : code ? <div className="mx-auto w-full max-w-[268px] rounded-xl bg-white p-3"><QRCode value={value} size={244} errorCorrectionLevel="M" bgColor="#ffffff" fgColor="#08090a" className="h-auto w-full" aria-label={`${label} QR code`}/></div> : null}
        <button type="button" disabled={!!error || !code} className="lab-primary oathkeeper-raised-control rounded-xl px-3 py-2.5 text-xs" onClick={() => void copy(value)}>Copy {destination.trim() ? "invite link" : "code"}</button>
      </>}
    </div>
    <p role="status" className="text-xs text-white/50">{status}</p>
  </div>;
}
