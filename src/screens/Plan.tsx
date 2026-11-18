// Plan ve kontrol (prototipteki vPara): yatırıma ayrılabilir, plan ayarları, gereken/eldeki, para kontrolü,
// aylık gelirler, bakiye kayıtları
import { useEffect, useRef, useState, type ReactNode } from "react";
import { saveRow, saveSettings } from "../db/db";
import { useI18n } from "../i18n/I18n";
import { balTotal, cfg, latestBalance, moneyCheck, plan } from "../lib/calc";
import { FREQ_MONTHLY, IN_CURS } from "../lib/constants";
import { dShort, n0, n2, tl, zl0 } from "../lib/format";
import type { Dataset, Settings, Source } from "../lib/types";
import { Icon } from "../ui/Icon";
import { BankBoxes, TopBar, useSaver } from "../ui/parts";
import { go, useApp } from "../ui/state";
import { GREEN_HERO } from "./Money";

function Stack({ parts }: { parts: [string, number, string][] }) {
  const tot = parts.reduce((s, p) => s + Math.max(0, p[1]), 0) || 1;
  return (
    <div className="stack">
      {parts.filter((p) => p[1] > 0).map((p) => <i key={p[0]} style={{ width: ((p[1] / tot) * 100).toFixed(2) + "%", background: p[2] }} title={p[0]} />)}
    </div>
  );
}

function LineRow({ color, ic, label, sub, val }: { color: string; ic: string; label: string; sub?: string; val: string }) {
  return (
    <div className="lrow">
      <span className="lic" style={{ background: color + "22", color }}><Icon name={ic} /></span>
      <span className="mid"><b>{label}</b>{sub && <span className="s">{sub}</span>}</span>
      <b className="num">{val}</b>
    </div>
  );
}

/** Yazmayı bırakınca (kısa bekleme sonrası) kaydeden sayı kutusu */
function useDebouncedCommit(initial: number | undefined, commit: (v: number) => void, delay = 500) {
  const [v, setV] = useState(initial == null || initial === 0 ? "" : String(initial));
  const first = useRef(true);
  const cb = useRef(commit);
  cb.current = commit;
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const i = setTimeout(() => cb.current(+v || 0), delay);
    return () => clearTimeout(i);
  }, [v, delay]);
  return [v, setV] as const;
}

function Knob({ label, k, initial, unit, step, full, children }: {
  label: ReactNode; k: keyof Settings; initial: number | undefined; unit: string; step: number; full?: boolean; children?: ReactNode;
}) {
  const save = useSaver();
  const [v, setV] = useDebouncedCommit(initial, (n) => save(() => saveSettings({ [k]: n } as Partial<Settings>)));
  return (
    <label className={"knob" + (full ? " full" : "")}>
      <span>{label}</span>
      <span className="kin"><input type="number" step={step} inputMode="decimal" value={v} placeholder="0" onChange={(e) => setV(e.target.value)} /> {unit}</span>
      {children}
    </label>
  );
}

function OverrunKnob({ initial, varBudget }: { initial: number; varBudget: number }) {
  const { t } = useI18n();
  const save = useSaver();
  const [v, setV] = useDebouncedCommit(initial, (n) => save(() => saveSettings({ overrun: n })), 300);
  return (
    <label className="knob full">
      <span>{t.plan.overrun} <b className="num">%{+v || 0}</b></span>
      <input type="range" min={0} max={60} step={5} value={+v || 0} aria-label={t.plan.overrunLabel} onChange={(e) => setV(e.target.value)} />
      <span className="hint">{t.plan.overrunHint(zl0(varBudget * 1.2))}</span>
    </label>
  );
}

