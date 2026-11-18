import { useI18n } from "../i18n/I18n";
import type { Dataset } from "../lib/types";
import { Icon } from "../ui/Icon";
import { TopBar, UpdLine } from "../ui/parts";
import { go } from "../ui/state";

const ITEMS: [string, string][] = [["para", "wallet"], ["plan", "piggy-bank"], ["arkadaslar", "users"], ["ayarlar", "settings"]];

export function More({ ds }: { ds: Dataset }) {
  const { t } = useI18n();
  return (
    <>
      <TopBar title={t.more.title} />
      <UpdLine ds={ds} />
      <section className="card menu">
        <div className="list">
          {ITEMS.map(([h, ic]) => {
            const [title, sub] = t.more.items[h];
            return (
              <button key={h} type="button" className="row" onClick={() => go(h)}>
                <span className="av" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Icon name={ic} /></span>
                <span className="mid"><span className="t" style={{ display: "block" }}>{title}</span><span className="s" style={{ display: "block" }}>{sub}</span></span>
                <Icon name="chevron-right" />
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

/** Sonraki aşamada yapılacak ekranlar için geçici sayfa */
export function Placeholder({ title, back }: { title: string; back?: string }) {
  const { t } = useI18n();
  return (
    <>
      <TopBar title={title} back={back} />
      <section className="card"><div className="empty">{t.common.soon}</div></section>
    </>
  );
}
