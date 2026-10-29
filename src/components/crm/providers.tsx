"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { applyTheme, storedTheme } from "@/lib/themes";
import { initOfflineSync } from "@/lib/offline";

export function CrmProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: true,
            staleTime: 2000,
          },
        },
      })
  );

  // Регистрация service worker (PWA) — на всех экранах, включая вход
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    // Офлайн-очередь: автоотправка сохранённых операций при появлении сети
    initOfflineSync();
  }, []);

  // Тема последнего пользователя устройства — мгновенно, без ожидания сервера
  useEffect(() => {
    applyTheme(storedTheme());
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
