package com.trackaer.app.data

import android.content.Context
import android.util.Xml
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.xmlpull.v1.XmlPullParser
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate

/** Курсы валют: Нацбанк РК онлайн, запасной — currency-api (jsDelivr). Как в старой версии. */
object RatesRepo {

    val RATE_LIST = listOf("RUB", "USD", "EUR", "CNY", "KGS", "UZS", "TRY", "AED")
    val SYMBOLS = mapOf(
        "KZT" to "₸", "RUB" to "₽", "USD" to "$", "EUR" to "€",
        "CNY" to "¥", "KGS" to "с", "UZS" to "сум", "TRY" to "₺", "AED" to "د.إ"
    )

    /** rate — тенге за 1 единицу валюты. */
    data class Market(
        val src: String,
        val date: String,
        val rates: Map<String, Double>,
        val change: Map<String, Double>,
        val checked: Long
    )

    private const val CACHE_MS = 3 * 3600 * 1000L

    private fun cacheFile(ctx: Context) = File(ctx.filesDir, "rates_cache.json")

    fun cached(ctx: Context): Market? = try {
        val f = cacheFile(ctx)
        if (!f.exists()) null
        else {
            val o = JSONObject(f.readText())
            val rates = HashMap<String, Double>()
            val change = HashMap<String, Double>()
            val rv = o.optJSONObject("rates") ?: JSONObject()
            val cv = o.optJSONObject("change") ?: JSONObject()
            rv.keys().forEach { k -> rates[k] = rv.getDouble(k) }
            cv.keys().forEach { k -> change[k] = cv.getDouble(k) }
            Market(o.optString("src"), o.optString("date"), rates, change, o.optLong("checked"))
        }
    } catch (e: Exception) { null }

    suspend fun fetch(ctx: Context, force: Boolean): Market? = withContext(Dispatchers.IO) {
        val c = cached(ctx)
        if (!force && c != null && System.currentTimeMillis() - c.checked < CACHE_MS) return@withContext c

        val got = try {
            fetchNBK()
        } catch (e: Exception) {
            try { fetchCdn() } catch (e2: Exception) { null }
        } ?: return@withContext c  // без сети остаются последние курсы

        val toSave = got.copy(checked = System.currentTimeMillis())
        try {
            val o = JSONObject()
                .put("src", toSave.src).put("date", toSave.date).put("checked", toSave.checked)
            val rv = JSONObject(); toSave.rates.forEach { (k, v) -> rv.put(k, v) }
            val cv = JSONObject(); toSave.change.forEach { (k, v) -> cv.put(k, v) }
            o.put("rates", rv); o.put("change", cv)
            cacheFile(ctx).writeText(o.toString())
        } catch (_: Exception) { }
        toSave
    }

    private fun httpText(url: String): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Android) Trackaer/2.1")
        try {
            if (conn.responseCode !in 200..299) throw IllegalStateException("HTTP ${conn.responseCode}")
            return conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    /** https://nationalbank.kz/rss/get_rates.cfm?fdate=ДД.ММ.ГГГГ → XML с item'ами. */
    private fun fetchNBK(): Market {
        val d = LocalDate.now().let { "%02d.%02d.%04d".format(it.dayOfMonth, it.monthValue, it.year) }
        val xml = httpText("https://nationalbank.kz/rss/get_rates.cfm?fdate=$d")
        val rates = HashMap<String, Double>()
        val change = HashMap<String, Double>()
        val p = Xml.newPullParser()
        p.setInput(xml.reader())
        var event = p.eventType
        var tag = ""
        var title = ""; var quant = "1"; var desc = ""; var ch = ""
        while (event != XmlPullParser.END_DOCUMENT) {
            when (event) {
                XmlPullParser.START_TAG -> { tag = p.name; if (tag == "item") { title = ""; quant = "1"; desc = ""; ch = "" } }
                XmlPullParser.TEXT -> when (tag) {
                    "title" -> title = p.text?.trim() ?: title
                    "quant" -> quant = p.text?.trim() ?: quant
                    "description" -> desc = p.text?.trim() ?: desc
                    "change" -> ch = p.text?.trim() ?: ch
                }
                XmlPullParser.END_TAG -> if (p.name == "item") {
                    val code = title.uppercase().trim()
                    val q = quant.toDoubleOrNull()?.takeIf { it > 0 } ?: 1.0
                    val v = desc.replace(",", ".").trim().toDoubleOrNull()
                    if (code.length in 3..5 && v != null && v > 0) {
                        rates[code] = v / q
                        ch.replace(",", ".").trim().toDoubleOrNull()?.let { c -> change[code] = c / q }
                    }
                }
            }
            event = p.next()
        }
        if (!rates.containsKey("USD") && !rates.containsKey("RUB")) throw IllegalStateException("пустой ответ Нацбанка")
        val date = Regex("date=\"([^\"]+)\"").find(xml)?.groupValues?.get(1)?.split(".")?.reversed()?.joinToString("-") ?: LocalDate.now().toString()
        return Market("Нацбанк РК", date, rates, change, System.currentTimeMillis())
    }

    /** Запасной источник: fawazahmed0/currency-api на jsDelivr (kzt.json: сколько KZT в 1 единице). */
    private fun fetchCdn(): Market {
        var last: Exception? = null
        for (url in listOf(
            "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/kzt.json",
            "https://latest.currency-api.pages.dev/v1/currencies/kzt.json"
        )) {
            try {
                val j = JSONObject(httpText(url))
                val k = j.optJSONObject("kzt") ?: throw IllegalStateException("нет kzt")
                val rates = HashMap<String, Double>()
                for (c in RATE_LIST) {
                    val x = k.optDouble(c.lowercase(), Double.NaN)
                    if (!x.isNaN() && x > 0) rates[c] = 1.0 / x
                }
                if (rates.isEmpty()) throw IllegalStateException("пустой ответ")
                return Market("currency-api", j.optString("date", LocalDate.now().toString()), rates, emptyMap(), System.currentTimeMillis())
            } catch (e: Exception) { last = e }
        }
        throw last ?: IllegalStateException("нет ответа")
    }
}
