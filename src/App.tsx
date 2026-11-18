import { useEffect } from "react";
import { requestPersist } from "./db/db";
import { useI18n } from "./i18n/I18n";
import { Analysis } from "./screens/Analysis";
import { Home } from "./screens/Home";
import { More } from "./screens/More";
import { RestorePreview, Settings } from "./screens/Settings";
import { Merchant, Picker, Transactions, TxDetail } from "./screens/Transactions";
import { Icon } from "./ui/Icon";
import { ExpenseForm } from "./screens/forms/ExpenseForm";
import { TripForm } from "./screens/forms/TripForm";
import { InflowForm } from "./screens/forms/InflowForm";
import { Money } from "./screens/Money";
import { Plan } from "./screens/Plan";
import { Friends } from "./screens/Friends";
import { TransferForm } from "./screens/forms/TransferForm";
import { BalanceForm } from "./screens/forms/BalanceForm";
import { TripDetail, Trips } from "./screens/Trips";
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
  else if (view === "analiz") body = <Analysis ds={ds} />;
  else if (view === "geziler") body = route.startsWith("gezi-") ? <TripDetail ds={ds} id={route.slice(5)} /> : <Trips ds={ds} />;
  else if (view === "para") body = <Money ds={ds} />;
  else if (view === "plan") body = <Plan ds={ds} />;
  else if (view === "arkadaslar") body = <Friends ds={ds} />;

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
        {ds && sheet?.kind === "expense" && <ExpenseForm key={sheet.id ?? "new"} ds={ds} id={sheet.id} />}
        {ds && sheet?.kind === "trip" && <TripForm key={sheet.id ?? "new"} ds={ds} id={sheet.id} />}
        {ds && sheet?.kind === "inflow" && <InflowForm key={sheet.id ?? "new"} ds={ds} id={sheet.id} />}
        {ds && sheet?.kind === "balance" && <BalanceForm ds={ds} />}
        {ds && sheet?.kind === "transfer" && <TransferForm ds={ds} />}
        {sheet?.kind === "restore" && <RestorePreview data={sheet.data} exported={sheet.exported} />}
      </Sheet>
      <Toast />
    </>
  );
}
