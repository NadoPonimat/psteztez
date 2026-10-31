"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gamepad2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { CrmProviders } from "@/components/crm/providers";
import { LoginView } from "@/components/crm/login-view";
import { AppShell } from "@/components/crm/app-shell";
import type { CurrentUser } from "@/lib/crm-types";

function CrmRoot() {
  const { toast } = useToast();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [userResolved, setUserResolved] = useState(false);

  // Проверка сохранённой сессии при загрузке
  useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setUserResolved(true);
      }
      return null;
    },
    retry: false,
    staleTime: Infinity,
  });

  const showToast = (message: string) => {
    toast({ description: message });
  };

  if (!userResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Gamepad2 className="h-10 w-10 animate-pulse text-emerald-500" />
          <span className="text-sm">Загрузка CRM...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onSuccess={setUser} />;
  }

  return (
    <AppShell
      user={user}
      onLogout={() => setUser(null)}
      onToast={showToast}
    />
  );
}

export default function Home() {
  return (
    <CrmProviders>
      <CrmRoot />
      <Toaster />
    </CrmProviders>
  );
}
