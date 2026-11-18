// Ekranlar arasında ortak parçalar (prototipteki "shared pieces" bölümü)
import { useEffect, useRef, type ReactNode } from "react";
import { useI18n } from "../i18n/I18n";
import { cfg, isDep, isPending, mine, sum, tripOf } from "../lib/calc";
import { BANK_FALLBACK, BANK_STYLE, brandOf, catInfo } from "../lib/constants";
import { amt, dayName, dShort, fmtTs, n2, parseD, zl } from "../lib/format";
import { merchant } from "../lib/search";
import type { Account, Balance, Dataset, Expense } from "../lib/types";
import { Icon } from "./Icon";
import { useApp } from "./state";

export function TopBar({ title, back, actions, lead }: { title: string; back?: string; actions?: ReactNode; lead?: ReactNode }) {
  const { t } = useI18n();
  return (
    <header className="topbar">
      {lead}
      {back && (
        <button className="iconbtn back" type="button" aria-label={t.common.back}
          onClick={() => (history.length > 1 ? history.back() : (location.hash = back))}>
          <Icon name="arrow-left" />
        </button>
      )}
      <h1>{title}</h1>
      {actions}
    </header>
  );
}

export function Avatar({ cat, trip, name }: { cat: string; trip?: boolean; name?: string }) {
  const b = name ? brandOf(name) : undefined;
  const badge = trip ? <span className="badge"><Icon name="map-pin" /></span> : null;
  if (b) return <span className="av brand" style={{ background: b[2], color: b[3] }}>{b[1]}{badge}</span>;
  const [ic, col] = catInfo(cat);
  return <span className="av" style={{ background: col + "1F", color: col }}><Icon name={ic} />{badge}</span>;
}

export function SrcPill({ src }: { src: Expense["src"] }) {
  const { t } = useI18n();
  const k = (["bank", "cash", "friend", "note"] as const).includes(src) ? src : "note";
  return <span className={"pill " + k}>{t.src[k]}</span>;
}

/** Hesapları bankaya göre gruplar: [banka, hesaplar][] */
export function groupBanks(accounts: Account[]) {
  const m = new Map<string, Account[]>();
  for (const a of accounts) m.set(a.bank, [...(m.get(a.bank) || []), a]);
  return [...m.entries()];
}

export function BankBoxes({ accounts, b }: { accounts: Account[]; b?: Balance }) {
  if (!b) return null;
  return (
    <>
      {groupBanks(accounts).map(([bank, accs], i) => {
        const [ic, bg] = BANK_STYLE[bank] ?? [bank.charAt(0).toUpperCase(), BANK_FALLBACK[i % BANK_FALLBACK.length]];
        return (
          <div className="bank num" style={{ background: bg }} key={bank}>
            <div className="bn"><i>{ic}</i>{bank}</div>
            {accs.map((a) => {
              const v = +(b.amounts[a.id] ?? 0) || 0;
              return <div className={"ln" + (v ? "" : " zero")} key={a.id}>{n2(v)}<span>{a.cur}</span></div>;
            })}
          </div>
        );
      })}
    </>
  );
}

export function UpdLine({ ds }: { ds: Dataset }) {
  const { t } = useI18n();
  const m = ds.meta || {}, p = ds.expenses.filter((x) => isPending(ds, x)).length;
  return (
    <div className="upd">
      {t.upd.lastEntry} {fmtTs(m.lastEdit)} · {t.upd.bankCheck} {m.bankCheckedThrough ? t.upd.until(dShort(m.bankCheckedThrough)) : t.upd.none}
      {p > 0 && <> · <b style={{ color: "var(--accent)" }}>{t.upd.pending(p)}</b></>}
    </div>
  );
}

export function TxRow({ ds, x, showDate }: { ds: Dataset; x: Expense; showDate?: boolean }) {
  const { t, cat } = useI18n();
  const { setSheet } = useApp();
  const c = cfg(ds), tr = tripOf(ds, x);
  const shared = Math.abs((+x.gross || 0) - (+x.share || 0)) > 0.005;
  const forOthers = !+x.share && !isDep(x);
  const sub = [showDate ? dShort(x.d) : null, tr ? tr.name : cat(x.cat), shared ? t.tx.shared : null].filter(Boolean).join(" · ");
  return (
    <button type="button" className="row" onClick={() => setSheet({ kind: "tx", id: x.id })}>
      <Avatar cat={x.cat} trip={!!tr} name={x.desc} />
      <span className="mid">
        <span className="t" style={{ display: "block" }}>
          {merchant(ds, x)}
          {isPending(ds, x) && <> <span className="pill new">{t.tx.isNew}</span></>}
        </span>
        <span className="s" style={{ display: "block" }}>
          {isDep(x) && <><span className="pill friend">{t.tx.deposit}</span> </>}
          {forOthers && <><span className="pill friend">{t.tx.forOthers}</span> </>}
          {sub}
        </span>
        {(shared || x.pay === "Arkadaş ödedi") && x.note && <span className="s txnote" style={{ display: "block" }}>{x.note}</span>}
      </span>
      <span className="amt num">
        {forOthers ? (
          <><span style={{ color: "var(--muted)", textDecoration: "line-through" }}>{amt(+x.gross, x.cur)}</span><small>{t.tx.yourShare0}</small></>
        ) : (
          <>
            −{amt(+x.share, x.cur)}
            {x.cur === "EUR" ? <small>{zl(mine(c, x))}{shared ? ` · ${t.tx.total} ${amt(+x.gross, x.cur)}` : ""}</small>
              : shared ? <small>{t.tx.total} {amt(+x.gross, x.cur)}</small> : null}
          </>
        )}
      </span>
    </button>
  );
}

/** Güne göre gruplanmış hareket listesi */
export function Grouped({ ds, list }: { ds: Dataset; list: Expense[] }) {
  const c = cfg(ds);
  const g = new Map<string, Expense[]>();
  [...list].sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0)).forEach((x) => g.set(x.d, [...(g.get(x.d) || []), x]));
  const thisYear = new Date().getFullYear();
  return (
    <>
      {[...g.entries()].map(([d, xs]) => (
        <div key={d}>
          <div className="day">
            <span>{dShort(d)} {parseD(d).getFullYear() !== thisYear ? parseD(d).getFullYear() : ""}· {dayName(d)}</span>
            <span className="num">−{zl(sum(xs, (x) => mine(c, x)))}</span>
          </div>
          {xs.map((x) => <TxRow key={x.id} ds={ds} x={x} />)}
        </div>
      ))}
    </>
  );
}

/** Alttan açılan sayfa (prototipteki dialog) */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="sheet"><div className="grab" />{open && children}</div>
    </dialog>
  );
}

export function Toast() {
  const { toastMsg, toastOn } = useApp();
  return <div className={"toast" + (toastOn ? " on" : "")} role="status">{toastMsg}</div>;
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
