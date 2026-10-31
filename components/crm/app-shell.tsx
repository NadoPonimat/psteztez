"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gamepad2, History, LogOut, Monitor, Settings, Volume2, VolumeX, AlarmClock, CalendarRange, FileText, Wallet, Trophy, WifiOff, RefreshCw } from "lucide-react";
import { DeviceCard } from "./device-card";
import { NewSessionDialog } from "./new-session-dialog";
import { CompleteSessionDialog } from "./complete-session-dialog";
import { AlarmCenter } from "./alarm-center";
import { ScheduleView } from "./schedule-view";
import { PwaInstaller } from "./pwa";
import { HistoryView } from "./history-view";
import { ReportsView } from "./reports-view";
import { SalaryView } from "./salary-view";
import { SettingsView } from "./settings-view";
import { CashPanel } from "./cash-panel";
import { ThemeSoundMenu } from "./theme-sound-menu";
import { ContactsButton } from "./contacts-dialog";
import { TournamentsView } from "./tournaments-view";
import { applyTheme } from "@/lib/themes";
import { unlockAudio } from "@/lib/alarm";
import { ensurePushSubscribed } from "@/lib/push-client";
import { syncNativeAlarms } from "@/lib/native-bridge";
import {
  flushOutbox,
  getPendingSnapshot,
  onSyncResult,
  subscribePending,
} from "@/lib/offline";
import type {
  CurrentUser,
  DashboardData,
  DeviceWithSession,
} from "@/lib/crm-types";
import { formatTenge } from "@/lib/crm-types";

