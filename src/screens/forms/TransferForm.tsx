// Arkadaşla para alışverişi ekleme (prototipteki openTransfer)
import { useState } from "react";
import { newId, saveRow } from "../../db/db";
import { useI18n } from "../../i18n/I18n";
import { accountLabels, CURS } from "../../lib/constants";
import type { Dataset } from "../../lib/types";
import { useSaver } from "../../ui/parts";
import { useApp } from "../../ui/state";

export function TransferForm({ ds }: { ds: Dataset }) {
  const { t, val } = useI18n();
  const { setSheet, todayStr, toast } = useApp();
  const save = useSaver();
  const accs = accountLabels(ds.accounts);
  const [f, setF] = useState({ d: todayStr, who: "", dir: "1", amount: "", cur: "PLN", acct: accs[0] ?? "", why: "" });
  const set = (k: keyof typeof f, v: string) => setF((o) => ({ ...o, [k]: v }));
  const onSave = async () => {
    const a = +f.amount;
    if (!(a > 0) || !f.who.trim()) { toast(t.friends.required); return; }
    const row = { id: newId("p"), d: f.d, who: f.who.trim(), acct: f.acct, amount: a * +f.dir, cur: f.cur, why: f.why.trim(), closed: false };
    if (await save(() => saveRow("transfers", row), t.form.added)) setSheet(null);
  };
  return (
    <>
      <h2>{t.friends.formTitle}</h2>
      <form className="form" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <label>{t.form.date}<input type="date" value={f.d} onChange={(e) => set("d", e.target.value)} /></label>
        <label>{t.friends.who}<input value={f.who} onChange={(e) => set("who", e.target.value)} /></label>
        <label>{t.friends.dir}
          <select value={f.dir} onChange={(e) => set("dir", e.target.value)}><option value="1">{t.friends.dirIn}</option><option value="-1">{t.friends.dirOut}</option></select>
        </label>
        <label>{t.form.amount}<input type="number" step="0.01" inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></label>
        <label>{t.form.currency}<select value={f.cur} onChange={(e) => set("cur", e.target.value)}>{CURS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>{t.friends.acct}<select value={f.acct} onChange={(e) => set("acct", e.target.value)}>{accs.map((a) => <option key={a} value={a}>{val(a)}</option>)}</select></label>
        <label className="full">{t.friends.why}<input value={f.why} onChange={(e) => set("why", e.target.value)} /></label>
        <button type="submit" hidden />
      </form>
      <div className="btns">
        <button className="btn" type="button" onClick={() => setSheet(null)}>{t.common.cancel}</button>
        <button className="btn primary" type="button" onClick={onSave}>{t.form.save}</button>
      </div>
    </>
  );
}
