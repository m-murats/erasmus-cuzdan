// Para girişi ekleme / düzenleme (prototipteki openInflow)
import { useState } from "react";
import { newId, removeRow, saveRow } from "../../db/db";
import { useI18n } from "../../i18n/I18n";
import { accountLabels, INSRC, IN_CURS, VIA } from "../../lib/constants";
import type { Dataset, Inflow } from "../../lib/types";
import { ConfirmButton, useSaver } from "../../ui/parts";
import { useApp } from "../../ui/state";

const opts = (l: string[], keep: string) => (keep && !l.includes(keep) ? [...l, keep] : l);

export function InflowForm({ ds, id }: { ds: Dataset; id?: string }) {
  const { t, val } = useI18n();
  const { setSheet, todayStr, toast } = useApp();
  const save = useSaver();
  const orig = id ? ds.inflows.find((x) => x.id === id) : undefined;
  const accs = accountLabels(ds.accounts, orig?.to);
  const [f, setF] = useState({
    d: orig?.d ?? todayStr, desc: orig?.desc ?? "", amount: orig ? String(orig.amount) : "", cur: orig?.cur ?? "EUR",
    fee: orig && +orig.fee ? String(orig.fee) : "", source: orig?.source ?? "Aile desteği", via: orig?.via ?? "Wise",
    to: orig?.to ?? (accs.find((a) => a.endsWith("EUR")) ?? accs[0] ?? ""), note: orig?.note ?? "",
    pln: orig?.pln != null && (orig.pln as unknown) !== "" ? String(orig.pln) : "",
  });
  const set = (k: keyof typeof f, v: string) => setF((o) => ({ ...o, [k]: v }));
  const onSave = async () => {
    const a = +f.amount;
    if (!(a > 0) || !f.desc.trim()) { toast(t.money.required); return; }
    const row: Inflow = {
      ...(orig ?? {}), id: orig?.id ?? newId("f"), d: f.d, desc: f.desc.trim(), amount: a, cur: f.cur, fee: +f.fee || 0,
      source: f.source, via: f.via, to: f.to, note: f.note.trim(),
    };
    if (f.pln.trim() !== "") row.pln = +f.pln;
    else delete row.pln;
    if (await save(() => saveRow("inflows", row), t.form.saved)) setSheet(null);
  };
  const sel = (k: "cur" | "source" | "via" | "to", list: string[]) => (
    <select value={f[k]} onChange={(e) => set(k, e.target.value)}>
      {opts(list, f[k]).map((o) => <option key={o} value={o}>{val(o)}</option>)}
    </select>
  );
  return (
    <>
      <h2>{orig ? t.money.formEdit : t.money.formNew}</h2>
      <form className="form" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <label className="full">{t.money.desc}<input value={f.desc} placeholder={t.money.descPh} onChange={(e) => set("desc", e.target.value)} /></label>
        <label>{t.money.amount}<input type="number" step="0.01" inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></label>
        <label>{t.form.currency}{sel("cur", IN_CURS)}</label>
        <label>{t.money.fee}<input type="number" step="0.01" inputMode="decimal" value={f.fee} placeholder="0" onChange={(e) => set("fee", e.target.value)} /></label>
        <label>{t.form.date}<input type="date" value={f.d} onChange={(e) => set("d", e.target.value)} /></label>
        <label>{t.money.source}{sel("source", INSRC)}</label>
        <label>{t.money.via}{sel("via", VIA)}</label>
        <label className="full">{t.money.to}{sel("to", accs)}</label>
        <label className="full">{t.money.pln}<input type="number" step="0.01" inputMode="decimal" value={f.pln} placeholder={t.money.plnPh} onChange={(e) => set("pln", e.target.value)} /></label>
        <label className="full">{t.form.note}<input value={f.note} onChange={(e) => set("note", e.target.value)} /></label>
        <button type="submit" hidden />
      </form>
      <div className="btns">
        {orig && <ConfirmButton onConfirm={async () => { if (await save(() => removeRow("inflows", orig.id), t.form.deleted)) setSheet(null); }}>{t.form.delete}</ConfirmButton>}
        <button className="btn" type="button" onClick={() => setSheet(null)}>{t.common.cancel}</button>
        <button className="btn primary" type="button" onClick={onSave}>{t.form.save}</button>
      </div>
    </>
  );
}
