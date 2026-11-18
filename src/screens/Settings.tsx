import { useEffect, useRef, useState } from "react";
import { db, isEmpty, loadAll, replaceAll, saveSettings, updateMeta } from "../db/db";
import { useI18n } from "../i18n/I18n";
import { LANGS, DICT } from "../i18n/dict";
import { cfg, isPending } from "../lib/calc";
import { expensesCsv } from "../lib/csv";
import type { FixedPayment, Settings as SettingsT } from "../lib/types";
import { THEME_MODES, useTheme } from "../ui/theme";
import { BackupError, backupFileName, datasetCounts, makeBackup, parseBackup } from "../lib/backup";
import { dShort, fmtTs, today } from "../lib/format";
import type { Dataset } from "../lib/types";
import { Icon } from "../ui/Icon";
import { TopBar, useSaver } from "../ui/parts";
import { go, useApp } from "../ui/state";

/** Dosyayı kullanıcının cihazına indirir (hiçbir yere gönderilmez) */
function saveFile(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Mevcut veriyi yedek olarak indirir ve "son yedek" zamanını kaydeder */
export async function downloadBackup() {
  const now = new Date();
  await updateMeta({ lastBackupAt: now.toISOString() });
  const ds = await loadAll();
  saveFile(backupFileName(today()), makeBackup(ds, now));
}

export function Settings({ ds }: { ds: Dataset }) {
  const { t, lang, setLang, cat } = useI18n();
  const { mode, setMode } = useTheme();
  const { toast, setSheet } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);
  const m = ds.meta || {};

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const data = parseBackup(text);
      let exported: string | undefined;
      try { exported = JSON.parse(text).exported; } catch { /* yok */ }
      setSheet({ kind: "restore", data, text, exported });
    } catch (e) {
      if (e instanceof BackupError) {
        const er = t.errors;
        toast(e.code === "unknownFormat" ? er.unknownFormat(e.detail) : er[e.code]);
      } else toast(t.errors.readFile);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <TopBar title={t.settings.title} back="daha" />
      <section className="card">
        <div className="head"><h2>{t.settings.language}</h2></div>
        <div className="chips">
          {LANGS.map((l) => (
            <button key={l} type="button" className="chip" aria-pressed={lang === l} onClick={() => setLang(l)}>{DICT[l].langName}</button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="head"><h2>{t.settings2.theme}</h2></div>
        <div className="chips">
          {THEME_MODES.map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === "system" ? t.settings2.themeSystem : m === "light" ? t.settings2.themeLight : t.settings2.themeDark}
            </button>
          ))}
        </div>
      </section>

      <BudgetForm key={JSON.stringify(ds.settings)} ds={ds} />

      <section className="card">
        <div className="head"><h2>{t.settings.backupTitle}</h2></div>
        <div className="small muted">{t.settings.backupInfo}</div>
        <div className="kv">
          <div><span>{t.settings.lastBackup}</span><b>{m.lastBackupAt ? fmtTs(m.lastBackupAt) : t.settings.never}</b></div>
          <div><span>{t.settings.storage}</span><b>{persisted == null ? "—" : persisted ? t.settings.storageOn : t.settings.storageOff}</b></div>
        </div>
        <div className="btns" style={{ justifyContent: "flex-start" }}>
          <button className="btn primary" type="button" onClick={async () => { await downloadBackup(); toast(t.settings.downloaded); }}>
            <Icon name="download" /> {t.settings.download}
          </button>
          <button className="btn" type="button" onClick={() => fileRef.current?.click()}><Icon name="upload" /> {t.settings.restore}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </section>

      <section className="card">
        <div className="head"><h2>{t.settings2.exportTitle}</h2></div>
        <div className="small muted">{t.settings2.exportInfo}</div>
        <div className="btns" style={{ justifyContent: "flex-start" }}>
          <button className="btn" type="button" onClick={() => {
            saveFile(`${t.settings2.csvFile}-${today()}.csv`, expensesCsv(ds, t.settings2.csvHead, (k) => t.src[k] ?? k, cat), "text/csv");
            toast(t.settings2.ready);
          }}><Icon name="file-spreadsheet" /> {t.settings2.csv}</button>
        </div>
      </section>

      <section className="card">
        <div className="head"><h2>{t.settings.statusTitle}</h2></div>
        <div className="kv">
          <div><span>{t.settings.lastEntry}</span><b>{fmtTs(m.lastEdit)}</b></div>
          <div><span>{t.settings.bankCheck}</span><b>{m.bankCheckedThrough ? t.upd.until(dShort(m.bankCheckedThrough) + " " + m.bankCheckedThrough.slice(0, 4)) : "—"}</b></div>
          <div><span>{t.settings.source}</span><b>{m.bankCheckNote || "—"}</b></div>
          <div><span>{t.settings.addedLater}</span><b>{t.settings.expensesN(ds.expenses.filter((x) => isPending(ds, x)).length)}</b></div>
        </div>
      </section>
    </>
  );
}

