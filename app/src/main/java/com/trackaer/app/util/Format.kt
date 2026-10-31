package com.trackaer.app.util

import java.text.DecimalFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

object Fmt {

    private val ru = Locale("ru")
    private val whole = DecimalFormat("#,##0")

    /** 1250000 -> "12 500 ₸" (минорные единицы -> строка) */
    fun money(minor: Long, currency: String): String {
        val neg = minor < 0
        val v = if (neg) -minor else minor
        val w = whole.format(v / 100).replace(',', ' ')
        val frac = v % 100
        val tail = if (frac > 0) "." + String.format("%02d", frac) else ""
        return (if (neg) "−" else "") + w + tail + " " + currency
    }

    /** "12500" / "12 500,50" -> минорные единицы, null если не число */
    fun parseAmount(s: String): Long? {
        val clean = s.replace(" ", "").replace("\u00A0", "").replace(",", ".")
        val d = clean.toDoubleOrNull() ?: return null
        if (d < 0) return null
        return Math.round(d * 100)
    }

    fun dayShort(epochDay: Long): String =
        LocalDate.ofEpochDay(epochDay).format(DateTimeFormatter.ofPattern("d MMM", ru))

    fun dayFull(epochDay: Long): String {
        val s = LocalDate.ofEpochDay(epochDay).format(DateTimeFormatter.ofPattern("EEEE, d MMMM", ru))
        return s.replaceFirstChar { it.uppercase(ru) }
    }
}
