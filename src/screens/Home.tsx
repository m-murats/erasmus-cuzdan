import { BarController, BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { Bar } from "react-chartjs-2";
import { useI18n } from "../i18n/I18n";
import { cfg, latestBalance, live, mine, monthSummary, openFriends, plan, sum, isPending } from "../lib/calc";
import { dShort, mKey, monthName, n0, prevMonth, tl, zl, zl0, daysBetween } from "../lib/format";
import type { Dataset } from "../lib/types";
import { Icon } from "../ui/Icon";
import { BankBoxes, TopBar, TxRow, UpdLine, esc } from "../ui/parts";
import { go, useApp } from "../ui/state";

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

const BACKUP_DAYS = 14;

export function Home({ ds }: { ds: Dataset }) {
  const { t } = useI18n();
  const { todayStr, toast } = useApp();
  const c = cfg(ds);
  const empty = ds.expenses.length === 0 && ds.balances.length === 0;

  const top = (
    <TopBar
      title={t.appTitle}
      lead={<button className="iconbtn" type="button" aria-label={t.common.menu} onClick={() => go("daha")} style={{ marginRight: 2 }}><Icon name="user-round" /></button>}
      actions={<button className="iconbtn" type="button" aria-label={t.common.search} onClick={() => { go("hareketler"); setTimeout(() => document.getElementById("q")?.focus(), 80); }}><Icon name="search" /></button>}
    />
  );

  if (empty) {
    return (
      <>
        {top}
        <section className="card" style={{ textAlign: "center" }}>
          <p className="muted">{t.home.empty}</p>
          <button className="btn primary" type="button" onClick={() => go("ayarlar")}><Icon name="upload" /> {t.home.emptyBtn}</button>
        </section>
      </>
    );
  }

  const s = monthSummary(ds, todayStr);
  const b = latestBalance(ds), p = plan(ds, todayStr);
  const recent = [...ds.expenses].sort((a, x) => (a.d < x.d ? 1 : a.d > x.d ? -1 : 0)).slice(0, 6);

  const al: [string, string, string, string][] = [];
  const lb = ds.meta.lastBackupAt;
  const sinceBackup = lb ? Math.floor((Date.now() - new Date(lb).getTime()) / 864e5) : null;
  if (sinceBackup == null || sinceBackup >= BACKUP_DAYS) al.push(["ayarlar", "", "database-backup", t.home.alertBackup(sinceBackup)]);
  const pend = ds.expenses.filter((x) => isPending(ds, x)).length;
  if (pend) al.push(["hareketler", "info", "scan-line", t.home.alertPending(pend)]);
  const of = openFriends(ds);
  if (of.length) al.push(["arkadaslar", "", "users", t.home.alertFriends(of.length)]);
  const zf = (c.fixed || []).filter((f) => !+f.amount);
  if (zf.length) al.push(["ayarlar", "", "calendar", t.home.alertFixed(zf.map((f) => esc(f.name)).join(", "))]);
  if (!+c.tripBudget) al.push(["plan", "info", "map", t.home.alertTripBudget]);

  // Geçen ayın aynı dönemi
  const pk = prevMonth(s.k);
  const prevList = live(ds).filter((x) => mKey(x.d) === pk && !x.trip && +x.d.slice(8) <= s.dayNo);
  const dlt = s.dSum - sum(prevList, (x) => mine(c, x));

  const accent = css("--accent") || "#2350F5";
  const mn = monthName(s.m);

  return (
    <>
      {top}
      <UpdLine ds={ds} />
      <section className="hero">
        <div className="lbl">{t.home.myMoney}{b ? ` · ${t.home.balanceRecord(dShort(b.d))}` : ""}</div>
        <div className="big num">{n0(p.pl)} <small>zł</small></div>
        <div className="sub num">≈ {tl(p.pl * c.plntl)} · {t.home.inTurkey} {tl(c.trTL)}</div>
        <div className="accounts"><BankBoxes accounts={ds.accounts} b={b} /></div>
      </section>
      <div className="actions">
        <button className="action" type="button" onClick={() => toast(t.common.soon)}><span className="circ"><Icon name="plus" /></span>{t.home.add}</button>
        <button className="action" type="button" onClick={() => go("hareketler")}><span className="circ"><Icon name="search" /></span>{t.home.search}</button>
        <button className="action" type="button" onClick={() => toast(t.common.soon)}><span className="circ"><Icon name="refresh-cw" /></span>{t.home.balance}</button>
        <button className="action" type="button" onClick={() => go("plan")}><span className="circ"><Icon name="piggy-bank" /></span>{t.home.plan}</button>
      </div>
      <section className="card">
        <div className="head"><h2>{t.home.spending(mn)}</h2><a href="#analiz">{t.home.analysis}</a></div>
        <div className="kbig num">{zl0(s.dSum)} <small>/ {zl0(c.budget)}</small></div>
        <div className="meter"><i className={s.pct > 1 ? "over" : ""} style={{ width: Math.min(100, s.pct * 100).toFixed(1) + "%" }} /></div>
        <div className="chartbox" style={{ height: 84, margin: "-2px 0 10px" }}>
          <Bar
            aria-label={t.home.dailyChart}
            data={{
              labels: s.perDayVals.map((_, i) => String(i + 1)),
              datasets: [{
                data: s.perDayVals,
                backgroundColor: s.perDayVals.map((_, i) => (i + 1 === s.dayNo ? accent : accent + "66")),
                borderRadius: 3, maxBarThickness: 8,
              }],
            }}
            options={{
              maintainAspectRatio: false, animation: false,
              plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { title: (i) => i[0].label + " " + mn.slice(0, 3), label: (i) => zl(i.raw as number) } } },
              scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
            }}
          />
        </div>
        {prevList.length > 0 && (
          <div className="small" style={{ margin: "-4px 0 10px", color: "var(--muted)" }}>
            {t.home.vsLastMonth} <b style={{ color: dlt > 0 ? "var(--bad)" : "var(--good)" }}>{dlt > 0 ? "+" : "−"}{zl0(Math.abs(dlt))}</b>
          </div>
        )}
        <div className="stats num">
          <div className="stat"><span>{t.home.leftPerDay}</span><b style={{ color: s.perDay < 0 ? "var(--bad)" : "var(--ink)" }}>{zl0(s.perDay)}</b></div>
          <div className="stat"><span>{t.home.tripSeparate}</span><b style={{ color: "var(--trip)" }}>{zl0(s.tSum)}</b></div>
          <div className="stat"><span>{t.home.monthTotal}</span><b>{tl((s.dSum + s.tSum) * c.plntl)}</b></div>
        </div>
      </section>
      {al.length > 0 && (
        <div className="alerts">
          {al.map(([h, cl, ic, txt]) => (
            <button key={txt} type="button" className={"alert " + cl} onClick={() => go(h)}>
              <span className="ic"><Icon name={ic} /></span>
              <span style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: txt }} />
              <Icon name="chevron-right" />
            </button>
          ))}
        </div>
      )}
      <section className="card">
        <div className="head"><h2>{t.home.recent}</h2><a href="#hareketler">{t.home.all}</a></div>
        <div className="list">
          {recent.length ? recent.map((x) => <TxRow key={x.id} ds={ds} x={x} showDate />) : <div className="empty">{t.home.noExpenses}</div>}
        </div>
      </section>
      <section className="card" style={{ cursor: "pointer" }} onClick={() => go("plan")}>
        <div className="head"><h2>{t.home.planTitle}</h2><Icon name="chevron-right" /></div>
        <div className="small muted">{t.home.daysLeft(Math.max(0, daysBetween(todayStr, c.end)))} · {t.home.need} ≈ {tl(p.need * c.plntl)}</div>
        <div className="kbig num" style={{ color: p.invest < 0 ? "var(--bad)" : "var(--good)", marginTop: 6 }}>{tl(p.invest * c.plntl)}</div>
        <div className="small muted">{t.home.investable}</div>
      </section>
    </>
  );
}
