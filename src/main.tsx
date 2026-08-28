import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthGate } from "./components/AuthGate";
import "./index.css";

const resetScrollToHero = () => {
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  if (window.location.hash) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }

  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
};

resetScrollToHero();
window.addEventListener("pageshow", resetScrollToHero, { once: true });
window.addEventListener("load", resetScrollToHero, { once: true });
window.requestAnimationFrame(resetScrollToHero);
window.setTimeout(resetScrollToHero, 120);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </React.StrictMode>,
);

