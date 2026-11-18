import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18n";
import { byMerchant, cfg, isDep, isPending, live, mine, monthsList, sum, tripOf } from "../lib/calc";
import { CATS } from "../lib/constants";
import { amt, dayName, dShort, mKey, mName, tl, zl, zl0 } from "../lib/format";
import { matches, merchant } from "../lib/search";
import type { Dataset } from "../lib/types";
import { Icon } from "../ui/Icon";
import { AddButton, Avatar, Grouped, SrcPill, TopBar } from "../ui/parts";
import { EMPTY_FILTER, go, useApp, type TxFilter } from "../ui/state";

export function filterTx(ds: Dataset, f: TxFilter) {
  // Arama yapılırken analiz başlangıcından önceki kayıtlar da aranır (prototipteki gibi)
  let list = (f.q.trim() ? ds.expenses : live(ds)).filter((x) => f.period === "all" || mKey(x.d) === f.period);
  if (f.kind === "daily") list = list.filter((x) => !x.trip);
  else if (f.kind === "pending") list = list.filter((x) => isPending(ds, x));
  else if (f.kind !== "all") list = list.filter((x) => x.trip === f.kind);
  if (f.cat) list = list.filter((x) => x.cat === f.cat);
  return list.filter((x) => matches(ds, x, f.q));
}

function kinds(ds: Dataset, t: ReturnType<typeof useI18n>["t"]): [string, string, boolean][] {
  return [["all", t.tx.all, false], ["daily", t.tx.daily, false], ...ds.trips.map((x) => [x.id, x.name, true] as [string, string, boolean]), ["pending", t.tx.pending, false]];
}

export function Transactions({ ds }: { ds: Dataset }) {
  const { t, cat } = useI18n();
  const { filter: f, setFilter, setSheet, setMerchantName } = useApp();
  // Arama kutusu yazarken her harfte değil, kısa bir bekleme sonrası filtrelenir
  const [q, setQ] = useState(f.q);
  useEffect(() => {
    const i = setTimeout(() => setFilter((o) => ({ ...o, q })), 150);
    return () => clearTimeout(i);
  }, [q, setFilter]);
  useEffect(() => setQ(f.q), [f.q]);

  const c = cfg(ds);
  const list = filterTx(ds, f);
  const tot = sum(list, (x) => mine(c, x));
  const filt = !!(f.q.trim() || f.cat || f.kind !== "all" || f.period !== "all");
  const ms = filt ? byMerchant(c, list, (x) => merchant(ds, x)) : [];
  const k = kinds(ds, t).find((x) => x[0] === f.kind) ?? kinds(ds, t)[0];

  return (
    <>
      <TopBar title={t.nav.tx} actions={<AddButton />} />
      <div className="searchbar">
        <Icon name="search" />
        <input id="q" type="search" placeholder={t.tx.placeholder} value={q} aria-label={t.tx.searchLabel} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
        {q && <button type="button" aria-label={t.common.clear} onClick={() => { setQ(""); setFilter((o) => ({ ...o, q: "" })); }}><Icon name="x" /></button>}
      </div>
      <div className="filterbar">
        <button type="button" className={"fbtn" + (f.period !== "all" ? " on" : "")} onClick={() => setSheet({ kind: "picker", which: "period" })}>
          <Icon name="calendar" />{f.period === "all" ? t.tx.allPeriod : mName(f.period)}<Icon name="chevron-down" />
        </button>
        <button type="button" className={"fbtn" + (f.kind !== "all" ? " on" : "")} onClick={() => setSheet({ kind: "picker", which: "kind" })}>
          <Icon name="map" />{k[1]}<Icon name="chevron-down" />
        </button>
        <button type="button" className={"fbtn" + (f.cat ? " on" : "")} onClick={() => setSheet({ kind: "picker", which: "cat" })}>
          <Icon name="layout-grid" />{f.cat ? cat(f.cat) : t.tx.allCats}<Icon name="chevron-down" />
        </button>
        {filt && <button type="button" className="linkbtn small" onClick={() => { setQ(""); setFilter(EMPTY_FILTER); }}>{t.tx.clearFilters}</button>}
      </div>
      <section className="card">
        <div className="sum num">
          <div className="kbig">{zl(tot)}</div>
          <span className="muted small">{t.tx.count(list.length)}{list.length ? ` · ${t.tx.avg} ${zl(tot / list.length)}` : ""} · {tl(tot * c.plntl)}</span>
        </div>
        {filt && ms.length > 1 && (
          <div className="small muted" style={{ marginTop: 6 }}>
            {t.tx.top}{" "}
            {ms.slice(0, 3).map(([n, o], i) => (
              <span key={n}>{i > 0 && " · "}<button type="button" className="linkbtn small" onClick={() => { setMerchantName(n); go("yer"); }}>{n} {zl0(o.v)}</button></span>
            ))}
          </div>
        )}
      </section>
      <section className="card"><div className="list">{list.length ? <Grouped ds={ds} list={list} /> : <div className="empty">{t.tx.noResults}</div>}</div></section>
    </>
  );
}

