// Banka dökümü içe aktarma: dosya seç → önizleme (yeni / mükerrer / iade / transfer / atlanan) → onay → yaz.
// Önizleme sırasında veritabanına hiçbir şey yazılmaz.
import { useMemo, useRef, useState, type ReactNode } from "react";
import { applyImport, isEmpty, loadAll } from "../db/db";
import { useI18n } from "../i18n/I18n";
import { CATS } from "../lib/constants";
import { amt, dShort, fmtTs } from "../lib/format";
import { buildPreview, countBy, planImport, type ImportItem, type Preview } from "../lib/importer";
import { StatementError, parseStatement } from "../lib/revolut";
import type { Dataset } from "../lib/types";
import { Icon } from "../ui/Icon";
import { Avatar, TopBar, useSaver } from "../ui/parts";
import { go, useApp } from "../ui/state";
import { downloadBackup } from "./Settings";

export function Import({ ds }: { ds: Dataset }) {
  const { t } = useI18n();
  const { toast } = useApp();
  const save = useSaver();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState("");
  const [pv, setPv] = useState<Preview | null>(null);
  const [orig, setOrig] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const T = t.imp;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const rows = parseStatement(await f.text());
      const p = buildPreview(ds, rows, { bank: "Revolut", feeDesc: { exchange: T.feeExchange, other: T.feeOther }, checkedThrough: ds.meta.bankCheckedThrough });
      setFile(f.name);
      setPv(p);
      setOrig(Object.fromEntries(p.items.filter((i) => i.expense).map((i) => [i.ref, i.expense!.cat])));
      setConfirming(false);
    } catch (e) {
      if (e instanceof StatementError) toast(e.code === "columns" ? T.errColumns(e.detail) : T.errEmpty);
      else toast(t.errors.readFile);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const update = (ref: string, fn: (i: ImportItem) => ImportItem) => {
    setConfirming(false);
    setPv((p) => (p ? { ...p, items: p.items.map((i) => (i.ref === ref ? fn(i) : i)) } : p));
  };

  const refundNote = (a: number, cur: string, d: string) => T.refundNote(amt(a, cur), dShort(d) + " " + d.slice(0, 4));
  const plan = useMemo(() => (pv ? planImport(ds, pv.items, refundNote, orig) : null), [pv, ds, orig]); // eslint-disable-line react-hooks/exhaustive-deps
  const nRefund = pv ? pv.items.filter((i) => i.selected && i.status === "refund" && i.refundTarget).length : 0;
  // Eşleşen ama henüz banka kimliği olmayan mevcut kayıtlar (onayda "bankayla eşleşti" olarak işaretlenir)
  const nMark = pv ? pv.items.filter((i) => i.status === "dup" && i.match && !(i.match.table === "expenses" ? ds.expenses : ds.transfers).find((x) => x.id === i.match!.id)?.bankRef).length : 0;
  const nRules = plan ? Object.keys(plan.rules).length : 0;
  const nSel = plan ? plan.expenses.length + plan.transfers.length + nRefund : 0;
  const anything = !!plan && (nSel + nMark + nRules > 0);

  const onConfirm = async () => {
    if (!plan || !pv) return;
    setBusy(true);
    const ok = await save(async () => {
      // Kural: kullanıcının verisini etkileyen her değişiklikten önce yedek al
      if (!(await isEmpty())) await downloadBackup();
      // Yedekten sonra veri değişmiş olabilir diye plan güncel veriyle yeniden hesaplanır
      const fresh = await loadAll();
      const p2 = planImport(fresh, pv.items, refundNote, orig);
      await applyImport(p2, { at: new Date().toISOString(), file, from: pv.from, to: pv.to, added: p2.expenses.length, dup: countBy(pv.items).dup });
    }, T.done(plan.expenses.length));
    setBusy(false);
    if (ok) { setPv(null); setConfirming(false); go("hareketler"); }
  };

  const li = ds.meta.lastImport;
  const c = pv ? countBy(pv.items) : null;
  const of = (s: ImportItem["status"][]) => (pv ? pv.items.filter((i) => s.includes(i.status)) : []);

  return (
    <>
      <TopBar title={T.title} back="daha" />
      <section className="card">
        <div className="small muted">{T.intro}</div>
        <div className="note"><Icon name="info" /><span>{T.how}</span></div>
        {li && <div className="small muted" style={{ marginTop: 8 }}>{T.lastImport(fmtTs(li.at), li.added)}</div>}
        <div className="btns" style={{ justifyContent: "flex-start" }}>
          <button className={"btn" + (pv ? "" : " primary")} type="button" onClick={() => fileRef.current?.click()}><Icon name="upload" /> {pv ? T.another : T.pick}</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </section>

      {pv && c && (
        <>
          <section className="card">
            <div className="head"><h2 style={{ overflowWrap: "anywhere" }}>{file}</h2></div>
            <div className="small muted">{pv.from && T.range(dShort(pv.from) + " " + pv.from.slice(0, 4), dShort(pv.to) + " " + pv.to.slice(0, 4))}</div>
            <div className="chips" style={{ marginTop: 8 }}>
              {(Object.keys(c) as (keyof typeof c)[]).filter((k) => c[k]).map((k) => (
                <span key={k} className={"pill " + (k === "new" ? "new" : k === "dup" ? "bank" : k === "unmatched-old" || k === "refund-nomatch" ? "warn" : k === "skip" ? "" : "friend")}>{T.c[k]} {c[k]}</span>
              ))}
            </div>
            {!of(["new", "unmatched-old", "transfer", "refund"]).length && <div className="note"><Icon name="info" /><span>{T.nothing}</span></div>}
          </section>

          <Section title={T.secNew} info={T.secNewInfo + (pv.items.some((i) => i.row.posted) ? " " + T.postedHint : "")} items={of(["new"])}>
            {(i) => <ExpenseItem key={i.ref} ds={ds} it={i} update={update} orig={orig} />}
          </Section>
          <Section title={T.secOld} info={T.secOldInfo(ds.meta.bankCheckedThrough ? dShort(ds.meta.bankCheckedThrough) : "")} items={of(["unmatched-old"])}>
            {(i) => <ExpenseItem key={i.ref} ds={ds} it={i} update={update} orig={orig} />}
          </Section>
          <Section title={T.secRefund} items={of(["refund", "refund-done", "refund-nomatch"])}>
            {(i) => (
              <Row key={i.ref} it={i} update={update} disabled={i.status !== "refund"}
                sub={i.status === "refund-nomatch" ? T.refundNone : i.refundTarget ? (i.status === "refund-done" ? T.refundDone + " · " : "") + T.refundTo(i.refundTarget.isNew ? T.refundToNew : i.refundTarget.label, dShort(i.refundTarget.d)) : ""}
                warn={i.status !== "refund" ? undefined : i.oldPeriod ? T.refundOld : /iade|refund|zwrot/i.test(ds.expenses.find((x) => x.id === i.refundTarget?.id)?.note ?? "") ? T.refundNoteHint : undefined} plus />
            )}
          </Section>
          <Section title={T.secTransfer} info={T.secTransferInfo} items={of(["transfer"]).filter((i) => !i.tripName)}>
            {(i) => <Row key={i.ref} it={i} update={update} sub={i.transfer!.who} plus={i.row.amount > 0} />}
          </Section>
          {[...new Set(of(["transfer"]).map((i) => i.tripName).filter(Boolean))].map((tn) => (
            <Section key={tn} title={T.secTripTransfer(tn!)} info={T.secTripTransferInfo} items={of(["transfer"]).filter((i) => i.tripName === tn)} collapsed>
              {(i) => <Row key={i.ref} it={i} update={update} sub={i.transfer!.who} plus={i.row.amount > 0} />}
            </Section>
          ))}
          <Section title={T.secDup} items={of(["dup"])} collapsed>
            {(i) => (
              <Row key={i.ref} it={i} update={update} disabled
                sub={T.matched(i.match!.label, dShort(i.match!.d)) + " · " + (i.match!.viaNote ? T.dupNote : i.match!.exact ? (ds.expenses.some((x) => x.bankRef === i.ref) || ds.transfers.some((x) => x.bankRef === i.ref) ? T.dupRef : T.dupExact) : T.dupLoose)} />
            )}
          </Section>
          <Section title={T.secSkip} items={of(["skip"])} collapsed>
            {(i) => <Row key={i.ref} it={i} update={update} disabled sub={T.skip[i.skip!] ?? i.row.type} plus={i.row.amount > 0} />}
          </Section>

          {anything && !confirming && (
            <div className="btns" style={{ justifyContent: "center" }}>
              <button className="btn primary" type="button" onClick={() => setConfirming(true)}>{nSel ? T.review(nSel) : T.markOnly}</button>
            </div>
          )}
          {confirming && plan && (
            <section className="card" style={{ border: "2px solid var(--accent)" }}>
              <div className="head"><h2>{T.confirmTitle}</h2></div>
              <div className="lines small">
                {plan.expenses.length > 0 && <div className="lrow">{T.willAdd(plan.expenses.length)}</div>}
                {nRefund > 0 && <div className="lrow">{T.willRefund(nRefund)}</div>}
                {plan.transfers.length > 0 && <div className="lrow">{T.willTransfer(plan.transfers.length)}</div>}
                {nMark > 0 && <div className="lrow">{T.willMark(nMark)}</div>}
                {nRules > 0 && <div className="lrow">{T.willRules(nRules)}</div>}
              </div>
              <div className="note"><Icon name="database-backup" /><span>{T.backupFirst}</span></div>
              <div className="btns">
                <button className="btn" type="button" onClick={() => setConfirming(false)}>{t.common.cancel}</button>
                <button className="btn primary" type="button" disabled={busy} onClick={onConfirm}>{T.yes}</button>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function Section({ title, info, items, collapsed, children }: { title: string; info?: string; items: ImportItem[]; collapsed?: boolean; children: (i: ImportItem) => ReactNode }) {
    if (!items.length) return null;
    const body = (<>{info && <div className="small muted" style={{ margin: "-4px 0 6px" }}>{info}</div>}<div className="list">{items.map(children)}</div></>);
    if (collapsed)
      return (
        <section className="card">
          <details><summary className="head" style={{ cursor: "pointer", listStyle: "none" }}><h2>{title} · {items.length}</h2><Icon name="chevron-down" /></summary>{body}</details>
        </section>
      );
    return (<section className="card"><div className="head"><h2>{title} · {items.length}</h2></div>{body}</section>);
  }

type Upd = (r: string, f: (i: ImportItem) => ImportItem) => void;

function Row({ it, update, sub, disabled, plus, warn, children }: {
    it: ImportItem; update: (r: string, f: (i: ImportItem) => ImportItem) => void; sub?: string; disabled?: boolean; plus?: boolean; warn?: string; children?: ReactNode;
  }) {
    const a = Math.abs(it.row.amount);
    return (
      <div className="row" style={{ cursor: "default", alignItems: "flex-start", opacity: disabled && it.status !== "dup" && it.status !== "refund-done" ? 0.7 : 1 }}>
        <input type="checkbox" checked={it.selected} disabled={disabled} aria-label={it.row.desc}
          onChange={(e) => update(it.ref, (i) => ({ ...i, selected: e.target.checked }))} style={{ width: 20, height: 20, marginTop: 11, flex: "none" }} />
        <Avatar cat={it.expense?.cat ?? (it.isFee ? "Banka & Kur Masrafı" : "Diğer")} name={it.row.desc} trip={!!it.expense?.trip} />
        <span className="mid">
          <span className="t" style={{ display: "block" }}>{it.isFee ? it.expense!.desc : it.row.desc}</span>
          <span className="s" style={{ display: "block" }}>{dShort(it.row.d)} {it.row.d.slice(0, 4)}{it.row.state === "PENDING" ? " · PENDING" : ""}</span>
          {sub && <span className="s" style={{ display: "block", whiteSpace: "normal" }}>{sub}</span>}
          {warn && <span className="s" style={{ display: "block", whiteSpace: "normal", color: "var(--bad)" }}>{warn}</span>}
          {children}
        </span>
        <span className="amt num" style={{ color: plus ? "var(--good)" : undefined }}>{plus ? "+" : "−"}{amt(a, it.row.cur)}</span>
      </div>
    );
  }

function ExpenseItem({ ds, it, update, orig }: { ds: Dataset; it: ImportItem; update: Upd; orig: Record<string, string> }) {
    const { t, cat } = useI18n();
    const T = t.imp;
    const x = it.expense!;
    const setX = (patch: Partial<typeof x>) => update(it.ref, (i) => ({ ...i, expense: { ...i.expense!, ...patch } }));
    const selStyle = { border: 0, background: "var(--surface2)", borderRadius: 10, padding: "6px 8px", fontSize: 13, fontWeight: 600, maxWidth: "100%", minWidth: 0 };
    return (
      <Row it={it} update={update} sub={it.catSource && it.catSource !== "default" && orig[it.ref] === x.cat ? T.catSrc[it.catSource] : undefined}>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          <select style={selStyle} value={x.cat} aria-label={t.expense.category} onChange={(e) => setX({ cat: e.target.value })}>
            {CATS.map((k) => <option key={k} value={k}>{cat(k)}</option>)}
          </select>
          {ds.trips.length > 0 && (
            <select style={selStyle} value={x.trip} aria-label={t.expense.trip} onChange={(e) => setX({ trip: e.target.value })}>
              <option value="">{T.noTrip}</option>
              {ds.trips.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
            </select>
          )}
        </span>
      </Row>
    );
  }
