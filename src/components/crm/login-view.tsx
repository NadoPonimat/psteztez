"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gamepad2, Loader2, LockKeyhole, User } from "lucide-react";
import type { CurrentUser } from "@/lib/crm-types";

export function LoginView({ onSuccess }: { onSuccess: (user: CurrentUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError(
        "Нет интернета — вход требует подключения. Приложение помнит вход 14 дней, поэтому обычно интернет нужен только при первом входе."
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка входа");
        return;
      }
      onSuccess(data.user);
    } catch {
      setError("Не удалось подключиться к серверу. Проверьте интернет и попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-header text-header-fg flex items-center justify-center mb-3">
            <Gamepad2 className="h-9 w-9 text-emerald-400 dark:text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">PlayZone CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Учёт PlayStation и VR кресел
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Вход для сотрудников</CardTitle>
            <CardDescription>
              У каждого сотрудника свой логин и пароль
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Логин</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    className="pl-9"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="например: admin"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 border border-destructive/20">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Вход...
                  </>
                ) : (
                  "Войти"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-4 rounded-lg border bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Демо-доступы:</p>
          <p>Главный аккаунт: <span className="font-mono">admin / admin</span></p>
          <p>Сотрудник: <span className="font-mono">kassir / 1234</span></p>
        </div>
      </div>
    </div>
  );
}
