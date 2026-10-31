import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  activePromoDiscount,
  computeSessionPrice,
  promoDiscountLabel,
} from "@/lib/crm-types";
import type { CustomerItem, DeviceType, PaymentMethod, PromoItem } from "@/lib/crm-types";

// Запуск нового сеанса аренды. Источник цены — обычный пакет времени (packageId)
// или VR-игра из каталога (vrGameId, только для VR-кресел). Дополнительно можно
// указать постоянного клиента (customerId) — применится его скидка (или акция,
// если она выгоднее). Скидка считается на сервере, сотрудник не сможет занизить.
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    const body = await req.json();
    const { deviceId, packageId, vrGameId, customerId, paymentMethod, cashAmount, kaspiAmount } =
      body as {
        deviceId: number;
        packageId?: number;
        vrGameId?: number;
        customerId?: number;
        paymentMethod: PaymentMethod;
        cashAmount?: number;
        kaspiAmount?: number;
      };

    if (!deviceId || !paymentMethod || (!packageId && !vrGameId)) {
      return NextResponse.json(
        { error: "Не все поля заполнены" },
        { status: 400 }
      );
    }

    const device = await db.device.findUnique({ where: { id: deviceId } });
    if (!device || !device.active) {
      return NextResponse.json({ error: "Устройство не найдено" }, { status: 404 });
    }

    const activeSession = await db.session.findFirst({
      where: { deviceId, status: "ACTIVE" },
    });
    if (activeSession) {
      return NextResponse.json(
        { error: `На устройстве уже идёт сеанс` },
        { status: 409 }
      );
    }

    // --- Источник цены: VR-игра или пакет времени ---
    let baseName: string;
    let durationMinutes: number;
    let basePrice: number;
    let pkgId: number | null = null;
    let gameId: number | null = null;

    if (vrGameId) {
      if (device.type !== "VR") {
        return NextResponse.json(
          { error: "VR-игры запускаются только на VR-креслах" },
          { status: 400 }
        );
      }
      const game = await db.vrGame.findUnique({ where: { id: vrGameId } });
      if (!game || !game.active) {
        return NextResponse.json({ error: "VR-игра не найдена" }, { status: 404 });
      }
      baseName = game.name;
      durationMinutes = game.durationMinutes;
      basePrice = game.price;
      gameId = game.id;
    } else {
      const pkg = await db.package.findUnique({ where: { id: packageId! } });
      if (!pkg || !pkg.active) {
        return NextResponse.json({ error: "Пакет не найден" }, { status: 404 });
      }
      if (pkg.deviceType && pkg.deviceType !== device.type) {
        return NextResponse.json(
          { error: "Пакет не подходит для этого устройства" },
          { status: 400 }
        );
      }
      baseName = pkg.name;
      durationMinutes = pkg.durationMinutes;
      basePrice = pkg.price;
      pkgId = pkg.id;
    }

    // --- Постоянный клиент (опционально) ---
    let customerItem: CustomerItem | null = null;
    if (customerId) {
      const customer = await db.customer.findUnique({ where: { id: customerId } });
      if (!customer || !customer.active) {
        return NextResponse.json({ error: "Постоянный клиент не найден" }, { status: 404 });
      }
      customerItem = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        discountPercent: customer.discountPercent,
        note: customer.note,
        active: customer.active,
      };
    }

    const now = new Date();

    // --- Скидки: акции клуба + персональная скидка клиента (берётся лучшая) ---
    const activePromos = await db.promo.findMany({ where: { active: true } });
    const promoItems = activePromos.map(
      (p): PromoItem => ({
        id: p.id,
        name: p.name,
        discountType: p.discountType === "FIXED" ? "FIXED" : "PERCENT",
        discountValue: p.discountValue,
        timeFrom: p.timeFrom,
        timeTo: p.timeTo,
        days: p.days,
        deviceType: (p.deviceType as DeviceType | null) ?? null,
        active: p.active,
      })
    );
    // Проверяем акцию отдельно, чтобы выбрать подпись скидки (клиент vs акция)
    const promoApplied = activePromoDiscount(
      promoItems,
      device.type as DeviceType,
      basePrice,
      now
    );
    const applied = computeSessionPrice(
      basePrice,
      promoItems,
      device.type as DeviceType,
      customerItem,
      now
    );
    const price = applied.price;
    let discountLabel = applied.discountLabel;
    if (applied.discount > 0 && promoApplied && !customerItem) {
      discountLabel = promoDiscountLabel(promoApplied.promo);
    }

    const cash = Math.max(0, Math.round(cashAmount ?? 0));
    const kaspi = Math.max(0, Math.round(kaspiAmount ?? 0));

    let cashFinal = 0;
    let kaspiFinal = 0;
    if (paymentMethod === "CASH") {
      cashFinal = price;
    } else if (paymentMethod === "KASPI") {
      kaspiFinal = price;
    } else if (paymentMethod === "MIXED") {
      if (cash + kaspi !== price) {
        return NextResponse.json(
          {
            error: `Сумма оплаты (наличные ${cash} + Каспи ${kaspi}) должна равняться стоимости ${price} ₸`,
          },
          { status: 400 }
        );
      }
      cashFinal = cash;
      kaspiFinal = kaspi;
    } else {
      return NextResponse.json({ error: "Неверный способ оплаты" }, { status: 400 });
    }

    const plannedEndAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    // Сеанс + приход в кассу атомарно: деньги попадают в кассу сразу
    // после «Принять оплату и запустить таймер», а не после окончания таймера
    const deviceLabel = `${device.type === "VR" ? "VR" : "PS"} ${device.number}`;
    const session = await db.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: {
          deviceId,
          packageId: pkgId,
          vrGameId: gameId,
          customerId: customerItem?.id ?? null,
          packageName: baseName,
          durationMinutes,
          startedAt: now,
          plannedEndAt,
          price,
          originalPrice: applied.discount > 0 ? basePrice : null,
          discountLabel,
          paymentMethod,
          cashAmount: cashFinal,
          kaspiAmount: kaspiFinal,
          status: "ACTIVE",
          createdById: user.id,
        },
      });
      if (cashFinal > 0 || kaspiFinal > 0) {
        await tx.cashEntry.create({
          data: {
            kind: "SALE",
            amount: price,
            cashPart: cashFinal,
            kaspiPart: kaspiFinal,
            note: `${deviceLabel} · ${baseName}`,
            userId: user.id,
            sessionId: created.id,
          },
        });
      }
      return created;
    });

    return NextResponse.json({
      session,
      discount: applied.discount > 0 ? { label: discountLabel, amount: applied.discount } : null,
    });
  } catch (e) {
    console.error("POST /api/sessions error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
