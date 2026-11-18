// Geziler (prototipteki vTrips / vTrip): liste, gezi detayı, gezi içinde arama, kategori ve şehir dağılımı
import { useEffect, useState } from "react";
import { removeRow } from "../db/db";
import { useI18n } from "../i18n/I18n";
import { byCat, cfg, mine, sum, tripBankDiff, tripCities, tripStats } from "../lib/calc";
import { dShort, eu, n0, tl, zl, zl0 } from "../lib/format";
import { matches, norm } from "../lib/search";
import type { Dataset, Trip } from "../lib/types";
import { Icon } from "../ui/Icon";
import { CatRows, ConfirmButton, Grouped, TopBar, useSaver } from "../ui/parts";
import { go, useApp } from "../ui/state";

/** Hızlı arama düğmeleri: ekranda gösterilen ad sözlükten, aranan kelime buradan (veri Türkçe) */
const QUICK = ["McDonald's", "Pizza", "Hostel", "Magnet", "Ulaşım"];

const dates = (t: Trip) => (t.start ? dShort(t.start) + (t.end && t.end !== t.start ? " – " + dShort(t.end) : "") : "");

export function Trips({ ds }: { ds: Dataset }) {
  const { t } = useI18n();
  const { setSheet } = useApp();
  const c = cfg(ds);
  const trips = [...ds.trips].sort((a, b) => (a.start < b.start ? 1 : -1));
  const all = sum(ds.expenses.filter((x) => x.trip), (x) => mine(c, x));
  return (
    <>
      <TopBar title={t.nav.trips} actions={<button className="iconbtn primary" type="button" aria-label={t.trips.newLabel} onClick={() => setSheet({ kind: "trip" })}><Icon name="plus" /></button>} />
      <div className="small muted">{t.trips.summary(trips.length, zl0(all), tl(all * c.plntl))}</div>
      {trips.length ? trips.map((tr) => {
        const s = tripStats(ds, tr);
        return (
          <button key={tr.id} type="button" className="tripcard" onClick={() => go("gezi-" + tr.id)}>
            <h3>{tr.name}</h3>
            <div className="s">{t.trips.cardSub(dates(tr), s.days, s.xs.length)}</div>
            <div className="v num">{zl0(s.tot)}</div>
            <div className="s num">{eu(s.tot / c.eurpln)} · {tl(s.tot * c.plntl)}</div>
          </button>
        );
      }) : <div className="empty">{t.trips.none}</div>}
    </>
  );
}

export function TripDetail({ ds, id }: { ds: Dataset; id: string }) {
  const { t } = useI18n();
  const { setSheet, toast } = useApp();
  const save = useSaver();
  const tr = ds.trips.find((x) => x.id === id);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => { const i = setTimeout(() => setDq(q), 150); return () => clearTimeout(i); }, [q]);
  useEffect(() => { setQ(""); setDq(""); }, [id]);
  if (!tr) return (<><TopBar title={t.trips.title} back="geziler" /><div className="empty">{t.trips.notFound}</div></>);

  const c = cfg(ds), st = tripStats(ds, tr);
  const xs = st.xs.filter((x) => matches(ds, x, dq)), tot = sum(xs, (x) => mine(c, x));
  const cities = tripCities(ds, tr, t.trips.otherCity);
  const maxCity = Math.max(1, ...cities.map(([, o]) => o.v));
  const diff = tripBankDiff(ds, tr);
  const toggle = (w: string) => { const v = norm(q) === norm(w) ? "" : w; setQ(v); setDq(v); };

  return (
    <>
      <TopBar title={tr.name} back="geziler" actions={<button className="iconbtn" type="button" aria-label={t.trips.formEdit} onClick={() => setSheet({ kind: "trip", id: tr.id })}><Icon name="pencil" /></button>} />
      <section className="hero" style={{ background: "linear-gradient(140deg,#C46A00,#F09A1A 60%,#FFC24D)" }}>
        <div className="lbl">{dates(tr)} {tr.start ? tr.start.slice(0, 4) : ""} · {t.trips.heroSub(st.days)}{tr.with ? " · " + tr.with : ""}</div>
        <div className="big num">{n0(st.tot)} <small>zł</small></div>
        <div className="sub num">{eu(st.tot / c.eurpln)} · {tl(st.tot * c.plntl)} · {t.trips.perDay(zl0(st.days ? st.tot / st.days : 0))}</div>
        {diff != null && <div className="sub" style={{ marginTop: 8, fontWeight: 700 }}>{Math.abs(diff) < 1 ? t.trips.bankOk : t.trips.bankDiff(zl0(diff))}</div>}
      </section>
      <div className="searchbar" style={{ marginTop: 12 }}>
        <Icon name="search" />
        <input type="search" placeholder={t.trips.searchPh} value={q} aria-label={t.trips.searchLabel} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
        {q && <button type="button" aria-label={t.common.clear} onClick={() => { setQ(""); setDq(""); }}><Icon name="x" /></button>}
      </div>
      <div className="chips">
        {QUICK.map((w, i) => (
          <button key={w} type="button" className="chip" aria-pressed={norm(q) === norm(w)} onClick={() => toggle(w)}>{t.trips.quick[i] ?? w}</button>
        ))}
      </div>
      <section className="card">
        <div className="sum num"><div className="kbig">{zl(tot)}</div><span className="muted small">{t.analysis.count(xs.length)} · {eu(tot / c.eurpln)}</span></div>
      </section>
      <section className="card"><div className="list">{xs.length ? <Grouped ds={ds} list={xs} /> : <div className="empty">{t.trips.noMatch}</div>}</div></section>
      <section className="card"><div className="head"><h2>{t.trips.byCat}</h2></div><CatRows rows={byCat(c, st.xs)} total={st.tot} /></section>
      {cities.length > 1 && (
        <section className="card">
          <div className="head"><h2>{t.trips.byCity}</h2></div>
          <div className="bars">
            {cities.map(([k, o]) => (
              <button key={k} type="button" className="catrow" onClick={() => toggle(k)}>
                <span className="av" style={{ background: "var(--trip-soft)", color: "var(--trip)" }}><Icon name="map-pin" /></span>
                <span className="mid">
                  <b>{k}</b><span className="small muted"> · {t.analysis.count(o.n)}</span>
                  <span className="track" style={{ display: "block" }}><i style={{ width: ((o.v / maxCity) * 100).toFixed(1) + "%", background: "var(--trip)" }} /></span>
                </span>
                <span className="amt num">{zl(o.v)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {tr.note && <section className="card small muted">{tr.note}</section>}
      <div className="btns" style={{ justifyContent: "center" }}>
        <ConfirmButton className="btn sm danger" onConfirm={async () => {
          if (st.xs.length) { toast(t.trips.moveFirst(st.xs.length)); return; }
          if (await save(() => removeRow("trips", tr.id), t.trips.deleted)) go("geziler");
        }}><Icon name="trash-2" /> {t.trips.del}</ConfirmButton>
      </div>
    </>
  );
}
