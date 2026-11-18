// Para (prototipteki vMoney): gelen paralar, kaynaklara göre dağılım, Erasmus hibesi
import { useI18n } from "../i18n/I18n";
import { cfg, inPLN, moneySummary } from "../lib/calc";
import { amt, dShort, eu, n0, tl, zl0 } from "../lib/format";
import type { Dataset } from "../lib/types";
import { Icon } from "../ui/Icon";
import { TopBar } from "../ui/parts";
import { go, useApp } from "../ui/state";

const GREEN = "radial-gradient(120% 140% at 100% 0%,#3CCB8F 0%,transparent 55%),linear-gradient(150deg,#0B6B4A,#12A06A 60%,#2BC48A)";
export { GREEN as GREEN_HERO };

export function Money({ ds }: { ds: Dataset }) {
  const { t, val } = useI18n();
  const { setSheet } = useApp();
  const c = cfg(ds), m = moneySummary(ds), g = m.grant;
  const card = { background: "var(--surface)" };
  return (
    <>
      <TopBar title={t.nav.money} actions={<button className="iconbtn primary" type="button" aria-label={t.money.addLabel} onClick={() => setSheet({ kind: "inflow" })}><Icon name="plus" /></button>} />
      <section className="hero" style={{ background: GREEN }}>
        <div className="lbl">{t.money.heroLbl}</div>
        <div className="big num">{n0(m.totEUR)} <small>€</small></div>
        <div className="sub num">{zl0(m.totPL)} · {tl(m.totEUR * c.eurtl)}{m.fees ? ` · ${t.money.fees(zl0(m.fees))}` : ""}</div>
        <div className="accounts">
          {m.bySrc.map(([k, v]) => (
            <div className="acct num" key={k}><div className="an"><span>{val(k)}</span></div><b>{eu(v / c.eurpln)}</b><small>{zl0(v)}</small></div>
          ))}
        </div>
      </section>
      <div className="stats num" style={{ marginTop: 12 }}>
        <div className="stat" style={card}><span>{t.money.spent}</span><b>{zl0(m.spent)}</b></div>
        <div className="stat" style={card}><span>{t.money.left}</span><b>{zl0(m.remain)}</b></div>
        <div className="stat" style={card}><span>{t.money.used}</span><b>%{Math.round(m.usedPct * 100)}</b></div>
      </div>
      {g && (
        <section className="card">
          <div className="head">
            <h2>{t.money.grant}</h2>
            <span className={"pill " + (g.received >= g.total ? "bank" : "friend")}>{g.received >= g.total ? t.money.grantAll : t.money.grantPct(g.total ? Math.round((g.received / g.total) * 100) : 0)}</span>
          </div>
          <div className="kbig num">{eu(g.received)} <small>/ {eu(g.total)}</small></div>
          <div className="meter"><i style={{ width: Math.min(100, g.total ? (g.received / g.total) * 100 : 0).toFixed(1) + "%", background: "var(--good)" }} /></div>
          <div className="kv">
            <div><span>{t.money.grantSent}</span><b className="num">{eu(g.received)}</b></div>
            <div><span>{t.money.grantNet}</span><b className="num">{eu(g.net)}</b></div>
            <div><span>{t.money.grantLeft}</span><b className="num">{eu(Math.max(0, g.total - g.received))}</b></div>
          </div>
          {g.note && <div className="small muted" style={{ marginTop: 8 }}>{g.note}</div>}
        </section>
      )}
      <section className="card">
        <div className="head"><h2>{t.money.inflows}</h2><button className="linkbtn" type="button" onClick={() => setSheet({ kind: "inflow" })}>{t.money.add}</button></div>
        <div className="small muted" style={{ margin: "-4px 0 6px" }}>{t.money.inflowsInfo}</div>
        <div className="list">
          {m.ins.length ? m.ins.map((x) => (
            <button key={x.id} type="button" className="row" onClick={() => setSheet({ kind: "inflow", id: x.id })}>
              <span className="av" style={{ background: "var(--good-soft)", color: "var(--good)" }}>
                <Icon name={x.via === "Nakit getirdim" ? "banknote" : x.source === "Hibe" ? "graduation-cap" : "arrow-down-left"} />
              </span>
              <span className="mid">
                <span className="t" style={{ display: "block" }}>{x.desc}</span>
                <span className="s" style={{ display: "block" }}>{dShort(x.d)} {x.d.slice(0, 4)} · {[x.source, x.via, x.to].filter(Boolean).map(val).join(" · ")}</span>
              </span>
              <span className="amt num" style={{ color: "var(--good)" }}>
                +{amt(+x.amount, x.cur)}<small>{+x.fee ? t.money.feeShort(amt(+x.fee, x.cur)) : ""}{zl0(inPLN(c, x))}</small>
              </span>
            </button>
          )) : <div className="empty">{t.money.none}</div>}
        </div>
      </section>
      <section className="card" style={{ cursor: "pointer" }} onClick={() => go("plan")}>
        <div className="head"><h2>{t.money.planCard}</h2><Icon name="chevron-right" /></div>
        <div className="small muted">{t.money.planCardSub}</div>
      </section>
    </>
  );
}
