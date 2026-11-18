// Arkadaşlar (prototipteki vFriends): açık hesaplar ve transferler
import { useEffect, useState } from "react";
import { saveRow } from "../db/db";
import { useI18n } from "../i18n/I18n";
import { openFriends } from "../lib/calc";
import { amt, dShort, zl } from "../lib/format";
import type { Dataset, Transfer } from "../lib/types";
import { Icon } from "../ui/Icon";
import { TopBar, useSaver } from "../ui/parts";
import { useApp } from "../ui/state";

function TransferRow({ x }: { x: Transfer }) {
  const { t } = useI18n();
  const save = useSaver();
  const [why, setWhy] = useState(x.why);
  useEffect(() => setWhy(x.why), [x.why]);
  const commitWhy = () => { if (why !== x.why) save(() => saveRow("transfers", { ...x, why }), t.form.saved); };
  const inc = x.amount > 0;
  return (
    <div className="row" style={{ cursor: "default" }}>
      <span className="av" style={{ background: inc ? "var(--good-soft)" : "var(--surface2)", color: inc ? "var(--good)" : "var(--muted)" }}>{(x.who || "?")[0]}</span>
      <span className="mid">
        <span className="t" style={{ display: "block" }}>{x.who}</span>
        <input value={why} placeholder={t.friends.why} aria-label={t.friends.why} onChange={(e) => setWhy(e.target.value)} onBlur={commitWhy}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          style={{ border: 0, background: "var(--surface2)", borderRadius: 8, padding: "4px 8px", width: "100%", fontSize: 13, marginTop: 3 }} />
      </span>
      <span className="amt num" style={{ color: inc ? "var(--good)" : "var(--ink)" }}>
        {inc ? "+" : ""}{amt(+x.amount, x.cur)}
        <small>{dShort(x.d)}{" "}
          <label style={{ fontWeight: 700 }}>
            <input type="checkbox" checked={!!x.closed} onChange={(e) => save(() => saveRow("transfers", { ...x, closed: e.target.checked }), t.form.saved)} /> {t.friends.closed}
          </label>
        </small>
      </span>
    </div>
  );
}

export function Friends({ ds }: { ds: Dataset }) {
  const { t } = useI18n();
  const { setSheet } = useApp();
  const of = openFriends(ds), ts = [...ds.transfers].sort((a, b) => (a.d < b.d ? 1 : -1));
  return (
    <>
      <TopBar title={t.friends.title} back="daha" actions={<button className="iconbtn primary" type="button" aria-label={t.friends.addLabel} onClick={() => setSheet({ kind: "transfer" })}><Icon name="plus" /></button>} />
      <section className="card">
        <div className="head"><h2>{t.friends.open}</h2></div>
        {of.length ? of.map(([p, v]) => (
          <div className="row" style={{ cursor: "default" }} key={p}>
            <span className="av" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{p[0]}</span>
            <span className="mid"><span className="t" style={{ display: "block" }}>{p}</span><span className="s" style={{ display: "block" }}>{v > 0 ? t.friends.sentYou : t.friends.youSent}</span></span>
            <span className="amt num" style={{ color: v > 0 ? "var(--good)" : "var(--bad)" }}>{v > 0 ? "+" : ""}{zl(v)}</span>
          </div>
        )) : <div className="empty">{t.friends.none}</div>}
      </section>
      <section className="card">
        <div className="head"><h2>{t.friends.transfers}</h2></div>
        <div className="small muted" style={{ marginBottom: 6 }}>{t.friends.info}</div>
        <div className="list">{ts.length ? ts.map((x) => <TransferRow key={x.id} x={x} />) : <div className="empty">{t.friends.noTransfers}</div>}</div>
      </section>
    </>
  );
}
