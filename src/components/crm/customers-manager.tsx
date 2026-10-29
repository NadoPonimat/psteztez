"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Pencil, Percent, Phone, Plus, Trash2, UserRound } from "lucide-react";
import type { CustomerItem } from "@/lib/crm-types";
import { phonePretty } from "@/lib/crm-types";

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

type CustomerForm = {
  id?: number;
  name: string;
  phone: string;
  discountPercent: number;
  note: string;
  active: boolean;
};

const emptyCustomerForm: CustomerForm = {
  name: "",
  phone: "",
  discountPercent: 10,
  note: "",
  active: true,
};

// Постоянные клиенты: главный задаёт персональную скидку — «свои цены».
// Сотрудник выбирает клиента при старте сеанса, цена считается автоматически.
export function CustomersManager({ onToast }: { onToast: (m: string) => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ customers: CustomerItem[] }>({
    queryKey: ["admin-customers"],
    queryFn: () => api("/api/admin/customers"),
  });
  const [form, setForm] = useState<CustomerForm | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      onToast("Укажите имя клиента");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        discountPercent: form.discountPercent,
        note: form.note.trim() || null,
        active: form.active,
      };
      if (form.id) {
        await api(`/api/admin/customers/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onToast("Клиент обновлён");
      } else {
        await api("/api/admin/customers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onToast("Клиент добавлен — его скидка будет применяться на кассе");
      }
      setForm(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: CustomerItem) {
    try {
      await api(`/api/admin/customers/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !c.active }),
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function remove(c: CustomerItem) {
    try {
      const res = await api<{ message?: string }>(`/api/admin/customers/${c.id}`, {
        method: "DELETE",
      });
      onToast(res.message ?? "Клиент удалён");
      void queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const customers = data?.customers ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Постоянные клиенты с персональной скидкой. На кассе сотрудник выбирает клиента —
          цена со скидкой считается сама (если действует акция выгоднее — применится она).
        </p>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setForm({ ...emptyCustomerForm })}>
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader className="bg-muted/95">
              <TableRow>
                <TableHead>Клиент</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Скидка</TableHead>
                <TableHead>Примечание</TableHead>
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
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    Постоянных клиентов пока нет. Например: «Ерасыл», скидка 10%.
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id} className={c.active ? undefined : "opacity-55"}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.name}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {c.phone ? (
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {phonePretty(c.phone)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {c.discountPercent > 0 ? (
                        <Badge variant="secondary" className="gap-1">
                          <Percent className="h-3 w-3" />
                          −{c.discountPercent}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">без скидки</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-40 truncate" title={c.note ?? undefined}>
                      {c.note ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Switch checked={c.active} onCheckedChange={() => toggleActive(c)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title="Изменить"
                          onClick={() =>
                            setForm({
                              id: c.id,
                              name: c.name,
                              phone: c.phone ?? "",
                              discountPercent: c.discountPercent,
                              note: c.note ?? "",
                              active: c.active,
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-md p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors"
                          title="Удалить"
                          onClick={() => remove(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Форма клиента */}
      <Dialog open={form !== null} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Изменить клиента" : "Новый постоянный клиент"}</DialogTitle>
            <DialogDescription>
              Персональная скидка применяется к любой цене на кассе автоматически.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="customer-name">Имя / название</Label>
                <Input
                  id="customer-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ерасыл"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer-phone">Телефон (необязательно)</Label>
                <Input
                  id="customer-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+7 701 000 00 00"
                  inputMode="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer-discount">Персональная скидка, %</Label>
                <Input
                  id="customer-discount"
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={form.discountPercent}
                  onChange={(e) =>
                    setForm({ ...form, discountPercent: Number(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  0 — без скидки. Пример: 10% от пакета «1 час» 2 500 ₸ = 2 250 ₸.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer-note">Примечание (необязательно)</Label>
                <Input
                  id="customer-note"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="абонемент, брат владельца и т.п."
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Клиент активен</p>
                  <p className="text-xs text-muted-foreground">Неактивные не видны на кассе</p>
                </div>
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
              </div>
              <Button className="w-full" onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {form.id ? "Сохранить изменения" : "Добавить клиента"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
