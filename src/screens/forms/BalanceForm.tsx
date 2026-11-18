// Bakiye güncelleme (prototipteki openBalance) — hesaplar dinamik listeden gelir
import { useState } from "react";
import { saveRow } from "../../db/db";
import { useI18n } from "../../i18n/I18n";
import { latestBalance } from "../../lib/calc";
import type { Balance, Dataset } from "../../lib/types";
import { useSaver } from "../../ui/parts";
import { useApp } from "../../ui/state";

export function BalanceForm({ ds }: { ds: Dataset }) {
  const { t, val } = useI18n();
  const { setSheet, todayStr } = useApp();
  const save = useSaver();
  const last = latestBalance(ds);
  const [d, setD] = useState(todayStr);
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(ds.accounts.map((a) => [a.id, last?.amounts[a.id] != null ? String(last.amounts[a.id]) : ""])));
  const onSave = async () => {
    if (!d) return;
    const id = "b" + d.replace(/-/g, "");
    const prev = ds.balances.find((x) => x.id === id);
    // Aynı güne ikinci kayıt öncekinin yerine geçer (prototipteki gibi); bilinmeyen hesap tutarları korunur
    const row: Balance = { ...(prev ?? {}), id, d, amounts: { ...(prev?.amounts ?? {}), ...Object.fromEntries(ds.accounts.map((a) => [a.id, +v[a.id] || 0])) } };
    if (await save(() => saveRow("balances", row), t.plan.balSaved)) setSheet(null);
  };
  return (
    <>
      <h2>{t.plan.balTitle}</h2>
      <div className="small muted" style={{ margin: "-6px 0 12px" }}>{t.plan.balInfo}</div>
      <form className="form" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <label className="full">{t.form.date}<input type="date" value={d} onChange={(e) => setD(e.target.value)} /></label>
        {ds.accounts.map((a) => (
          <label key={a.id}>{val(a.bank)} {a.cur}
            <input type="number" step="0.01" inputMode="decimal" value={v[a.id] ?? ""} onChange={(e) => setV((o) => ({ ...o, [a.id]: e.target.value }))} />
          </label>
        ))}
        <button type="submit" hidden />
      </form>
      <div className="btns">
        <button className="btn" type="button" onClick={() => setSheet(null)}>{t.common.cancel}</button>
        <button className="btn primary" type="button" onClick={onSave}>{t.form.save}</button>
      </div>
    </>
  );
}
