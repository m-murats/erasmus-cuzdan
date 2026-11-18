import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n/I18n";
import { AppStateProvider } from "./ui/state";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </I18nProvider>
  </StrictMode>,
);
