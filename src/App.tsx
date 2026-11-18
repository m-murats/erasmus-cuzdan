import { useEffect } from "react";
import { requestPersist } from "./db/db";
import { useI18n } from "./i18n/I18n";
import { Home } from "./screens/Home";
import { More, Placeholder } from "./screens/More";
import { RestorePreview, Settings } from "./screens/Settings";
import { Merchant, Picker, Transactions, TxDetail } from "./screens/Transactions";
import { Icon } from "./ui/Icon";
import { Sheet, Toast } from "./ui/parts";
import { useApp, useHashRoute } from "./ui/state";

/** Hangi ekran hangi alt menü sekmesini vurgular */
const NAVOF: Record<string, string> = {
  ana: "ana", hareketler: "hareketler", analiz: "analiz", geziler: "geziler", para: "para", plan: "para",
  daha: "ana", arkadaslar: "ana", ayarlar: "ana", yer: "hareketler",
};

export default function App() {
  const { t } = useI18n();
  const { ds, sheet, setSheet } = useApp();
  const route = useHashRoute();
  const view = route.startsWith("gezi-") ? "geziler" : NAVOF[route] ? route : "ana";

  useEffect(() => { requestPersist(); }, []);

  let body = null;
  if (!ds) body = <div className="empty">{t.common.loading}</div>;
  else if (view === "ana") body = <Home ds={ds} />;
  else if (view === "hareketler") body = <Transactions ds={ds} />;
  else if (view === "yer") body = <Merchant ds={ds} />;
  else if (view === "daha") body = <More ds={ds} />;
  else if (view === "ayarlar") body = <Settings ds={ds} />;
  else if (view === "analiz") body = <Placeholder title={t.nav.analysis} />;
  else if (view === "geziler") body = <Placeholder title={t.nav.trips} />;
  else if (view === "para") body = <Placeholder title={t.nav.money} />;
  else if (view === "plan") body = <Placeholder title={t.more.items.plan[0]} back="para" />;
  else if (view === "arkadaslar") body = <Placeholder title={t.more.items.arkadaslar[0]} back="daha" />;

  const nav: [string, string, string][] = [
    ["ana", "house", t.nav.home], ["hareketler", "receipt", t.nav.tx], ["analiz", "chart-pie", t.nav.analysis],
    ["geziler", "map", t.nav.trips], ["para", "wallet", t.nav.money],
  ];

  return (
    <>
      <div className="app"><main>{body}</main></div>
      <nav className="bnav" aria-label={t.nav.mainMenu}>
        <div className="in">
          {nav.map(([h, ic, label]) => (
            <a key={h} href={"#" + h} aria-current={NAVOF[view] === h ? "page" : undefined}><Icon name={ic} />{label}</a>
          ))}
        </div>
      </nav>
      <Sheet open={!!sheet} onClose={() => setSheet(null)}>
        {ds && sheet?.kind === "tx" && <TxDetail ds={ds} id={sheet.id} />}
        {ds && sheet?.kind === "picker" && <Picker ds={ds} which={sheet.which} />}
        {sheet?.kind === "restore" && <RestorePreview data={sheet.data} exported={sheet.exported} />}
      </Sheet>
      <Toast />
    </>
  );
}