function IncomeRow({ s }: { s: Source }) {
  const { t, val } = useI18n();
  const save = useSaver();
  const [v, setV] = useDebouncedCommit(+s.amount || undefined, (n) => save(() => saveRow("sources", { ...s, amount: n }), t.form.saved));
  return (
    <div className="lrow">
      <span className="lic" style={{ background: "var(--good-soft)", color: "var(--good)" }}>
        <Icon name={/hibe/i.test(s.name) ? "graduation-cap" : /kredi/i.test(s.name) ? "landmark" : /aile/i.test(s.name) ? "heart" : "repeat"} />
      </span>
      <span className="mid"><b>{s.name}</b><span className="s">{val(s.freq || "")}{s.note ? " · " + s.note : ""}</span></span>
      <span className="inamt">
        <input type="number" step="0.01" inputMode="decimal" value={v} placeholder={t.plan.enter} aria-label={t.plan.amountOf(s.name)} onChange={(e) => setV(e.target.value)} />
        <select value={s.cur} aria-label={t.form.currency} onChange={(e) => save(() => saveRow("sources", { ...s, cur: e.target.value }), t.form.saved)}>
          {[...new Set([...IN_CURS.slice().sort((a, b) => (a === "TL" ? -1 : b === "TL" ? 1 : 0)), s.cur])].map((o) => <option key={o}>{o}</option>)}
        </select>
      </span>
    </div>
  );
}

