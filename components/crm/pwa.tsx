"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Подписка на display-mode: standalone (приложение уже установлено и открыто как приложение) */
function subscribeStandalone(cb: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
const getServerStandalone = () => false;

/**
 * PWA-слой: регистрирует service worker и показывает
 * кнопку «Установить приложение», когда браузер разрешает установку
 * (Android/Chrome/Edge). На iOS установка делается через «Поделиться →
 * На экран “Домой”» — эта кнопка там не нужна.
 */
export function PwaInstaller() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandalone,
    getServerStandalone
  );

  useEffect(() => {
    // Регистрация service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || isStandalone) return null;

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  }

  return (
    <>
      {promptEvent && (
        <Button
          size="sm"
          variant="ghost"
          className="hidden sm:inline-flex gap-1.5 text-header-fg/90 hover:text-header-fg hover:bg-white/10"
          onClick={install}
        >
          <Download className="h-4 w-4" />
          Установить
        </Button>
      )}
      {!promptEvent && (
        <span
          className="hidden md:inline-flex items-center gap-1.5 text-xs text-header-fg/60 mr-1"
          title="В браузере Chrome: меню ⋮ → «Установить приложение». На iPhone: Поделиться → «На экран Домой»."
        >
          <MonitorSmartphone className="h-4 w-4" />
        </span>
      )}
    </>
  );
}
