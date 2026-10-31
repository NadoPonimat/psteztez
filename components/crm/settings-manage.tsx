"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Gamepad2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Monitor,
  UserPlus,
  KeyRound,
} from "lucide-react";
import type { Pkg, StaffUser } from "@/lib/crm-types";
import { formatTenge } from "@/lib/crm-types";

type ApiError = { error?: string };

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as ApiError).error ?? "Ошибка сервера");
  }
  return data as T;
}

// ==================== ПАКЕТЫ ====================

type PkgForm = {
  id?: number;
  name: string;
  durationMinutes: number;
  price: number;
  deviceType: string; // "ALL" | "PLAYSTATION" | "VR"
  active: boolean;
};

const emptyPkgForm: PkgForm = {
  name: "",
  durationMinutes: 60,
  price: 2500,
  deviceType: "PLAYSTATION",
  active: true,
};

export function PackagesManager({ onToast }: { onToast: (m: string) => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ packages: Pkg[] }>({
    queryKey: ["admin-packages"],
    queryFn: () => api("/api/admin/packages"),
  });
  const [form, setForm] = useState<PkgForm | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        durationMinutes: form.durationMinutes,
        price: form.price,
        deviceType: form.deviceType === "ALL" ? null : form.deviceType,
        active: form.active,
      };
      if (form.id) {
        await api(`/api/admin/packages/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onToast("Пакет обновлён");
      } else {
        await api("/api/admin/packages", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onToast("Пакет добавлен");
      }
      setForm(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Pkg) {
    try {
      await api(`/api/admin/packages/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !p.active }),
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function remove(p: Pkg) {
    try {
      const res = await api<{ message?: string }>(`/api/admin/packages/${p.id}`, {
        method: "DELETE",
      });
      onToast(res.message ?? "Пакет удалён");
      void queryClient.invalidateQueries({ queryKey: ["admin-packages"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Пакеты времени и их стоимость. Продаются сотрудниками на кассе.
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => setForm({ ...emptyPkgForm })}>
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader className="bg-muted/95">
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Длительность</TableHead>
                <TableHead>Цена</TableHead>
                <TableHead>Для устройств</TableHead>
                <TableHead>Активен</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : !data?.packages.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    Пакетов нет — добавьте первый
                  </TableCell>
                </TableRow>
              ) : (
                data.packages.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="tabular-nums">{p.durationMinutes} мин</TableCell>
                    <TableCell className="font-bold tabular-nums">
                      {formatTenge(p.price)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {p.deviceType === "PLAYSTATION"
                          ? "PlayStation"
                          : p.deviceType === "VR"
                            ? "VR кресла"
                            : "Все"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.active}
                        onCheckedChange={() => toggleActive(p)}
                        aria-label="Активен"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setForm({
                              id: p.id,
                              name: p.name,
                              durationMinutes: p.durationMinutes,
                              price: p.price,
                              deviceType: p.deviceType ?? "ALL",
                              active: p.active,
                            })
                          }
                          aria-label="Редактировать"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => remove(p)}
                          aria-label="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Изменить пакет" : "Новый пакет"}</DialogTitle>
            <DialogDescription>
              Например: «1 час», 60 минут, 2500 ₸ для PlayStation
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Название</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="1 час"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Длительность (мин)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.durationMinutes}
                    onChange={(e) =>
                      setForm({ ...form, durationMinutes: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Цена (₸)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Для устройств</Label>
                <Select
                  value={form.deviceType}
                  onValueChange={(v) => setForm({ ...form, deviceType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLAYSTATION">PlayStation</SelectItem>
                    <SelectItem value="VR">VR кресла</SelectItem>
                    <SelectItem value="ALL">Все устройства</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Label htmlFor="pkg-active" className="text-sm">
                  Показывать на кассе
                </Label>
                <Switch
                  id="pkg-active"
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
              </div>
              <Button className="w-full" onClick={save} disabled={saving || !form.name}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Сохранить
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== УСТРОЙСТВА ====================

type AdminDevice = {
  id: number;
  type: string;
  number: number;
  active: boolean;
  hasActiveSession: boolean;
  totalSessions: number;
};

export function DevicesManager({ onToast }: { onToast: (m: string) => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ devices: AdminDevice[] }>({
    queryKey: ["admin-devices"],
    queryFn: () => api("/api/admin/devices"),
  });
  const [newType, setNewType] = useState("PLAYSTATION");
  const [newNumber, setNewNumber] = useState("");
  const [adding, setAdding] = useState(false);

  async function add() {
    const num = Number(newNumber);
    if (!num || num < 1) {
      onToast("Укажите номер устройства");
      return;
    }
    setAdding(true);
    try {
      await api("/api/admin/devices", {
        method: "POST",
        body: JSON.stringify({ type: newType, number: num }),
      });
      onToast("Устройство добавлено");
      setNewNumber("");
      void queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(d: AdminDevice) {
    try {
      await api(`/api/admin/devices/${d.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !d.active }),
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function remove(d: AdminDevice) {
    try {
      const res = await api<{ message?: string }>(`/api/admin/devices/${d.id}`, {
        method: "DELETE",
      });
      onToast(res.message ?? "Устройство удалено");
      void queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const devices = data?.devices ?? [];
  const ps = devices.filter((d) => d.type === "PLAYSTATION");
  const vr = devices.filter((d) => d.type === "VR");

  const renderRow = (d: AdminDevice) => (
    <TableRow key={d.id} className={d.active ? "" : "opacity-50"}>
      <TableCell className="font-medium">
        <span className="flex items-center gap-1.5">
          {d.type === "VR" ? (
            <Monitor className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Gamepad2 className="h-4 w-4 text-muted-foreground" />
          )}
          {d.type === "VR" ? `VR ${d.number}` : `PS ${d.number}`}
        </span>
      </TableCell>
      <TableCell>
        {d.hasActiveSession ? (
          <Badge className="bg-amber-500 text-white hover:bg-amber-500">Идёт сеанс</Badge>
        ) : (
          <Badge variant="secondary">—</Badge>
        )}
      </TableCell>
      <TableCell className="tabular-nums text-muted-foreground">
        {d.totalSessions} всего
      </TableCell>
      <TableCell>
        <Switch
          checked={d.active}
          onCheckedChange={() => toggleActive(d)}
          aria-label="Показывать"
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive"
          onClick={() => remove(d)}
          disabled={d.hasActiveSession}
          aria-label="Удалить"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Игровые устройства клуба. Скрытые устройства не показываются на кассе.
      </p>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-muted/30 p-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Тип</Label>
          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PLAYSTATION">PlayStation</SelectItem>
              <SelectItem value="VR">VR кресло</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Номер</Label>
          <Input
            type="number"
            min={1}
            className="w-24"
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            placeholder="7"
          />
        </div>
        <Button className="gap-1.5" onClick={add} disabled={adding}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Добавить
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {[
            { title: "PlayStation", rows: ps },
            { title: "VR кресла", rows: vr },
          ].map((group) => (
            <div key={group.title} className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-2.5 text-sm font-bold border-b bg-muted/50">
                {group.title}
              </div>
              <div className="max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Устройство</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>История</TableHead>
                      <TableHead>Показ</TableHead>
                      <TableHead className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground text-sm">
                          Нет устройств
                        </TableCell>
                      </TableRow>
                    ) : (
                      group.rows.map(renderRow)
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== СОТРУДНИКИ ====================

export function StaffManager({
  onToast,
  currentUserId,
}: {
  onToast: (m: string) => void;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ users: StaffUser[] }>({
    queryKey: ["admin-users"],
    queryFn: () => api("/api/admin/users"),
  });
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", name: "", password: "", role: "STAFF", phone: "" });
  const [pwdUser, setPwdUser] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteUser, setDeleteUser] = useState<StaffUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Удаление сотрудника: история остаётся (сеансы/касса/расходы переписываются
  // на главного), смены освобождаются, вход отключается на всех устройствах
  async function confirmDelete() {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      const res = await api<{ ok: boolean; sessions: number; cash: number; expenses: number }>(
        `/api/admin/users/${deleteUser.id}`,
        { method: "DELETE" }
      );
      const moved: string[] = [];
      if (res.sessions > 0) moved.push(`сеансов: ${res.sessions}`);
      if (res.cash > 0) moved.push(`записей кассы: ${res.cash}`);
      if (res.expenses > 0) moved.push(`расходов: ${res.expenses}`);
      onToast(
        `Сотрудник ${deleteUser.username} удалён${
          moved.length ? ` (история сохранена за главным: ${moved.join(", ")})` : ""
        }`
      );
      setDeleteUser(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setDeleting(false);
    }
  }

  // Сохранение телефона при выходе из поля (если изменился)
  async function savePhone(u: StaffUser, value: string) {
    const phone = value.trim();
    if ((u.phone ?? "") === phone) return;
    await patchUser(u.id, { phone: phone || null }, `Телефон ${u.username} сохранён`);
  }

  async function addUser() {
    setSaving(true);
    try {
      await api("/api/admin/users", { method: "POST", body: JSON.stringify(newUser) });
      onToast(`Сотрудник ${newUser.username} создан`);
      setAddOpen(false);
      setNewUser({ username: "", name: "", password: "", role: "STAFF", phone: "" });
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function patchUser(id: string, payload: Record<string, unknown>, okMsg: string) {
    try {
      await api(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      onToast(okMsg);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function changePassword() {
    if (!pwdUser) return;
    if (newPassword.length < 3) {
      onToast("Пароль минимум 3 символа");
      return;
    }
    await patchUser(pwdUser.id, { password: newPassword }, `Пароль ${pwdUser.username} изменён`);
    setPwdUser(null);
    setNewPassword("");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          У каждого сотрудника — свой аккаунт для входа в CRM.
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4" /> Добавить
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader className="bg-muted/95">
              <TableRow>
                <TableHead>Логин</TableHead>
                <TableHead>Имя</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Условия оплаты</TableHead>
                <TableHead>Доступ</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : (
                data?.users.map((u) => (
                  <TableRow key={u.id} className={u.active ? "" : "opacity-50"}>
                    <TableCell className="font-mono font-medium">{u.username}</TableCell>
                    <TableCell>
                      {u.name}
                      {u.id === currentUserId && (
                        <Badge variant="secondary" className="ml-2">
                          вы
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={u.phone ?? ""}
                        placeholder="+7 701 000 00 00"
                        inputMode="tel"
                        className="w-40 h-8 text-sm"
                        onBlur={(e) => savePhone(u, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(v) =>
                          patchUser(u.id, { role: v }, `Роль ${u.username} изменена`)
                        }
                        disabled={u.id === currentUserId}
                      >
                        <SelectTrigger className="w-36 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Главный</SelectItem>
                          <SelectItem value="STAFF">Сотрудник</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {u.dailyRate
                        ? `${u.dailyRate.toLocaleString("ru-RU")} ₸/день`
                        : "—"}
                      {u.bonusPercent ? (
                        <span className="text-muted-foreground">
                          {" · +"}
                          {u.bonusPercent}% ≥ {u.bonusThreshold?.toLocaleString("ru-RU")} ₸
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={u.active}
                        onCheckedChange={(v) =>
                          patchUser(u.id, { active: v }, `Доступ ${u.username} обновлён`)
                        }
                        aria-label="Доступ"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => {
                            setPwdUser(u);
                            setNewPassword("");
                          }}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Пароль
                        </Button>
                        {u.id !== currentUserId && (
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            onClick={() => setDeleteUser(u)}
                            aria-label={`Удалить сотрудника ${u.username}`}
                            title="Удалить сотрудника"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Диалог добавления */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Новый сотрудник</DialogTitle>
            <DialogDescription>Логин и пароль для входа в программу</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Логин</Label>
              <Input
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="айбек"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Имя</Label>
              <Input
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                placeholder="Айбек Сериков"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Телефон (для кнопки «Связаться»)</Label>
              <Input
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                placeholder="+7 701 000 00 00"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Пароль</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="минимум 3 символа"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Роль</Label>
              <Select
                value={newUser.role}
                onValueChange={(v) => setNewUser({ ...newUser, role: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">Сотрудник</SelectItem>
                  <SelectItem value="ADMIN">Главный (полный доступ)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={addUser}
              disabled={
                saving || !newUser.username || !newUser.name || !newUser.password
              }
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Создать аккаунт
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог смены пароля */}
      <Dialog open={!!pwdUser} onOpenChange={(o) => !o && setPwdUser(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Сменить пароль</DialogTitle>
            <DialogDescription>
              Для аккаунта <span className="font-mono">{pwdUser?.username}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Новый пароль</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="минимум 3 символа"
              />
            </div>
            <Button className="w-full" onClick={changePassword}>
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения удаления сотрудника */}
      <AlertDialog open={deleteUser !== null} onOpenChange={(v) => !v && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Удалить сотрудника {deleteUser?.username}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Аккаунт и вход в приложение будут удалены на всех устройствах, смены в
              графике освободятся. История не пропадёт: сеансы, записи кассы и расходы
              останутся в отчётах — будут числиться за главным аккаунтом.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
