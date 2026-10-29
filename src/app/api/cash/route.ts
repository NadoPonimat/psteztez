import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/auth";

// Журнал кассы: баланс наличных и Каспи, движения за сегодня.
// Касса наличных: открытия + приход от оплат - авансы наличными - расходы.
// Касса Каспи: открытия + приход от оплат (аванс переводом Каспи кассу НЕ трогает).
// Удаление любой записи (кроме оплат сеансов) — только главный аккаунт;
// баланс = сумма всех проводок, поэтому после удаления касса сразу уменьшается.

async function balances() {
  const agg = await db.cashEntry.aggregate({
    _sum: { cashPart: true, kaspiPart: true },
  });
  return {
    cashBalance: agg._sum.cashPart ?? 0,
    kaspiBalance: agg._sum.kaspiPart ?? 0,
  };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const [bal, entries] = await Promise.all([
      balances(),
      db.cashEntry.findMany({
        where: { createdAt: { gte: startOfToday() } },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { user: { select: { name: true } } },
      }),
    ]);

    const today = {
      openingCash: 0,
      openingKaspi: 0,
      salesCash: 0,
      salesKaspi: 0,
      advancesCash: 0,
      advancesKaspi: 0,
      expensesCash: 0,
    };
    for (const e of entries) {
      if (e.kind === "OPENING_CASH") today.openingCash += e.amount;
      if (e.kind === "OPENING_KASPI") today.openingKaspi += e.amount;
      if (e.kind === "SALE") {
        today.salesCash += e.cashPart;
        today.salesKaspi += e.kaspiPart;
      }
      if (e.kind === "ADVANCE_CASH") today.advancesCash += e.amount;
      if (e.kind === "ADVANCE_KASPI") today.advancesKaspi += e.amount;
      if (e.kind === "EXPENSE" && e.cashPart < 0) today.expensesCash += -e.cashPart;
    }

    return NextResponse.json({
      cashBalance: bal.cashBalance,
      kaspiBalance: bal.kaspiBalance,
      today,
      entries: entries.map((e) => ({
        id: e.id,
        kind: e.kind,
        amount: e.amount,
        cashPart: e.cashPart,
        kaspiPart: e.kaspiPart,
        note: e.note,
        userName: e.user.name,
        createdAt: e.createdAt.toISOString(),
      })),
      openingToday: {
        cash: today.openingCash > 0,
        kaspi: today.openingKaspi > 0,
      },
    });
  } catch (e) {
    console.error("GET /api/cash error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    const body = await req.json();
    const action = body?.action;

    // --- Открытие смены: пересчитанная утром сумма ---
    if (action === "opening") {
      const cash = body.cash != null && body.cash !== "" ? Math.round(Number(body.cash)) : null;
      const kaspi = body.kaspi != null && body.kaspi !== "" ? Math.round(Number(body.kaspi)) : null;
      const note =
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim().slice(0, 200)
          : null;

      if (cash == null && kaspi == null) {
        return NextResponse.json(
          { error: "Укажите сумму наличных и/или Каспи" },
          { status: 400 }
        );
      }
      if ((cash != null && (isNaN(cash) || cash < 0)) || (kaspi != null && (isNaN(kaspi) || kaspi < 0))) {
        return NextResponse.json(
          { error: "Суммы должны быть неотрицательными числами" },
          { status: 400 }
        );
      }

      await db.$transaction(async (tx) => {
        if (cash != null) {
          await tx.cashEntry.create({
            data: { kind: "OPENING_CASH", amount: cash, cashPart: cash, note, userId: user.id },
          });
        }
        if (kaspi != null) {
          await tx.cashEntry.create({
            data: { kind: "OPENING_KASPI", amount: kaspi, kaspiPart: kaspi, note, userId: user.id },
          });
        }
      });

      const bal = await balances();
      return NextResponse.json({ ok: true, ...bal });
    }

    // --- Аванс сотруднику ---
    if (action === "advance") {
      const method = body.method === "KASPI" ? "KASPI" : body.method === "CASH" ? "CASH" : null;
      const amount = Math.round(Number(body.amount));
      const note =
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim().slice(0, 200)
          : null;

      if (!method) {
        return NextResponse.json(
          { error: "Выберите способ: наличными или переводом Каспи" },
          { status: 400 }
        );
      }
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "Сумма аванса должна быть положительным числом" },
          { status: 400 }
        );
      }

      if (method === "CASH") {
        // Наличные выдаются из кассы — проверяем остаток
        const bal = await balances();
        if (amount > bal.cashBalance) {
          return NextResponse.json(
            {
              error: `В кассе недостаточно наличных: остаток ${bal.cashBalance.toLocaleString("ru-RU")} ₸`,
            },
            { status: 400 }
          );
        }
        await db.cashEntry.create({
          data: {
            kind: "ADVANCE_CASH",
            amount,
            cashPart: -amount,
            note: note ?? `Аванс (${user.name})`,
            userId: user.id,
          },
        });
      } else {
        // Перевод Каспи от главного аккаунта: кассы не трогаем, только отметка в журнале
        await db.cashEntry.create({
          data: {
            kind: "ADVANCE_KASPI",
            amount,
            cashPart: 0,
            kaspiPart: 0,
            note: note ?? "Аванс переводом от главного аккаунта",
            userId: user.id,
          },
        });
      }

      const bal = await balances();
      return NextResponse.json({ ok: true, ...bal });
    }

    // --- Расход клуба (шнуры, ремонт и т.п.) ---
    if (action === "expense") {
      const name =
        typeof body.name === "string" && body.name.trim()
          ? body.name.trim().slice(0, 200)
          : null;
      const amount = Math.round(Number(body.amount));
      const source = body.source === "POCKET" ? "POCKET" : body.source === "CASH" ? "CASH" : null;
      const note =
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim().slice(0, 200)
          : null;

      if (!name) {
        return NextResponse.json({ error: "Укажите название расхода" }, { status: 400 });
      }
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "Сумма расхода должна быть положительным числом" },
          { status: 400 }
        );
      }
      if (!source) {
        return NextResponse.json(
          { error: "Укажите источник оплаты: касса наличных или свой карман" },
          { status: 400 }
        );
      }

      if (source === "CASH") {
        // Оплата из кассы — проверяем остаток и списываем сразу
        const bal = await balances();
        if (amount > bal.cashBalance) {
          return NextResponse.json(
            {
              error: `В кассе недостаточно наличных: остаток ${bal.cashBalance.toLocaleString("ru-RU")} ₸`,
            },
            { status: 400 }
          );
        }
        await db.$transaction(async (tx) => {
          const entry = await tx.cashEntry.create({
            data: {
              kind: "EXPENSE",
              amount,
              cashPart: -amount,
              note: `${name}${note ? ` · ${note}` : ""}`,
              userId: user.id,
            },
          });
          await tx.expense.create({
            data: { name, amount, source, note, userId: user.id, cashEntryId: entry.id },
          });
        });
      } else {
        // Из своего кармана: кассу не трогаем, только фиксируем расход
        await db.expense.create({
          data: { name, amount, source, note, userId: user.id },
        });
      }

      const bal = await balances();
      return NextResponse.json({ ok: true, ...bal });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    console.error("POST /api/cash error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// Удаление ошибочной записи кассы (только главный аккаунт).
// Баланс = сумма всех проводок, поэтому касса автоматически пересчитывается.
// Оплаты сеансов (SALE) удаляются вместе с сеансом в разделе «История».
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Не указана запись" }, { status: 400 });
    }

    const entry = await db.cashEntry.findUnique({ where: { id } });
    if (!entry) {
      return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    }
    if (entry.kind === "SALE") {
      return NextResponse.json(
        {
          error:
            "Оплату сеанса нельзя удалить отдельно — удалите сам сеанс в разделе «История», и касса пересчитается",
        },
        { status: 400 }
      );
    }

    await db.cashEntry.delete({ where: { id } });
    const bal = await balances();
    return NextResponse.json({ ok: true, ...bal });
  } catch (e) {
    console.error("DELETE /api/cash error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
