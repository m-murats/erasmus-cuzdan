// Yeni gezi / gezi düzenleme (prototipteki openTrip; düzenleme eklendi)
import { useState } from "react";
import { newId, saveRow } from "../../db/db";
import { useI18n } from "../../i18n/I18n";
import type { Dataset, Trip } from "../../lib/types";
import { useSaver } from "../../ui/parts";
import { go, useApp } from "../../ui/state";

export function TripForm({ ds, id }: { ds: Dataset; id?: string }) {
  const { t } = useI18n();
  const { setSheet, toast } = useApp();
  const save = useSaver();
  const orig = id ? ds.trips.find((x) => x.id === id) : undefined;
  const [f, setF] = useState({
    name: orig?.name ?? "", start: orig?.start ?? "", end: orig?.end ?? "", cities: (orig?.cities ?? []).join(", "),
    with: orig?.with ?? "", note: orig?.note ?? "", bankNetPLN: orig?.bankNetPLN != null ? String(orig.bankNetPLN) : "",
  });
  const set = (k: keyof typeof f, v: string) => setF((o) => ({ ...o, [k]: v }));
  const onSave = async () => {
    const name = f.name.trim();
    if (!name || !f.start || !f.end) { toast(t.trips.required); return; }
    const row: Trip = {
      ...(orig ?? {}), id: orig?.id ?? newId("t"), name, start: f.start, end: f.end,
      cities: f.cities.split(",").map((s) => s.trim()).filter(Boolean), with: f.with.trim(), note: f.note.trim(),
    };
    if (f.bankNetPLN.trim() !== "") row.bankNetPLN = +f.bankNetPLN || 0;
    else delete row.bankNetPLN;
    if (await save(() => saveRow("trips", row), orig ? t.form.updated : t.trips.added)) {
      setSheet(null);
      if (!orig) go("gezi-" + row.id);
    }
  };
  return (
    <>
      <h2>{orig ? t.trips.formEdit : t.trips.formNew}</h2>
      <form className="form" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <label className="full">{t.trips.name}<input placeholder={t.trips.namePh} value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label>{t.trips.start}<input type="date" value={f.start} onChange={(e) => set("start", e.target.value)} /></label>
        <label>{t.trips.end}<input type="date" value={f.end} onChange={(e) => set("end", e.target.value)} /></label>
        <label className="full">{t.trips.cities}<input value={f.cities} onChange={(e) => set("cities", e.target.value)} /></label>
        <label className="full">{t.trips.with}<input value={f.with} onChange={(e) => set("with", e.target.value)} /></label>
        <label className="full">{t.trips.bankNet}
          <input type="number" step="0.01" inputMode="decimal" value={f.bankNetPLN} placeholder={t.trips.bankNetHint} onChange={(e) => set("bankNetPLN", e.target.value)} />
        </label>
        <label className="full">{t.form.note}<textarea value={f.note} onChange={(e) => set("note", e.target.value)} /></label>
        <button type="submit" hidden />
      </form>
      <div className="btns">
        <button className="btn" type="button" onClick={() => setSheet(null)}>{t.common.cancel}</button>
        <button className="btn primary" type="button" onClick={onSave}>{t.form.save}</button>
      </div>
    </>
  );
}