export function Plan({ ds }: { ds: Dataset }) {
  const { t } = useI18n();
  const { todayStr, setSheet } = useApp();
  const c = cfg(ds), b = latestBalance(ds), p = plan(ds, todayStr), m = moneyCheck(ds, todayStr), P = c.plntl;
  const src = [...ds.sources].sort((a, x) => (a.order || 0) - (x.order || 0)).filter((s) => s.freq === FREQ_MONTHLY);
  const bals = [...ds.balances].sort((a, x) => (a.d < x.d ? 1 : -1));
  const card = { background: "var(--surface)" };
  const hasLoan = ds.sources.some((s) => /kredi|kyk|loan/i.test(s.name || ""));

  const need: [string, number, string, string, string][] = [
    [t.plan.dailyNeed, p.needVar, "#2350F5", "shopping-cart", t.plan.dailyNeedSub(zl0(p.varBudget), p.over, n2(p.months))],
    ...(c.fixed || []).map((f, i) => [f.name, (+f.amount || 0) * (+f.left || 0), ["#8B5CF6", "#14B8A6", "#F97316", "#EC4899"][i % 4], f.monthly === false ? "calendar" : "repeat",
      +f.amount ? `${zl0(+f.amount)} × ${+f.left || 0}` : t.plan.noAmount] as [string, number, string, string, string]),
    [t.plan.trips, p.needTrip, "#E08A00", "map", p.needTrip ? "" : t.plan.notSet],
    [t.plan.shop, p.needShop, "#D946EF", "shopping-bag", p.needShop ? "" : t.plan.notSet],
    [t.plan.safety, p.buffer, "#94A3B8", "shield", `%${+c.buffer || 0}`],
  ];
  const have: [string, number, string, string, string][] = [
    [t.plan.myMoney, p.pl, "#2350F5", "wallet", b ? t.plan.balanceOf(dShort(b.d)) : ""],
    [t.plan.futureInc, p.inc, "#12A06A", "repeat", `${tl(p.monthlyIncTL)}/${t.plan.perMonth} × ${+c.incomeLeft || 0}`],
    [t.plan.trAccounts, p.tr, "#0EA5E9", "landmark", tl(c.trTL)],
  ];

  return (
    <>
      <TopBar title={t.plan.title} back="para"
        actions={<button className="iconbtn" type="button" aria-label={t.plan.editAssumptions} onClick={() => go("ayarlar")}><Icon name="sliders-horizontal" /></button>} />
      <section className="hero" style={{ background: GREEN_HERO }}>
        <div className="lbl">{t.plan.heroLbl}</div>
        <div className="big num">{n0((p.invest * P) / 1000)}<small>{t.plan.thousandTL}</small></div>
        <div className="sub num">{t.plan.heroSub(tl(p.invest * P), `${dShort(c.end)} ${c.end.slice(0, 4)}`, p.left)}</div>
      </section>
      <div className="stats num" style={{ marginTop: 12 }}>
        <div className="stat" style={card}><span>{t.plan.need}</span><b>{tl(p.need * P)}</b></div>
        <div className="stat" style={card}><span>{t.plan.have}</span><b>{tl((p.pl + p.inc + p.tr) * P)}</b></div>
        <div className="stat" style={card}><span>{t.plan.fromTR}</span><b>{tl(p.fromTR * P)}</b></div>
      </div>

      <section className="card">
        <div className="head"><h2>{t.plan.adjust}</h2><span className="small muted">{t.plan.adjustHint}</span></div>
        <div className="knobs">
          <Knob label={t.plan.budget} k="budget" initial={c.budget} unit="zł" step={50} />
          <OverrunKnob initial={p.over} varBudget={p.varBudget} />
          <Knob label={t.plan.tripBudget} k="tripBudget" initial={c.tripBudget} unit="zł" step={50} />
          <Knob label={t.plan.shopBudget} k="shopBudget" initial={c.shopBudget} unit="zł" step={50} />
          <Knob label={t.plan.buffer} k="buffer" initial={c.buffer} unit="%" step={1} />
        </div>
      </section>

      <section className="card">
        <div className="head"><h2>{t.plan.needTitle}</h2><b className="num">{zl0(p.need)}</b></div>
        <Stack parts={need.map((n) => [n[0], n[1], n[2]])} />
        <div className="lines">{need.map((n, i) => <LineRow key={i} color={n[2]} ic={n[3]} label={n[0]} sub={n[4]} val={zl0(n[1])} />)}</div>
      </section>

      <section className="card">
        <div className="head"><h2>{t.plan.haveTitle}</h2><b className="num">{zl0(p.pl + p.inc + p.tr)}</b></div>
        <Stack parts={have.map((n) => [n[0], n[1], n[2]])} />
        <div className="lines">{have.map((n, i) => <LineRow key={i} color={n[2]} ic={n[3]} label={n[0]} sub={n[4]} val={zl0(n[1])} />)}</div>
        <div className="note"><Icon name="info" /><span>{t.plan.coverNote(p.need ? Math.min(100, Math.round((p.inc / p.need) * 100)) : 0)}{hasLoan ? t.plan.loanNote : ""}</span></div>
      </section>

      <section className="card">
        <div className="head"><h2>{t.plan.check}</h2><span className={"pill " + (m.ok ? "bank" : "warn")}>{m.ok ? t.plan.consistent : t.plan.checkIt}</span></div>
        <div className="small muted" style={{ margin: "-4px 0 10px" }}>{t.plan.checkInfo}</div>
        <div className="stats num">
          <div className="stat"><span>{t.plan.incoming}</span><b>{zl0(m.incoming)}</b></div>
          <div className="stat"><span>{t.plan.remain}</span><b>{zl0(m.remain)}</b></div>
          <div className="stat"><span>{t.plan.spent}</span><b>{zl0(m.spent)}</b></div>
        </div>
        <Stack parts={[[t.plan.recordedShort, m.recorded, "#2350F5"], [t.plan.depositShort, m.deposit, "#8B5CF6"], [t.plan.gapShort, Math.max(0, m.gap), "#E5484D"]]} />
        <div className="lines">
          <LineRow color="#2350F5" ic="receipt" label={t.plan.recorded} sub={`${dShort(m.from)} – ${dShort(m.to)}`} val={zl0(m.recorded)} />
          {m.deposit > 0 && <LineRow color="#8B5CF6" ic="key-round" label={t.plan.deposit} sub={c.depositDate ? dShort(c.depositDate) : ""} val={zl0(m.deposit)} />}
          <LineRow color="#E5484D" ic="circle-help" label={t.plan.gap} sub={t.plan.gapSub(n2(m.gapPct * 100))} val={zl0(m.gap)} />
        </div>
      </section>

      <section className="card">
        <div className="head"><h2>{t.plan.incomes}</h2><span className="small muted">{t.plan.incomesHint}</span></div>
        <div className="lines">{src.map((s) => <IncomeRow key={s.id} s={s} />)}</div>
      </section>

      <section className="card">
        <div className="head"><h2>{t.plan.balances}</h2><button className="linkbtn" type="button" onClick={() => setSheet({ kind: "balance" })}>{t.plan.newBalance}</button></div>
        <div className="lines">
          {bals.map((x, i) => (
            <details className="bal" key={x.id} open={i === 0}>
              <summary className="lrow">
                <span className="lic" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Icon name="calendar" /></span>
                <span className="mid"><b>{dShort(x.d)} {x.d.slice(0, 4)}</b><span className="s">{i === 0 ? t.plan.lastRecord : ""}</span></span>
                <b className="num">{zl0(balTotal(c, ds.accounts, x))}</b>
              </summary>
              <div className="accounts" style={{ margin: "4px 0 12px" }}><BankBoxes accounts={ds.accounts} b={x} /></div>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
