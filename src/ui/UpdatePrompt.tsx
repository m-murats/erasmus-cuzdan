// Çevrimdışı çalışma (service worker) ve "yeni sürüm hazır" bildirimi.
// Uygulama kendiliğinden yenilenmez; kullanıcı "Yenile"ye basınca yeni sürüme geçer. Veriler (IndexedDB) etkilenmez.
import { useRegisterSW } from "virtual:pwa-register/react";
import { useI18n } from "../i18n/I18n";

export function UpdatePrompt() {
  const { t } = useI18n();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    // Uygulama uzun süre açık kalırsa saatte bir yeni sürüm var mı diye bakar
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => { reg.update().catch(() => {}); }, 60 * 60 * 1000);
    },
  });
  if (!needRefresh && !offlineReady) return null;
  return (
    <div className="updbar" role="status">
      <span>{needRefresh ? t.pwa.newVersion : t.pwa.offlineReady}</span>
      {needRefresh && <button className="btn sm primary" type="button" onClick={() => updateServiceWorker(true)}>{t.pwa.reload}</button>}
      <button className="btn sm" type="button" onClick={() => { setNeedRefresh(false); setOfflineReady(false); }}>{t.common.close}</button>
    </div>
  );
}
