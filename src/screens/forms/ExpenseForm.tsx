// Harcama ekleme / düzenleme (prototipteki openExpense)
import { useEffect, useRef, useState } from "react";
import { newId, removeRow, saveRow } from "../../db/db";
import { useI18n } from "../../i18n/I18n";
import { CATS, CURS, PAY_CASH, PAY_FRIEND, payOptions } from "../../lib/constants";
import type { Dataset, Expense, ExpenseSrc } from "../../lib/types";
import { Icon } from "../../ui/Icon";
import { ConfirmButton, useSaver } from "../../ui/parts";
import { useApp } from "../../ui/state";

const SRCS: ExpenseSrc[] = ["bank", "cash", "friend", "note"];

export function ExpenseForm({ ds, id }: { ds: Dataset; id?: string }) {
  const { t, cat, val } = useI18n();
  const { setSheet, todayStr, toast } = useApp();
  const save = useSaver();
  const orig = id ? ds.expenses.find((e) => e.id === id) : undefined;
  const isNew = !orig;
  const pays = payOptions(ds.accounts, orig?.pay);
  const [f, setF] = useState(() => ({
    d: orig?.d ?? todayStr, desc: orig?.desc ?? "", cat: orig?.cat ?? "Market", pay: orig?.pay ?? pays[0],
    gross: orig ? String(orig.gross) : "", cur: orig?.cur ?? "PLN", share: orig ? String(orig.share) : "",
    trip: orig?.trip ?? "", city: orig?.city ?? "", note: orig?.note ?? "", src: orig?.src ?? ("bank" as ExpenseSrc),
    shared: !!orig && Math.abs((+orig.gross || 0) - (+orig.share || 0)) > 0.005,
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((o) => ({ ...o, [k]: v }));
  const [busy, setBusy] = useState(false);
  const descRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (isNew) setTimeout(() => descRef.current?.focus(), 50); }, [isNew]);

  const onSave = async () => {
    const g = +f.gross, desc = f.desc.trim();
    if (!desc || !(g > 0) || !f.d) {
      toast(t.expense.required);
      return;
    }
    // Mevcut kaydın bilmediğimiz alanları (ör. kind: "deposit") korunur
    const row: Expense = {
      ...(orig ?? {}), id: orig?.id ?? newId("e"),
      d: f.d, desc, cat: f.cat, pay: f.pay, gross: g, cur: f.cur, share: f.shared ? +f.share || 0 : g,
      trip: f.trip, city: f.city.trim(), note: f.note.trim(), src: f.src,
    };
    setBusy(true);
    if (await save(() => saveRow("expenses", row), isNew ? t.form.added : t.form.updated)) setSheet(null);
    setBusy(false);
  };

  return (
    <>
      <h2>{isNew ? t.expense.newTitle : t.expense.editTitle}</h2>
      <form className="form" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <label className="full">{t.expense.desc}<input ref={descRef} placeholder={t.expense.descPh} value={f.desc} onChange={(e) => set("desc", e.target.value)} /></label>
        <label>{t.form.amount}<input type="number" step="0.01" min="0" inputMode="decimal" value={f.gross} onChange={(e) => set("gross", e.target.value)} /></label>
        <label>{t.form.currency}
          <select value={f.cur} onChange={(e) => set("cur", e.target.value)}>
            {[...new Set([...CURS, f.cur])].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>{t.form.date}<input type="date" value={f.d} onChange={(e) => set("d", e.target.value)} /></label>
        <label>{t.expense.category}
          <select value={f.cat} onChange={(e) => set("cat", e.target.value)}>
            {[...new Set([...CATS, f.cat])].map((c) => <option key={c} value={c}>{cat(c)}</option>)}
          </select>
        </label>
        <label>{t.expense.payment}
          <select value={f.pay} onChange={(e) => {
            const p = e.target.value;
            setF((o) => ({ ...o, pay: p, src: p === PAY_CASH ? "cash" : p === PAY_FRIEND ? "friend" : "bank" }));
          }}>
            {pays.map((p) => <option key={p} value={p}>{val(p)}</option>)}
          </select>
        </label>
        <label>{t.expense.trip}
          <select value={f.trip} onChange={(e) => set("trip", e.target.value)}>
            <option value="">{t.expense.noTrip}</option>
            {ds.trips.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label className="full" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink)" }}>
          <input type="checkbox" checked={f.shared} onChange={(e) => set("shared", e.target.checked)} style={{ width: "auto" }} /> {t.expense.shared}
        </label>
        {f.shared && (
          <div className="full">
            <label>{t.expense.myShare}<input type="number" step="0.01" min="0" inputMode="decimal" value={f.share} onChange={(e) => set("share", e.target.value)} /></label>
            <div className="split">
              {[2, 3, 4].map((n) => (
                <button key={n} type="button" className="btn sm" onClick={() => set("share", ((+f.gross || 0) / n).toFixed(2))}>{t.expense.splitN(n)}</button>
              ))}
            </div>
          </div>
        )}
        <label>{t.expense.city}<input value={f.city} onChange={(e) => set("city", e.target.value)} /></label>
        <label>{t.expense.verification}
          <select value={f.src} onChange={(e) => set("src", e.target.value as ExpenseSrc)}>
            {SRCS.map((k) => <option key={k} value={k}>{t.src[k]}</option>)}
          </select>
        </label>
        <label className="full">{t.form.note}<textarea value={f.note} onChange={(e) => set("note", e.target.value)} /></label>
        <button type="submit" hidden />
      </form>
      <div className="btns">
        {!isNew && (
          <ConfirmButton onConfirm={async () => { if (await save(() => removeRow("expenses", orig!.id), t.form.deleted)) setSheet(null); }}>
            <Icon name="trash-2" /> {t.form.delete}
          </ConfirmButton>
        )}
        <button className="btn" type="button" onClick={() => setSheet(null)}>{t.common.cancel}</button>
        <button className="btn primary" type="button" disabled={busy} onClick={onSave}>{t.form.save}</button>
      </div>
    </>
  );
}
