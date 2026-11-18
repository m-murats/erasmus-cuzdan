// Analiz (prototipteki vAnaliz): dönem/tür seçimi, kategori halkası, gün gün, en çok harcanan yerler, aylara göre
import type { ChartDataset } from "chart.js";
import { useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { useI18n } from "../i18n/I18n";
import { analysis, byMerchant, cfg, monthsList, type AnKind } from "../lib/calc";
import { catInfo } from "../lib/constants";
import { mKey, mName, monthName, n0, zl, zl0 } from "../lib/format";
import { merchant } from "../lib/search";
import type { Dataset } from "../lib/types";
import { CatRows, MerchantRows, TopBar } from "../ui/parts";
import { EMPTY_FILTER, go, useApp } from "../ui/state";
import { useChartColors } from "../ui/theme";

export function Analysis({ ds }: { ds: Dataset }) {
  const { t, cat } = useI18n();
  const { an, setAn, todayStr, setFilter } = useApp();
  const col = useChartColors();
  const period = an.period ?? mKey(todayStr);
  const a = analysis(ds, period, an.kind, todayStr);
  const c = cfg(ds);
  const mer = byMerchant(c, a.list, (x) => merchant(ds, x));
  const [hover, setHover] = useState<number | null>(null);
  const hc = hover != null ? a.cats[hover] : null;
  const label = period === "all" ? t.analysis.allPeriodLower : mName(period);

  const periods: [string, string][] = [...monthsList(ds, todayStr).map((k) => [k, mName(k)] as [string, string])].reverse();
  periods.push(["all", t.analysis.allPeriod]);
  const kinds: [AnKind, string, string][] = [["daily", t.analysis.daily, ""], ["trip", t.analysis.trips, "trip"], ["all", t.analysis.all, ""]];

  // Kategoriye dokununca Hareketler'de o kategori ve dönem filtrelenir (prototipteki gibi)
  const pickCat = (n: string) => {
    setFilter({ ...EMPTY_FILTER, period, kind: an.kind === "trip" ? "all" : an.kind, cat: n });
    go("hareketler");
  };

  return (
    <>
      <TopBar title={t.nav.analysis} />
      <div className="chips">
        {periods.map(([v, n]) => (
          <button key={v} type="button" className="chip" aria-pressed={period === v} onClick={() => { setHover(null); setAn((o) => ({ ...o, period: v })); }}>{n}</button>
        ))}
      </div>
      <div className="chips">
        {kinds.map(([v, n, cl]) => (
          <button key={v} type="button" className={"chip " + cl} aria-pressed={an.kind === v} onClick={() => { setHover(null); setAn((o) => ({ ...o, kind: v })); }}>{n}</button>
        ))}
      </div>
      <section className="card">
        <div className="donut">
          {a.cats.length > 0 && (
            <Doughnut
              key={String(col.dark)}
              aria-label={t.analysis.donut}
              data={{
                labels: a.cats.map((x) => cat(x[0])),
                datasets: [{ data: a.cats.map((x) => +x[1].v.toFixed(2)), backgroundColor: a.cats.map((x) => catInfo(x[0])[1]), borderColor: col.surface, borderWidth: 3, hoverOffset: 6 }],
              }}
              options={{
                cutout: "74%", maintainAspectRatio: false, animation: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                onHover: (_e, els) => setHover(els.length ? els[0].index : null),
              }}
            />
          )}
          <div className="center">
            <div>
              {hc ? (
                <><b className="num" style={{ color: catInfo(hc[0])[1] }}>{zl0(hc[1].v)}</b><span>{cat(hc[0])} · %{Math.round((hc[1].v / a.tot) * 100)}</span></>
              ) : (
                <><b className="num">{zl0(a.tot)}</b><span>{label} · {t.analysis.perDay(zl0(a.perDay))}</span></>
              )}
            </div>
          </div>
        </div>
        {a.cats.length ? <CatRows rows={a.cats} total={a.tot} onPick={pickCat} /> : <div className="empty">{t.analysis.noData}</div>}
      </section>

      {a.daily && (
        <section className="card">
          <div className="head"><h2>{t.analysis.dayByDay(monthName(+period.slice(5)))}</h2></div>
          <div className="small muted" style={{ margin: "-4px 0 8px" }}>
            {t.analysis.vsPrev(a.days)}{" "}
            <b style={{ color: a.daily.delta > 0 ? "var(--bad)" : "var(--good)" }}>{a.daily.delta > 0 ? "+" : "−"}{zl0(Math.abs(a.daily.delta))}</b>{" "}
            {a.daily.delta > 0 ? t.analysis.more : t.analysis.less}
          </div>
          <div className="chartbox" style={{ height: 160 }}>
            <Bar
              key={String(col.dark)}
              aria-label={t.analysis.dailyChart}
              data={{
                labels: a.daily.vals.map((_, i) => String(i + 1)),
                datasets: [{ data: a.daily.vals, backgroundColor: a.daily.vals.map((v) => (v > (a.budget / a.daily!.dim) * 2 ? col.bad : col.accent)), borderRadius: 4, maxBarThickness: 10 }],
              }}
              options={{
                maintainAspectRatio: false, animation: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => i[0].label + " " + monthName(+period.slice(5)).slice(0, 3), label: (i) => zl(i.raw as number) } } },
                scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { ticks: { callback: (v) => n0(+v) }, grid: { color: col.line } } },
              }}
            />
          </div>
        </section>
      )}

      <section className="card">
        <div className="head"><h2>{t.analysis.topPlaces}</h2></div>
        <div className="list"><MerchantRows rows={mer} /></div>
      </section>

      <section className="card">
        <div className="head"><h2>{t.analysis.byMonth}</h2></div>
        <div className="chartbox">
          <Bar
            key={String(col.dark)}
            aria-label={t.analysis.monthlyChart}
            data={{
              labels: a.monthly.map((m) => monthName(+m.k.slice(5)).slice(0, 3)),
              datasets: [
                { label: t.analysis.legendDaily, data: a.monthly.map((m) => m.daily), backgroundColor: col.accent, borderRadius: 8, stack: "s", maxBarThickness: 44 },
                { label: t.analysis.legendTrip, data: a.monthly.map((m) => m.trip), backgroundColor: col.trip, borderRadius: 8, stack: "s", maxBarThickness: 44 },
                // Aylık bütçe: kesikli çizgi (karma grafik; tip tanımı yalnızca çubuk bildiği için dönüştürülür)
                { type: "line", data: a.monthly.map(() => a.budget), borderColor: col.muted, borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 } as unknown as ChartDataset<"bar", number[]>,
              ],
            }}
            options={{
              maintainAspectRatio: false, animation: false,
              plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => zl(i.raw as number) } } },
              scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: (v) => n0(+v) } } },
            }}
          />
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>
          <span className="dot" style={{ background: "var(--accent)", margin: "0 4px 0 0" }} />{t.analysis.legendDaily}
          <span className="dot" style={{ background: "var(--trip)", margin: "0 4px 0 12px" }} />{t.analysis.legendTrip} · {t.analysis.legendBudget}
        </div>
      </section>
    </>
  );
}
