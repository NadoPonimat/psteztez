"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, Phone, PhoneCall, UserCog, Users } from "lucide-react";
import { phonePretty, telLink, whatsappLink } from "@/lib/crm-types";
import type { CurrentUser, UserRole } from "@/lib/crm-types";

interface ContactItem {
  id: string;
  name: string;
  role: UserRole;
  phone: string | null;
}

function ContactRow({ contact, self }: { contact: ContactItem; self: boolean }) {
  const tel = telLink(contact.phone);
  const wa = whatsappLink(contact.phone);
  const hasPhone = Boolean(contact.phone && tel);

  return (
    <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold truncate">{contact.name}</span>
          {self && <Badge variant="secondary">вы</Badge>}
          {contact.role === "ADMIN" && (
            <Badge variant="outline" className="text-primary border-primary/40">
              главный
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground tabular-nums">
          {contact.phone ? phonePretty(contact.phone) : "номер не указан"}
        </div>
      </div>
      {hasPhone ? (
        <div className="flex gap-1.5 shrink-0">
          <a
            href={tel}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold hover:opacity-90 transition-opacity"
            title={`Позвонить ${contact.name}`}
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Позвонить
          </a>
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500 text-emerald-600 dark:text-emerald-400 px-3 py-2 text-xs font-semibold hover:bg-emerald-500/10 transition-colors"
            title={`Написать в WhatsApp ${contact.name}`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        </div>
      ) : (
        <span className="text-[11px] text-muted-foreground shrink-0">
          главный добавит номер в настройках
        </span>
      )}
    </div>
  );
}

// Кнопка «Связаться» в шапке: звонок с телефона или WhatsApp сменщику/главному.
// Номера вносит главный аккаунт в Настройках → Сотрудники.
export function ContactsButton({ user }: { user: CurrentUser }) {
  const [open, setOpen] = useState(false);
  const contactsQuery = useQuery<{ contacts: ContactItem[] }>({
    queryKey: ["contacts"],
    queryFn: async () => {
      const res = await fetch("/api/contacts");
      if (!res.ok) throw new Error("Не удалось загрузить контакты");
      return res.json();
    },
    enabled: open,
  });

  const contacts = contactsQuery.data?.contacts ?? [];
  const admins = contacts.filter((c) => c.role === "ADMIN");
  const colleagues = contacts.filter((c) => c.role === "STAFF" && c.id !== user.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium h-9 px-3 text-header-fg/80 hover:text-header-fg hover:bg-white/10 transition-colors"
        onClick={() => setOpen(true)}
        aria-label="Связаться"
        title="Связаться со сменщиком или главным"
      >
        <Phone className="h-5 w-5" />
        <span className="hidden sm:inline">Связаться</span>
      </button>

      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" /> Связаться
          </DialogTitle>
          <DialogDescription>
            Позвонить с телефона или написать в WhatsApp — одним нажатием.
          </DialogDescription>
        </DialogHeader>

        {contactsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground">
                <UserCog className="h-3.5 w-3.5" /> Главный
              </div>
              {admins.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет активного главного аккаунта</p>
              ) : (
                admins.map((c) => <ContactRow key={c.id} contact={c} self={c.id === user.id} />)
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Сменщики
              </div>
              {colleagues.length === 0 ? (
                <p className="text-sm text-muted-foreground">Других сотрудников нет</p>
              ) : (
                colleagues.map((c) => <ContactRow key={c.id} contact={c} self={false} />)
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              Номера телефонов добавляет главный аккаунт: Настройки → Сотрудники.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