export function AppShell({
  user,
  onLogout,
  onToast,
}: {
  user: CurrentUser;
  onLogout: () => void;
  onToast: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const serverOffsetRef = useRef(0);
  const [now, setNow] = useState(Date.now());
  const [muted, setMuted] = useState(false);
  const [startDevice, setStartDevice] = useState<DeviceWithSession | null>(null);
  const [completeDevice, setCompleteDevice] = useState<DeviceWithSession | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  // Разблокировка звука первым касанием: без этого Android/PWA не даст сирене
  // прозвучать, когда время сеанса выйдет
  useEffect(() => {
    unlockAudio();
  }, []);

  // Личные настройки аккаунта: тема + звук (применяются сразу, хранятся на сервере)
  const [theme, setTheme] = useState(user.theme ?? "");
  const [alarmSound, setAlarmSound] = useState(user.alarmSound ?? "siren");
  useEffect(() => {
    applyTheme(user.theme ?? "");
    setTheme(user.theme ?? "");
    setAlarmSound(user.alarmSound ?? "siren");
  }, [user.id, user.theme, user.alarmSound]);

  async function changeTheme(id: string) {
    setTheme(id);
    applyTheme(id);
    await fetch("/api/user/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: id }),
    }).catch(() => {});
  }

  async function changeSound(id: string) {
    setAlarmSound(id);
    await fetch("/api/user/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alarmSound: id }),
    }).catch(() => {});
  }

  const dashboardQuery = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (res.status === 401) {
        onLogout();
        throw new Error("unauthorized");
      }
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
    refetchInterval: 10000, // 10 с: таймеры тикают локально, запас по лимитам бесплатного хостинга
  });

  // Синхронизация времени с сервером + тик каждую секунду
  useEffect(() => {
    if (dashboardQuery.data?.serverNow) {
      serverOffsetRef.current =
        Date.parse(dashboardQuery.data.serverNow) - Date.now();
    }
  }, [dashboardQuery.data?.serverNow]);

  useEffect(() => {
    const timer = setInterval(
      () => setNow(Date.now() + serverOffsetRef.current),
      1000
    );
    return () => clearInterval(timer);
  }, []);

  const devices = dashboardQuery.data?.devices ?? [];
  const packages = dashboardQuery.data?.packages ?? [];
  const clubName = dashboardQuery.data?.clubName ?? "PlayZone CRM";

  // Офлайн-индикатор в шапке + автообновление после синхронизации очереди
  const online = useSyncExternalStore(
    (l) => {
      window.addEventListener("online", l);
      window.addEventListener("offline", l);
      return () => {
        window.removeEventListener("online", l);
        window.removeEventListener("offline", l);
      };
    },
    () => navigator.onLine,
    () => true
  );
  const pendingOps = useSyncExternalStore(subscribePending, getPendingSnapshot, () => 0);

  const psDevices = useMemo(
    () => devices.filter((d) => d.type === "PLAYSTATION"),
    [devices]
  );
  const vrDevices = useMemo(() => devices.filter((d) => d.type === "VR"), [devices]);

  const overdueCount = useMemo(
    () =>
      devices.filter(
        (d) =>
          d.activeSession &&
          Date.parse(d.activeSession.plannedEndAt) < now &&
          !d.activeSession.notified
      ).length,
    [devices, now]
  );

  const busyCount = devices.filter((d) => d.activeSession).length;

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  // После офлайн-синхронизации подтягиваем настоящие данные с сервера
  useEffect(() => {
    return onSyncResult((r) => {
      if (r.synced > 0) {
        onToast("Интернет вернулся — данные синхронизированы");
        refresh();
        void queryClient.invalidateQueries({ queryKey: ["cash"] });
      }
      if (r.failed > 0) {
        onToast(`Синхронизация: ${r.failed} опер. отклонено сервером${r.error ? ` — ${r.error}` : ""}`);
      }
    });
  }, [queryClient]);

  // Тихо подписать это устройство на push, если разрешение уже выдано —
  // чтобы уведомления «время вышло» заработали сами, без кнопки в меню
  useEffect(() => {
    void ensurePushSubscribed();
  }, []);

  // Нативный APK: синхронизируем активные сеансы с Android-оболочкой —
  // там ставятся системные будильники (AlarmManager), которые сработают
  // в точное время, даже если приложение закрыто, а интернета нет
  useEffect(() => {
    syncNativeAlarms(dashboardQuery.data?.devices ?? []);
  }, [dashboardQuery.data]);

  // Push/события service worker: пока приложение видно, сервер шлёт нам
  // сообщение вместо системного уведомления — обновляем данные, сирену
  // включит AlarmCenter (сеанс всё ещё overdue); клик по уведомлению — тоже сюда
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "push-overdue" || e.data?.type === "push-open") {
        void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [queryClient]);

  function openStart(device: DeviceWithSession) {
    setStartDevice(device);
    setStartOpen(true);
  }

  function openComplete(device: DeviceWithSession) {
    setCompleteDevice(device);
    setCompleteOpen(true);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    onLogout();
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Шапка */}
      <header className="sticky top-0 z-40 bg-header text-header-fg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Gamepad2 className="h-6 w-6 shrink-0" />
            <span className="font-bold text-lg truncate">{clubName}</span>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex border-white/25 text-header-fg/85 shrink-0"
            >
              {user.role === "ADMIN" ? "Главный" : "Сотрудник"}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            <PwaInstaller />
            <ContactsButton user={user} />
            <ThemeSoundMenu theme={theme} sound={alarmSound} onTheme={changeTheme} onSound={changeSound} />
            {(!online || pendingOps > 0) && (
              <button
                onClick={() => void flushOutbox()}
                title={
                  online
                    ? `Сохранённых операций: ${pendingOps} — нажмите для отправки`
                    : `Нет интернета. Приложение продолжает работать, сохранено операций: ${pendingOps}`
                }
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white ${
                  online ? "bg-amber-500 hover:bg-amber-600" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {online ? <RefreshCw className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">
                  {online ? "Отправить" : "Нет интернета"}
                </span>
                {pendingOps > 0 && <span>{pendingOps}</span>}
              </button>
            )}
            {overdueCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold animate-pulse">
                <AlarmClock className="h-3.5 w-3.5" />
                {overdueCount}
              </span>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="text-header-fg/80 hover:text-header-fg hover:bg-white/10"
              onClick={() => {
                setMuted((m) => {
                  onToast(m ? "Звуковые уведомления включены" : "Звук отключён");
                  return !m;
                });
              }}
              aria-label={muted ? "Включить звук" : "Отключить звук"}
              title={muted ? "Включить звук уведомлений" : "Отключить звук уведомлений"}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
            <span className="hidden md:block text-sm text-header-fg/85 mr-1">
              {user.name}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="text-header-fg/80 hover:text-header-fg hover:bg-white/10"
              onClick={handleLogout}
              aria-label="Выйти"
              title="Выйти"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Tabs defaultValue="cash" className="gap-6">
          <TabsList className="bg-card border flex-wrap h-auto">
            <TabsTrigger value="cash" className="gap-1.5">
              <Monitor className="h-4 w-4" />
              Касса
              {busyCount > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5">
                  {busyCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1.5">
              <CalendarRange className="h-4 w-4" />
              График
            </TabsTrigger>
            <TabsTrigger value="tournaments" className="gap-1.5">
              <Trophy className="h-4 w-4" />
              Турниры
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-4 w-4" />
              История
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Отчёты
            </TabsTrigger>
            <TabsTrigger value="salary" className="gap-1.5">
              <Wallet className="h-4 w-4" />
              Зарплата
            </TabsTrigger>
            {user.role === "ADMIN" && (
              <TabsTrigger value="settings" className="gap-1.5">
                <Settings className="h-4 w-4" />
                Настройки
              </TabsTrigger>
            )}
          </TabsList>

          {/* Касса */}
          <TabsContent value="cash" className="space-y-6">
            {/* Живая касса: открытия, приход от оплат сразу, авансы, расходы */}
            <CashPanel user={user} onToast={onToast} />

            {/* Статистика для главного аккаунта */}
            {dashboardQuery.data?.adminStats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard title="Выручка сегодня" value={formatTenge(dashboardQuery.data.adminStats.todayRevenue)} accent />
                <StatCard title="Наличные" value={formatTenge(dashboardQuery.data.adminStats.todayCash)} />
                <StatCard title="Каспи" value={formatTenge(dashboardQuery.data.adminStats.todayKaspi)} />
                <StatCard title="Сеансов сегодня" value={String(dashboardQuery.data.adminStats.todaySessions)} />
              </div>
            )}

            <DeviceSection
              title="PlayStation"
              devices={psDevices}
              now={now}
              onStart={openStart}
              onComplete={openComplete}
              loading={dashboardQuery.isLoading}
            />
            <DeviceSection
              title="VR кресла"
              devices={vrDevices}
              now={now}
              onStart={openStart}
              onComplete={openComplete}
              loading={dashboardQuery.isLoading}
            />
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleView currentUser={user} clubName={clubName} onToast={onToast} />
          </TabsContent>

          <TabsContent value="tournaments">
            <TournamentsView currentUser={user} onToast={onToast} />
          </TabsContent>

          <TabsContent value="history">
            <HistoryView currentUser={user} onToast={onToast} />
          </TabsContent>

          <TabsContent value="reports">
            <ReportsView currentUser={user} onToast={onToast} />
          </TabsContent>

          <TabsContent value="salary">
            <SalaryView currentUser={user} onToast={onToast} />
          </TabsContent>

          {user.role === "ADMIN" && (
            <TabsContent value="settings">
              <SettingsView
                onToast={onToast}
                clubName={clubName}
                onChangedClubName={refresh}
                currentUser={user}
              />
            </TabsContent>
          )}
        </Tabs>
      </main>

      <footer className="mt-auto py-4 text-center text-xs text-muted-foreground">
        PlayZone CRM · учёт сеансов PlayStation и VR
      </footer>

      {/* Диалоги */}
      <NewSessionDialog
        device={startDevice}
        packages={packages}
        promos={dashboardQuery.data?.promos ?? []}
        customers={dashboardQuery.data?.customers ?? []}
        vrGames={dashboardQuery.data?.vrGames ?? []}
        open={startOpen}
        onOpenChange={setStartOpen}
        onStarted={(m) => {
          onToast(m);
          refresh();
          // Касса пополняется сразу при принятии оплаты
          void queryClient.invalidateQueries({ queryKey: ["cash"] });
        }}
        onError={onToast}
      />
      <CompleteSessionDialog
        device={completeDevice}
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        onCompleted={(m) => {
          onToast(m);
          refresh();
        }}
        onError={onToast}
      />
      <AlarmCenter
        devices={devices}
        now={now}
        muted={muted}
        sound={alarmSound}
        onComplete={openComplete}
        onRefresh={refresh}
        onToast={onToast}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent
          ? "bg-header text-header-fg border-transparent"
          : "bg-card"
      }`}
    >
      <div
        className={`text-xs font-medium ${accent ? "opacity-75" : "text-muted-foreground"}`}
      >
        {title}
      </div>
      <div className="text-xl lg:text-2xl font-bold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function DeviceSection({
  title,
  devices,
  now,
  onStart,
  onComplete,
  loading,
}: {
  title: string;
  devices: DeviceWithSession[];
  now: number;
  onStart: (d: DeviceWithSession) => void;
  onComplete: (d: DeviceWithSession) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <section>
        <h2 className="text-lg font-bold mb-3">{title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[168px] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    );
  }
  if (devices.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-bold mb-3">{title}</h2>
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Нет устройств. Добавьте их в разделе «Настройки» (главный аккаунт).
        </div>
      </section>
    );
  }
  return (
    <section>
      <h2 className="text-lg font-bold mb-3">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {devices.map((d) => (
          <DeviceCard
            key={d.id}
            device={d}
            now={now}
            onStart={onStart}
            onComplete={onComplete}
          />
        ))}
      </div>
    </section>
  );
}