/** Bütçe, tarihler, kurlar ve sabit ödemeler (prototipteki "Bütçe ve plan" formu) */
function BudgetForm({ ds }: { ds: Dataset }) {
  const { t } = useI18n();
  const { toast } = useApp();
  const save = useSaver();
  const c = cfg(ds);
  const numKeys = ["budget", "tripBudget", "buffer", "incomeLeft", "deposit", "trTL", "eurpln", "plntl", "eurtl", "totalTL"] as const;
  const [f, setF] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(numKeys.map((k) => [k, c[k] ? String(c[k]) : ""])),
    start: c.start, end: c.end, depositDate: c.depositDate ?? "",
  }));
  const [fixed, setFixed] = useState<FixedPayment[]>(() => (c.fixed || []).map((x) => ({ ...x })));
  const set = (k: string, v: string) => setF((o) => ({ ...o, [k]: v }));
  const setFx = (i: number, patch: Partial<FixedPayment>) => setFixed((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const onSave = async () => {
    const patch: Partial<SettingsT> = { start: f.start, end: f.end, fixed };
    for (const k of numKeys) patch[k] = +f[k] || 0;
    if (f.depositDate) patch.depositDate = f.depositDate;
    if (!patch.eurpln || !patch.plntl || !patch.eurtl) { toast(t.settings2.ratesEmpty); return; }
    await save(() => saveSettings(patch), t.form.saved);
  };
  const num = (k: string, label: string, step = "any", ph?: string) => (
    <label>{label}<input type="number" step={step} inputMode="decimal" value={f[k]} placeholder={ph} onChange={(e) => set(k, e.target.value)} /></label>
  );
  const s2 = t.settings2;
  return (
    <section className="card">
      <div className="head"><h2>{s2.budgetTitle}</h2></div>
      <form className="form" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        {num("budget", s2.budget, "10")}
        {num("tripBudget", s2.tripBudget, "50", s2.tripPh)}
        {num("buffer", s2.buffer)}
        {num("incomeLeft", s2.incomeLeft)}
        <label>{s2.start}<input type="date" value={f.start} onChange={(e) => set("start", e.target.value)} /></label>
        <label>{s2.end}<input type="date" value={f.end} onChange={(e) => set("end", e.target.value)} /></label>
        {num("deposit", s2.deposit, "0.01")}
        <label>{s2.depositDate}<input type="date" value={f.depositDate} onChange={(e) => set("depositDate", e.target.value)} /></label>
        {num("trTL", s2.trTL)}
        {num("totalTL", s2.totalTL)}
        {num("eurpln", s2.eurpln, "0.0001")}
        {num("plntl", s2.plntl, "0.01")}
        {num("eurtl", s2.eurtl, "0.01")}
        <div className="full">
          <div className="small muted" style={{ fontWeight: 700, marginBottom: 6 }}>{s2.fixedTitle}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {fixed.map((x, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 64px auto auto", gap: 6, alignItems: "center", paddingBottom: 8, borderBottom: "1px solid var(--line)" }}>
                <input value={x.name} aria-label={s2.fixedName} style={{ gridColumn: "1 / -1" }} onChange={(e) => setFx(i, { name: e.target.value })} />
                <input type="number" inputMode="decimal" value={x.amount || ""} aria-label={s2.fixedAmount} onChange={(e) => setFx(i, { amount: +e.target.value || 0 })} />
                <input type="number" inputMode="numeric" value={x.left ?? 1} aria-label={s2.fixedLeft} onChange={(e) => setFx(i, { left: +e.target.value || 0 })} />
                <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input type="checkbox" checked={x.monthly !== false} onChange={(e) => setFx(i, { monthly: e.target.checked })} style={{ width: "auto" }} />{s2.monthly}
                </label>
                <button type="button" className="btn sm danger" aria-label={s2.remove} onClick={() => setFixed((l) => l.filter((_, j) => j !== i))}><Icon name="x" /></button>
              </div>
            ))}
          </div>
          <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={() => setFixed((l) => [...l, { name: s2.newFixed, amount: 0, left: 1, monthly: false }])}>{s2.addFixed}</button>
        </div>
        <button type="submit" hidden />
      </form>
      <div className="btns"><button className="btn primary" type="button" onClick={onSave}>{t.form.save}</button></div>
    </section>
  );
}

/** Geri yükleme önizlemesi ve onayı */
export function RestorePreview({ data, exported }: { data: Dataset; exported?: string }) {
  const { t } = useI18n();
  const { setSheet, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [hasData, setHasData] = useState(false);
  useEffect(() => { isEmpty().then((e) => setHasData(!e)); }, []);
  const counts = datasetCounts(data);

  const confirm = async () => {
    setBusy(true);
    try {
      // Kural: kullanıcının verisini etkileyen her değişiklikten önce yedek al
      if (!(await isEmpty())) await downloadBackup();
      const meta = { ...data.meta, lastBackupAt: data.meta.lastBackupAt || exported || new Date().toISOString() };
      await replaceAll({ ...data, meta }, db);
      setSheet(null);
      toast(t.settings.restored(data.expenses.length));
      go("ana");
    } catch (e) {
      toast(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2>{t.settings.previewTitle}</h2>
      <div className="kv">
        {exported && <div><span>{t.settings.exportedAt}</span><b>{fmtTs(exported)}</b></div>}
        {Object.entries(counts).map(([k, v]) => <div key={k}><span>{t.settings.labels[k]}</span><b className="num">{v}</b></div>)}
      </div>
      {hasData && <div className="note"><Icon name="info" /><span>{t.settings.replaceWarn}</span></div>}
      <div className="btns">
        <button className="btn" type="button" onClick={() => setSheet(null)}>{t.common.cancel}</button>
        <button className="btn primary" type="button" disabled={busy} onClick={confirm}>{t.settings.confirmRestore}</button>
      </div>
    </>
  );
}