export function Picker({ ds, which }: { ds: Dataset; which: "period" | "kind" | "cat" }) {
  const { t, cat } = useI18n();
  const { filter: f, setFilter, setSheet, todayStr } = useApp();
  const pick = (key: keyof TxFilter, v: string) => { setFilter((o) => ({ ...o, [key]: v })); setSheet(null); };
  if (which === "cat")
    return (
      <>
        <h2>{t.tx.category}</h2>
        <div className="catgrid">
          <button type="button" className="cattile" aria-pressed={!f.cat} onClick={() => pick("cat", "")}>
            <span className="av" style={{ background: "var(--surface)", color: "var(--ink)" }}><Icon name="layout-grid" /></span>{t.tx.all}
          </button>
          {CATS.map((x) => (
            <button key={x} type="button" className="cattile" aria-pressed={f.cat === x} onClick={() => pick("cat", x)}><Avatar cat={x} />{cat(x)}</button>
          ))}
        </div>
      </>
    );
  if (which === "period")
    return (
      <>
        <h2>{t.tx.period}</h2>
        <div className="catgrid">
          {[["all", t.tx.allPeriod], ...monthsList(ds, todayStr).reverse().map((k) => [k, mName(k)])].map(([v, n]) => (
            <button key={v} type="button" className="cattile" aria-pressed={f.period === v} onClick={() => pick("period", v)}>
              <span className="av" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Icon name="calendar" /></span>{n}
            </button>
          ))}
        </div>
      </>
    );
  return (
    <>
      <h2>{t.tx.kind}</h2>
      <div className="catgrid">
        {kinds(ds, t).map(([v, n, isTrip]) => (
          <button key={v} type="button" className="cattile" aria-pressed={f.kind === v} onClick={() => pick("kind", v)}>
            <span className="av" style={isTrip ? { background: "var(--trip-soft)", color: "var(--trip)" } : { background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Icon name={isTrip ? "map-pin" : v === "pending" ? "scan-line" : v === "daily" ? "house" : "layers"} />
            </span>{n}
          </button>
        ))}
      </div>
    </>
  );
}

export function TxDetail({ ds, id }: { ds: Dataset; id: string }) {
  const { t, cat, val } = useI18n();
  const { setSheet, setMerchantName } = useApp();
  const x = ds.expenses.find((e) => e.id === id);
  if (!x) return null;
  const c = cfg(ds), tr = tripOf(ds, x), shared = Math.abs((+x.gross || 0) - (+x.share || 0)) > 0.005;
  const m = merchant(ds, x);
  return (
    <>
      <div className="txhead">
        <Avatar cat={x.cat} trip={!!tr} name={x.desc} />
        <div className="a num">−{amt(+x.share, x.cur)}</div>
        <div style={{ fontWeight: 800 }}>{x.desc}</div>
        <div className="small muted">{dShort(x.d)} {x.d.slice(0, 4)} · {dayName(x.d)}</div>
      </div>
      <div className="kv">
        <div><span>{t.detail.category}</span><b>{cat(x.cat)}</b></div>
        <div><span>{t.detail.payment}</span><b>{val(x.pay)}</b></div>
        {x.cur === "EUR" && <div><span>{t.detail.plnValue}</span><b className="num">{zl(mine(c, x))}</b></div>}
        {shared && <>
          <div><span>{t.detail.totalPaid}</span><b className="num">{amt(+x.gross, x.cur)}</b></div>
          <div><span>{t.detail.yourShare}</span><b className="num">{amt(+x.share, x.cur)}</b></div>
        </>}
        {tr && <div><span>{t.detail.trip}</span><b>{tr.name}{x.city ? " · " + x.city : ""}</b></div>}
        <div><span>{t.detail.verification}</span><b><SrcPill src={x.src} />{isPending(ds, x) && <> <span className="pill new">{t.tx.isNew}</span></>}</b></div>
        {isDep(x) && <div><span>{t.detail.type}</span><b>{t.detail.depositType}</b></div>}
        {x.note && <div><span>{t.detail.note}</span><b style={{ fontWeight: 600 }}>{x.note}</b></div>}
      </div>
      <div className="btns">
        <button className="btn left" type="button" onClick={() => { setSheet(null); setMerchantName(m); go("yer"); }}><Icon name="store" /> {t.detail.allAt(m)}</button>
        <button className="btn" type="button" onClick={() => setSheet({ kind: "expense", id: x.id })}><Icon name="pencil" /> {t.form.edit}</button>
      </div>
    </>
  );
}

export function Merchant({ ds }: { ds: Dataset }) {
  const { t } = useI18n();
  const { merchantName: n } = useApp();
  if (!n) return (<><TopBar title={t.merchant.title} back="hareketler" /><div className="empty">{t.merchant.empty}</div></>);
  const c = cfg(ds);
  const list = ds.expenses.filter((x) => merchant(ds, x) === n), tot = sum(list, (x) => mine(c, x));
  const months: Record<string, number> = {};
  list.forEach((x) => { const k = mKey(x.d); months[k] = (months[k] || 0) + mine(c, x); });
  return (
    <>
      <TopBar title={n} back="hareketler" />
      <section className="card" style={{ textAlign: "center" }}>
        <div className="txhead">
          <Avatar cat={list[0]?.cat ?? "Diğer"} name={n} />
          <div className="a num">{zl(tot)}</div>
          <div className="muted small">{t.tx.count(list.length)} · {t.tx.avg} {zl(tot / (list.length || 1))} · {tl(tot * c.plntl)}</div>
        </div>
        <div className="stats num" style={{ marginTop: 6 }}>
          {Object.entries(months).sort().slice(-3).map(([k, v]) => <div className="stat" key={k}><span>{mName(k)}</span><b>{zl0(v)}</b></div>)}
        </div>
      </section>
      <section className="card"><div className="list"><Grouped ds={ds} list={list} /></div></section>
    </>
  );
}
