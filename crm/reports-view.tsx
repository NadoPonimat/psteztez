"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  FileSpreadsheet,
  FileImage,
  FileText,
  Gamepad2,
  Loader2,
  Lock,
} from "lucide-react";
import type { CurrentUser, HeatmapData, ReportData } from "@/lib/crm-types";
import { CASH_KIND_LABELS, dateRU, formatTenge, todayStr } from "@/lib/crm-types";
import { PAYMENT_LABELS } from "@/lib/crm-types";

const HEAT_DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// Тепловая карта продаж: выручка по часам и дням недели (только главный аккаунт).
// Показывает самые «горячие» часы клуба, чтобы планировать акции и смены.
function SalesHeatmap({ onToast }: { onToast: (m: string) => void }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const heatQuery = useQuery<HeatmapData>({
    queryKey: ["heatmap", days],
    queryFn: async () => {
      const res = await fetch(`/api/report/heatmap?days=${days}`);
      const d = await res.json();
      if (!res.ok) {
        onToast(d.error ?? "Не удалось загрузить тепловую карту");
        throw new Error("heatmap error");
      }
      return d as HeatmapData;
    },
    staleTime: 60_000,
  });

  const cellMap = useMemo(() => {
    const m = new Map<string, { revenue: number; count: number }>();
    for (const c of heatQuery.data?.cells ?? []) {
      m.set(`${c.dow}-${c.hour}`, c);
    }
    return m;
  }, [heatQuery.data]);
  const max = heatQuery.data?.maxRevenue ?? 0;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold">Тепловая карта продаж</h3>
          <p className="text-xs text-muted-foreground">
            Выручка по часам и дням недели за период — видно, когда в клубе самый поток
          </p>
        </div>
        <div className="flex gap-1.5">
          {([7, 30, 90] as const).map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              onClick={() => setDays(d)}
            >
              {d === 7 ? "Неделя" : d === 30 ? "30 дней" : "90 дней"}
            </Button>
          ))}
        </div>
      </div>

      {heatQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !heatQuery.data || heatQuery.data.cells.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">
          Пока нет данных о продажах за выбранный период
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* Шкала часов */}
              <div className="flex gap-[3px] pl-9 mb-1">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="w-6 text-center text-[9px] text-muted-foreground tabular-nums">
                    {h}
                  </div>
                ))}
              </div>
              {HEAT_DOW.map((label, dow) => (
                <div key={dow} className="flex items-center gap-[3px] mb-[3px]">
                  <div className="w-9 text-[11px] font-semibold text-muted-foreground shrink-0">
                    {label}
                  </div>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const cell = cellMap.get(`${dow}-${hour}`);
                    const ratio = cell && max > 0 ? cell.revenue / max : 0;
                    const pct = Math.round(ratio * 100);
                    return (
                      <div
                        key={hour}
                        className="h-7 w-6 rounded-[4px] shrink-0"
                        style={
                          cell
                            ? {
                                backgroundColor: `color-mix(in srgb, var(--primary) ${Math.max(
                                  12,
                                  pct
                                )}%, transparent)`,
                              }
                            : { backgroundColor: "color-mix(in srgb, var(--muted-foreground) 7%, transparent)" }
                        }
                        title={
                          cell
                            ? `${label} ${String(hour).padStart(2, "0")}:00 — ${cell.count} сеанс(ов), ${cell.revenue.toLocaleString("ru-RU")} ₸`
                            : `${label} ${String(hour).padStart(2, "0")}:00 — нет продаж`
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              меньше
              <span
                className="h-3 w-4 rounded-sm inline-block"
                style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
              />
              <span
                className="h-3 w-4 rounded-sm inline-block"
                style={{ backgroundColor: "color-mix(in srgb, var(--primary) 45%, transparent)" }}
              />
              <span
                className="h-3 w-4 rounded-sm inline-block"
                style={{ backgroundColor: "color-mix(in srgb, var(--primary) 100%, transparent)" }}
              />
              больше
            </span>
            <span>
              Всего за период: {formatTenge(heatQuery.data.totalRevenue)} ·{" "}
              {heatQuery.data.totalCount} сеанс(ов)
            </span>
          </div>
        </>
      )}
    </div>
  );
}

type ReportType = "day" | "period";

export function ReportsView({
  currentUser,
  onToast,
}: {
  currentUser: CurrentUser;
  onToast: (m: string) => void;
}) {
  const isAdmin = currentUser.role === "ADMIN";
  const today = todayStr();
  const [type, setType] = useState<ReportType>("day");
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [exporting, setExporting] = useState<string | null>(null);

  // Сотрудник: всегда только сегодняшний день
  const effectiveType: ReportType = isAdmin ? type : "day";
  const effectiveDate = isAdmin ? date : today;
  const effectiveFrom = isAdmin ? from : today;
  const effectiveTo = isAdmin ? to : today;

  const reportQuery = useQuery<ReportData>({
    queryKey: ["report", effectiveType, effectiveDate, effectiveFrom, effectiveTo],
    queryFn: async () => {
      const params =
        effectiveType === "day"
          ? `type=day&date=${effectiveDate}`
          : `type=period&from=${effectiveFrom}&to=${effectiveTo}`;
      const res = await fetch(`/api/report?${params}`);
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error ?? "Не удалось сформировать отчёт");
        throw new Error("report error");
      }
      return data as ReportData;
    },
    staleTime: 30_000,
  });

  const data = reportQuery.data;
  const fileBase = useMemo(() => {
    if (!data) return "otchet";
    return data.type === "day"
      ? `otchet_den_${data.from}`
      : `otchet_period_${data.from}_${data.to}`;
  }, [data]);

  // ---------- Экспорт PNG ----------
  async function exportPng() {
    const el = document.getElementById("report-document");
    if (!el || !data) return;
    setExporting("png");
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${fileBase}.png`;
      a.click();
      onToast("Отчёт скачан в PNG");
    } catch {
      onToast("Ошибка экспорта PNG");
    } finally {
      setExporting(null);
    }
  }

  // ---------- Экспорт PDF (страницы A4 из растрового снимка) ----------
  async function exportPdf() {
    const el = document.getElementById("report-document");
    if (!el || !data) return;
    setExporting("pdf");
    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");
      const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: "#ffffff" });

      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("img"));
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;
      const pageH = 297;
      const margin = 8;
      const imgWmm = pageW - margin * 2;
      const scale = imgWmm / img.width;
      const sliceHpx = Math.floor((pageH - margin * 2) / scale);

      let y = 0;
      let page = 0;
      while (y < img.height) {
        const h = Math.min(sliceHpx, img.height - y);
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) break;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, y, img.width, h, 0, 0, img.width, h);
        if (page > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", margin, margin, imgWmm, h * scale);
        y += h;
        page += 1;
      }
      pdf.save(`${fileBase}.pdf`);
      onToast("Отчёт скачан в PDF");
    } catch {
      onToast("Ошибка экспорта PDF");
    } finally {
      setExporting(null);
    }
  }

  // ---------- Экспорт Excel ----------
  async function exportExcel() {
    if (!data) return;
    setExporting("excel");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      const title =
        data.type === "day"
          ? `Отчёт за день — ${dateRU(data.from)}`
          : `Отчёт за период — ${dateRU(data.from)} — ${dateRU(data.to)}`;

      const summary: (string | number)[][] = [
        [data.clubName],
        [title],
        [`Сформирован: ${new Date(data.generatedAt).toLocaleString("ru-RU")} · ${data.generatedByName}`],
        [],
        ["ПОКАЗАТЕЛЬ", "ЗНАЧЕНИЕ"],
        ["Общая выручка, ₸", data.totals.revenue],
        ["Наличные, ₸", data.totals.cash],
        ["Каспи, ₸", data.totals.kaspi],
        ["Количество сеансов", data.totals.count],
        ["Средний чек, ₸", data.totals.avgCheck],
        [],
        ["ТИП УСТРОЙСТВ", "ВЫРУЧКА, ₸", "СЕАНСОВ"],
        ["PlayStation", data.byType.PLAYSTATION.revenue, data.byType.PLAYSTATION.count],
        ["VR кресла", data.byType.VR.revenue, data.byType.VR.count],
      ];

      if (data.type === "period" && data.byDay.length > 0) {
        summary.push([]);
        summary.push(["ПО ДНЯМ", "ВЫРУЧКА, ₸", "НАЛИЧНЫЕ, ₸", "КАСПИ, ₸", "СЕАНСОВ"]);
        data.byDay.forEach((d) =>
          summary.push([dateRU(d.day), d.revenue, d.cash, d.kaspi, d.count])
        );
      }

      // Движение кассы
      if (data.cash) {
        summary.push([]);
        summary.push(["КАССА (НАЛИЧНЫЕ)", "СУММА, ₸"]);
        summary.push(["Открытие смены (пересчёт)", data.cash.openingCash]);
        summary.push(["Приход от сеансов", data.cash.salesCash]);
        summary.push(["Авансы (выдано из кассы)", -data.cash.advancesCash]);
        summary.push(["Расходы (оплачено из кассы)", -data.cash.expensesCash]);
        summary.push(["Остаток на конец периода", data.cash.closingCash]);
        summary.push([]);
        summary.push(["КАССА (КАСПИ)", "СУММА, ₸"]);
        summary.push(["Открытие смены", data.cash.openingKaspi]);
        summary.push(["Приход от сеансов", data.cash.salesKaspi]);
        summary.push(["Авансы переводом Каспи (кассу не трогают)", data.cash.advancesKaspi]);
        summary.push(["Остаток на конец периода", data.cash.closingKaspi]);
      }

      // Расходы периода
      if (data.expenses && data.expenses.length > 0) {
        summary.push([]);
        summary.push(["РАСХОДЫ", "СУММА, ₸", "ИСТОЧНИК", "КТО", "ПРИМЕЧАНИЕ"]);
        data.expenses.forEach((e) =>
          summary.push([
            e.name,
            e.amount,
            e.source === "CASH" ? "из кассы наличных" : "из своего кармана",
            e.userName,
            e.note ?? "",
          ])
        );
        summary.push(["Итого расходов", data.expensesTotal ?? 0]);
      }

      const wsSummary = XLSX.utils.aoa_to_sheet(summary);
      wsSummary["!cols"] = [{ wch: 34 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Сводка");

      const rows: (string | number)[][] = [
        ["Дата и время", "Устройство", "Пакет", "Длительность, мин", "Сумма, ₸", "Оплата", "Наличные, ₸", "Каспи, ₸", "Сотрудник"],
        ...data.sessions.map((s) => [
          new Date(s.startedAt).toLocaleString("ru-RU"),
          `${s.deviceType === "VR" ? "VR" : "PS"} ${s.deviceNumber}`,
          s.packageName,
          s.durationMinutes,
          s.price,
          PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod,
          s.cashAmount,
          s.kaspiAmount,
          s.createdByName,
        ]),
      ];
      const wsSessions = XLSX.utils.aoa_to_sheet(rows);
      wsSessions["!cols"] = [
        { wch: 18 }, { wch: 11 }, { wch: 12 }, { wch: 17 }, { wch: 11 },
        { wch: 14 }, { wch: 12 }, { wch: 11 }, { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(wb, wsSessions, "Сеансы");

      // Лист «Касса»: открытия смен и авансы
      if (data.cashEntries && data.cashEntries.length > 0) {
        const cashRows: (string | number)[][] = [
          ["Время", "Операция", "Кто", "Сумма, ₸", "Наличные ±, ₸", "Каспи ±, ₸", "Примечание"],
          ...data.cashEntries.map((e) => [
            new Date(e.createdAt).toLocaleString("ru-RU"),
            CASH_KIND_LABELS[e.kind] ?? e.kind,
            e.userName,
            e.amount,
            e.cashPart,
            e.kaspiPart,
            e.note ?? "",
          ]),
        ];
        const wsCash = XLSX.utils.aoa_to_sheet(cashRows);
        wsCash["!cols"] = [
          { wch: 18 }, { wch: 34 }, { wch: 18 }, { wch: 12 },
          { wch: 14 }, { wch: 12 }, { wch: 30 },
        ];
        XLSX.utils.book_append_sheet(wb, wsCash, "Касса");
      }

      XLSX.writeFile(wb, `${fileBase}.xlsx`);
      onToast("Отчёт скачан в Excel");
    } catch {
      onToast("Ошибка экспорта Excel");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Тепловая карта продаж (только главный аккаунт) */}
      {isAdmin && <SalesHeatmap onToast={onToast} />}

      {/* Панель управления */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        {isAdmin ? (
          <>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={type === "day" ? "default" : "outline"}
                onClick={() => setType("day")}
              >
                <CalendarDays className="h-4 w-4 mr-1.5" />
                Отчёт за день
              </Button>
              <Button
                size="sm"
                variant={type === "period" ? "default" : "outline"}
                onClick={() => setType("period")}
              >
                Отчёт за период
              </Button>
            </div>
            {type === "day" ? (
              <div className="flex items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="report-date" className="text-xs">Дата отчёта</Label>
                  <Input
                    id="report-date"
                    type="date"
                    value={date}
                    max={today}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-44"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-end gap-3 flex-wrap">
                <div className="space-y-1.5">
                  <Label htmlFor="report-from" className="text-xs">С даты</Label>
                  <Input
                    id="report-from"
                    type="date"
                    value={from}
                    max={to}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="report-to" className="text-xs">По дату</Label>
                  <Input
                    id="report-to"
                    type="date"
                    value={to}
                    min={from}
                    max={today}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-40"
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            Сотрудник видит отчёт только за сегодняшний день ({dateRU(today)})
          </div>
        )}

        {/* Кнопки скачивания */}
        <div className="flex gap-2 flex-wrap pt-1">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={!data || exporting !== null || reportQuery.isLoading}
            onClick={exportPdf}
          >
            {exporting === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Скачать PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={!data || exporting !== null || reportQuery.isLoading}
            onClick={exportPng}
          >
            {exporting === "png" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileImage className="h-4 w-4" />
            )}
            Скачать PNG
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={!data || exporting !== null || reportQuery.isLoading}
            onClick={exportExcel}
          >
            {exporting === "excel" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Скачать Excel
          </Button>
        </div>
      </div>

      {/* Превью документа */}
      {reportQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <div className="overflow-x-auto pb-2">
          <ReportDocument data={data} />
        </div>
      ) : null}
    </div>
  );
}

function ReportDocument({ data }: { data: ReportData }) {
  const title =
    data.type === "day"
      ? "ОТЧЁТ ЗА ДЕНЬ"
      : "ОТЧЁТ ЗА ПЕРИОД";
  const periodStr =
    data.type === "day"
      ? dateRU(data.from)
      : `${dateRU(data.from)} — ${dateRU(data.to)}`;

  return (
    <div
      id="report-document"
      className="bg-white text-zinc-900 border border-zinc-200 shadow-sm mx-auto"
      style={{ width: 860, fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <div className="px-10 py-8">
        {/* Шапка */}
        <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-zinc-900 flex items-center justify-center">
              <Gamepad2 className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <div className="text-xl font-black">{data.clubName}</div>
              <div className="text-xs text-zinc-500">Учёт игровых сеансов</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-black tracking-wide">{title}</div>
            <div className="text-sm font-semibold">{periodStr}</div>
          </div>
        </div>

        <div className="text-[11px] text-zinc-500 mt-2 mb-5">
          Сформирован: {new Date(data.generatedAt).toLocaleString("ru-RU")} ·{" "}
          {data.generatedByName}
          {data.generatedByRole === "ADMIN" ? " (главный аккаунт)" : " (сотрудник смены)"}
        </div>

        {/* Сводка */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          <DocStat label="Выручка" value={formatTenge(data.totals.revenue)} dark />
          <DocStat label="Наличные" value={formatTenge(data.totals.cash)} />
          <DocStat label="Каспи" value={formatTenge(data.totals.kaspi)} />
          <DocStat label="Сеансов" value={String(data.totals.count)} />
          <DocStat label="Средний чек" value={formatTenge(data.totals.avgCheck)} />
        </div>

        {/* По типам устройств */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="border rounded-lg p-3">
            <div className="text-[11px] font-bold text-zinc-500 uppercase mb-2">
              PlayStation
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600">Сеансов:</span>
              <span className="font-bold">{data.byType.PLAYSTATION.count}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600">Выручка:</span>
              <span className="font-bold">{formatTenge(data.byType.PLAYSTATION.revenue)}</span>
            </div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-[11px] font-bold text-zinc-500 uppercase mb-2">
              VR кресла
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600">Сеансов:</span>
              <span className="font-bold">{data.byType.VR.count}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600">Выручка:</span>
              <span className="font-bold">{formatTenge(data.byType.VR.revenue)}</span>
            </div>
          </div>
        </div>

        {/* Касса: движения и остаток на конец */}
        {data.cash && (
          <div className="mb-5">
            <div className="text-[11px] font-bold text-zinc-500 uppercase mb-2">Касса</div>
            <div className="grid grid-cols-2 gap-3">
              <table className="text-sm border-collapse">
                <thead>
                  <tr>
                    <th colSpan={2} className="border px-2 py-1 text-left bg-zinc-100">
                      Наличные
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <CashRow label="Открытие смены (пересчёт)" value={data.cash.openingCash} />
                  <CashRow label="Приход от сеансов" value={data.cash.salesCash} />
                  <CashRow label="Авансы (выдано из кассы)" value={-data.cash.advancesCash} signed />
                  <CashRow label="Расходы (оплачено из кассы)" value={-data.cash.expensesCash} signed />
                  <CashRow label="Остаток на конец периода" value={data.cash.closingCash} bold />
                </tbody>
              </table>
              <table className="text-sm border-collapse">
                <thead>
                  <tr>
                    <th colSpan={2} className="border px-2 py-1 text-left bg-zinc-100">
                      Каспи
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <CashRow label="Открытие смены" value={data.cash.openingKaspi} />
                  <CashRow label="Приход от сеансов" value={data.cash.salesKaspi} />
                  <CashRow
                    label="Авансы переводом (кассу не трогают)"
                    value={data.cash.advancesKaspi}
                  />
                  <CashRow label="Остаток на конец периода" value={data.cash.closingKaspi} bold />
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Движения кассы (открытия и авансы) */}
        {data.cashEntries && data.cashEntries.length > 0 && (
          <div className="mb-5">
            <div className="text-[11px] font-bold text-zinc-500 uppercase mb-2">
              Открытия смены и авансы ({data.cashEntries.length})
            </div>
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="border px-2 py-1.5 text-left">Время</th>
                  <th className="border px-2 py-1.5 text-left">Операция</th>
                  <th className="border px-2 py-1.5 text-left">Кто</th>
                  <th className="border px-2 py-1.5 text-right">Сумма, ₸</th>
                  <th className="border px-2 py-1.5 text-left">Примечание</th>
                </tr>
              </thead>
              <tbody>
                {data.cashEntries.map((e) => (
                  <tr key={e.id}>
                    <td className="border px-2 py-1 whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="border px-2 py-1">{CASH_KIND_LABELS[e.kind] ?? e.kind}</td>
                    <td className="border px-2 py-1 whitespace-nowrap">{e.userName}</td>
                    <td className="border px-2 py-1 text-right font-bold tabular-nums">
                      {e.amount.toLocaleString("ru-RU")}
                    </td>
                    <td className="border px-2 py-1">{e.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Расходы периода */}
        {data.expenses && data.expenses.length > 0 && (
          <div className="mb-5">
            <div className="text-[11px] font-bold text-zinc-500 uppercase mb-2">
              Расходы ({data.expenses.length}) — всего {formatTenge(data.expensesTotal ?? 0)}
            </div>
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="border px-2 py-1.5 text-left">Время</th>
                  <th className="border px-2 py-1.5 text-left">Название</th>
                  <th className="border px-2 py-1.5 text-right">Сумма, ₸</th>
                  <th className="border px-2 py-1.5 text-left">Источник</th>
                  <th className="border px-2 py-1.5 text-left">Кто</th>
                  <th className="border px-2 py-1.5 text-left">Примечание</th>
                </tr>
              </thead>
              <tbody>
                {data.expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="border px-2 py-1 whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="border px-2 py-1">{e.name}</td>
                    <td className="border px-2 py-1 text-right font-bold tabular-nums">
                      {e.amount.toLocaleString("ru-RU")}
                    </td>
                    <td className="border px-2 py-1">
                      {e.source === "CASH" ? "из кассы наличных" : "из своего кармана"}
                    </td>
                    <td className="border px-2 py-1 whitespace-nowrap">{e.userName}</td>
                    <td className="border px-2 py-1">{e.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* По дням (для периода) */}
        {data.type === "period" && data.byDay.length > 0 && (
          <div className="mb-5">
            <div className="text-[11px] font-bold text-zinc-500 uppercase mb-2">
              Выручка по дням
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="border px-2 py-1.5 text-left">Дата</th>
                  <th className="border px-2 py-1.5 text-right">Выручка</th>
                  <th className="border px-2 py-1.5 text-right">Наличные</th>
                  <th className="border px-2 py-1.5 text-right">Каспи</th>
                  <th className="border px-2 py-1.5 text-right">Сеансов</th>
                </tr>
              </thead>
              <tbody>
                {data.byDay.map((d) => (
                  <tr key={d.day}>
                    <td className="border px-2 py-1.5">{dateRU(d.day)}</td>
                    <td className="border px-2 py-1.5 text-right font-semibold tabular-nums">
                      {d.revenue.toLocaleString("ru-RU")}
                    </td>
                    <td className="border px-2 py-1.5 text-right tabular-nums">
                      {d.cash.toLocaleString("ru-RU")}
                    </td>
                    <td className="border px-2 py-1.5 text-right tabular-nums">
                      {d.kaspi.toLocaleString("ru-RU")}
                    </td>
                    <td className="border px-2 py-1.5 text-right tabular-nums">{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Сеансы */}
        <div className="mb-6">
          <div className="text-[11px] font-bold text-zinc-500 uppercase mb-2">
            Сеансы ({data.sessions.length})
          </div>
          {data.sessions.length === 0 ? (
            <div className="border rounded-lg px-3 py-6 text-center text-sm text-zinc-500">
              За выбранный период завершённых сеансов нет
            </div>
          ) : (
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="border px-2 py-1.5 text-left">Время</th>
                  <th className="border px-2 py-1.5 text-left">Устройство</th>
                  <th className="border px-2 py-1.5 text-left">Пакет</th>
                  <th className="border px-2 py-1.5 text-left">Оплата</th>
                  <th className="border px-2 py-1.5 text-right">Сумма, ₸</th>
                  <th className="border px-2 py-1.5 text-left">Сотрудник</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.slice(0, 200).map((s) => (
                  <tr key={s.id}>
                    <td className="border px-2 py-1 whitespace-nowrap">
                      {new Date(s.startedAt).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="border px-2 py-1 whitespace-nowrap font-semibold">
                      {s.deviceType === "VR" ? "VR" : "PS"} {s.deviceNumber}
                    </td>
                    <td className="border px-2 py-1 whitespace-nowrap">
                      {s.packageName}
                      <span className="text-zinc-400"> · {s.durationMinutes} мин</span>
                    </td>
                    <td className="border px-2 py-1 whitespace-nowrap">
                      {s.paymentMethod === "MIXED"
                        ? `Смешанная (нал. ${s.cashAmount} + Каспи ${s.kaspiAmount})`
                        : PAYMENT_LABELS[s.paymentMethod]}
                    </td>
                    <td className="border px-2 py-1 text-right font-bold tabular-nums">
                      {s.price.toLocaleString("ru-RU")}
                    </td>
                    <td className="border px-2 py-1 whitespace-nowrap">{s.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.sessions.length > 200 && (
            <div className="text-[11px] text-zinc-500 mt-1">
              Показаны первые 200 сеансов из {data.sessions.length}. Полный список — в выгрузке
              Excel.
            </div>
          )}
        </div>

        {/* Подписи */}
        <div className="grid grid-cols-2 gap-8 pt-4 border-t border-zinc-200">
          <div className="text-xs text-zinc-600">
            Сменный кассир
            <div className="mt-8 border-b border-dashed border-zinc-400" />
            <div className="mt-1 text-[10px] text-zinc-400">подпись / Ф.И.О.</div>
          </div>
          <div className="text-xs text-zinc-600">
            Главный аккаунт
            <div className="mt-8 border-b border-dashed border-zinc-400" />
            <div className="mt-1 text-[10px] text-zinc-400">подпись / Ф.И.О.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocStat({
  label,
  value,
  dark,
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2.5 ${
        dark ? "bg-zinc-900 text-white" : "border border-zinc-300"
      }`}
    >
      <div className={`text-[10px] uppercase font-bold ${dark ? "text-zinc-400" : "text-zinc-500"}`}>
        {label}
      </div>
      <div className="text-base font-black tabular-nums whitespace-nowrap">{value}</div>
    </div>
  );
}

function CashRow({
  label,
  value,
  bold,
  signed,
}: {
  label: string;
  value: number;
  bold?: boolean;
  signed?: boolean;
}) {
  return (
    <tr>
      <td className="border px-2 py-1 text-zinc-600">{label}</td>
      <td
        className={`border px-2 py-1 text-right tabular-nums whitespace-nowrap ${
          bold ? "font-black" : "font-semibold"
        } ${value < 0 ? "text-red-600" : ""}`}
      >
        {signed && value > 0 ? "−" : ""}
        {Math.abs(value).toLocaleString("ru-RU")} ₸
      </td>
    </tr>
  );
}
