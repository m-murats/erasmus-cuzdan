import { useEffect, useRef, useState } from "react";
import { db, isEmpty, loadAll, replaceAll, updateMeta } from "../db/db";
import { useI18n } from "../i18n/I18n";
import { LANGS, DICT } from "../i18n/dict";
import { isPending } from "../lib/calc";
import { BackupError, backupFileName, datasetCounts, makeBackup, parseBackup } from "../lib/backup";
import { dShort, fmtTs, today } from "../lib/format";
import type { Dataset } from "../lib/types";
import { Icon } from "../ui/Icon";
import { TopBar } from "../ui/parts";
import { go, useApp } from "../ui/state";

/** Dosyayı kullanıcının cihazına indirir (hiçbir yere gönderilmez) */
function saveFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
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
  const { t, lang, setLang } = useI18n();
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
