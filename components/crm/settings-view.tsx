"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LockKeyhole, Save, Store, Tag, Timer, Users, UserRound, Wrench, Gamepad2, Swords } from "lucide-react";
import { PackagesManager, DevicesManager, StaffManager } from "./settings-manage";
import { PromosManager } from "./promos-manager";
import { CustomersManager } from "./customers-manager";
import { VrGamesManager } from "./vrgames-manager";
import { TournamentGamesManager } from "./tournament-games-manager";
import type { CurrentUser } from "@/lib/crm-types";

async function putSettings(payload: Record<string, unknown>) {
  const res = await fetch("/api/admin/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Ошибка сервера");
  return data.message as string;
}

export function SettingsView({
  onToast,
  clubName,
  onChangedClubName,
  currentUser,
}: {
  onToast: (m: string) => void;
  clubName: string;
  onChangedClubName: () => void;
  currentUser: CurrentUser;
}) {
  return (
    <Tabs defaultValue="packages" className="gap-6">
      <TabsList className="bg-card border flex-wrap h-auto">
        <TabsTrigger value="packages" className="gap-1.5">
          <Timer className="h-4 w-4" /> Пакеты
        </TabsTrigger>
        <TabsTrigger value="promos" className="gap-1.5">
          <Tag className="h-4 w-4" /> Акции
        </TabsTrigger>
        <TabsTrigger value="customers" className="gap-1.5">
          <UserRound className="h-4 w-4" /> Клиенты
        </TabsTrigger>
        <TabsTrigger value="vrgames" className="gap-1.5">
          <Gamepad2 className="h-4 w-4" /> VR игры
        </TabsTrigger>
        <TabsTrigger value="tgames" className="gap-1.5">
          <Swords className="h-4 w-4" /> Игры турниров
        </TabsTrigger>
        <TabsTrigger value="devices" className="gap-1.5">
          <Wrench className="h-4 w-4" /> Устройства
        </TabsTrigger>
        <TabsTrigger value="staff" className="gap-1.5">
          <Users className="h-4 w-4" /> Сотрудники
        </TabsTrigger>
        <TabsTrigger value="security" className="gap-1.5">
          <LockKeyhole className="h-4 w-4" /> Пароли
        </TabsTrigger>
      </TabsList>

      <TabsContent value="packages">
        <PackagesManager onToast={onToast} />
      </TabsContent>
      <TabsContent value="promos">
        <PromosManager onToast={onToast} />
      </TabsContent>
      <TabsContent value="customers">
        <CustomersManager onToast={onToast} />
      </TabsContent>
      <TabsContent value="vrgames">
        <VrGamesManager onToast={onToast} />
      </TabsContent>
      <TabsContent value="tgames">
        <TournamentGamesManager onToast={onToast} />
      </TabsContent>
      <TabsContent value="devices">
        <DevicesManager onToast={onToast} />
      </TabsContent>
      <TabsContent value="staff">
        <StaffManager onToast={onToast} currentUserId={currentUser.id} />
      </TabsContent>
      <TabsContent value="security" className="max-w-xl space-y-4">
        <ClubNameCard clubName={clubName} onToast={onToast} onChanged={onChangedClubName} />
        <CompletionPasswordCard onToast={onToast} />
        <AdminPasswordCard onToast={onToast} />
      </TabsContent>
    </Tabs>
  );
}

function ClubNameCard({
  clubName,
  onToast,
  onChanged,
}: {
  clubName: string;
  onToast: (m: string) => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState(clubName);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const msg = await putSettings({ clubName: name });
      onToast(msg);
      onChanged();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Store className="h-4 w-4" /> Название клуба
        </CardTitle>
        <CardDescription>Отображается в шапке программы</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="PlayZone" />
        <Button onClick={save} disabled={saving || !name.trim()} className="shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сохранить
        </Button>
      </CardContent>
    </Card>
  );
}

function CompletionPasswordCard({ onToast }: { onToast: (m: string) => void }) {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (pwd !== confirm) {
      onToast("Пароли не совпадают");
      return;
    }
    setSaving(true);
    try {
      const msg = await putSettings({ completionPassword: pwd });
      onToast(msg);
      setPwd("");
      setConfirm("");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LockKeyhole className="h-4 w-4" /> Пароль завершения сеанса
        </CardTitle>
        <CardDescription>
          Запрашивается при завершении сеанса на кассе. По умолчанию — 0000.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="completion-pwd">Новый пароль</Label>
            <Input
              id="completion-pwd"
              type="password"
              inputMode="numeric"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="0000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="completion-confirm">Повторите</Label>
            <Input
              id="completion-confirm"
              type="password"
              inputMode="numeric"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="0000"
            />
          </div>
        </div>
        <Button
          onClick={save}
          disabled={saving || pwd.length < 3 || pwd !== confirm}
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Изменить пароль завершения
        </Button>
      </CardContent>
    </Card>
  );
}

function AdminPasswordCard({ onToast }: { onToast: (m: string) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (next !== confirm) {
      onToast("Новые пароли не совпадают");
      return;
    }
    setSaving(true);
    try {
      const msg = await putSettings({ currentPassword: current, newPassword: next });
      onToast(msg);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LockKeyhole className="h-4 w-4" /> Пароль главного аккаунта
        </CardTitle>
        <CardDescription>Ваш личный пароль для входа в программу</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="admin-current">Текущий пароль</Label>
          <Input
            id="admin-current"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="admin-next">Новый пароль</Label>
            <Input
              id="admin-next"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-confirm">Повторите</Label>
            <Input
              id="admin-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={save} disabled={saving || !current || next.length < 3 || next !== confirm}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Изменить пароль
        </Button>
      </CardContent>
    </Card>
  );
}
