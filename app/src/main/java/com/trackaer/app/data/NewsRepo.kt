package com.trackaer.app.data

import android.content.Context
import android.util.Xml
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import org.xmlpull.v1.XmlPullParser
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** Живые RSS-ленты, как в старой версии: источники по языкам, кэш 15 минут. */
object NewsRepo {

    data class NewsItem(val source: String, val title: String, val link: String, val date: String)
    data class NewsFeed(val items: List<NewsItem>, val fetchedAt: Long, val failed: List<String>)

    data class Source(val name: String, val rss: String)

    val LANGS = listOf("ru", "en", "ar", "es")
    val LANG_TITLES = mapOf("ru" to "Русский", "en" to "English", "ar" to "العربية", "es" to "Español")

    val SOURCES: Map<String, List<Source>> = mapOf(
        "ru" to listOf(
            Source("Tengrinews", "https://tengrinews.kz/rss/news.rss"),
            Source("Zakon.kz", "https://www.zakon.kz/rss/"),
            Source("ТАСС", "https://tass.ru/rss/v2.xml"),
            Source("РИА Новости", "https://ria.ru/export/rss2/archive/index.xml"),
            Source("Коммерсантъ", "https://www.kommersant.ru/RSS/news.xml")
        ),
        "en" to listOf(
            Source("BBC News", "https://feeds.bbci.co.uk/news/world/rss.xml"),
            Source("The Guardian", "https://www.theguardian.com/world/rss")
        ),
        "ar" to listOf(
            Source("BBC Arabic", "https://feeds.bbci.co.uk/arabic/rss.xml"),
            Source("Al Jazeera", "https://www.aljazeera.net/xml/rss/all.xml")
        ),
        "es" to listOf(
            Source("BBC Mundo", "https://feeds.bbci.co.uk/mundo/rss.xml"),
            Source("CNN en Español", "https://cnnespanol.cnn.com/feed/")
        )
    )

    private const val CACHE_MS = 15 * 60 * 1000L

    private fun cacheFile(ctx: Context, lang: String) = File(ctx.filesDir, "news_$lang.json")

    /** Свежий кэш из файла, если он моложе 15 минут (или любой — для показа без сети). */
    fun cached(ctx: Context, lang: String): NewsFeed? {
        val f = cacheFile(ctx, lang)
        if (!f.exists()) return null
        return try {
            val o = JSONObject(f.readText())
            val items = ArrayList<NewsItem>()
            val arr = o.optJSONArray("items") ?: JSONArray()
            for (i in 0 until arr.length()) {
                val it = arr.getJSONObject(i)
                items.add(NewsItem(it.optString("source"), it.optString("title"), it.optString("link"), it.optString("date")))
            }
            NewsFeed(items, o.optLong("fetchedAt"), emptyList())
        } catch (e: Exception) { null }
    }

    suspend fun fetch(ctx: Context, lang: String, force: Boolean): NewsFeed = withContext(Dispatchers.IO) {
        val cached = cached(ctx, lang)
        if (!force && cached != null && System.currentTimeMillis() - cached.fetchedAt < CACHE_MS) {
            return@withContext cached
        }
        val all = ArrayList<NewsItem>()
        val failed = ArrayList<String>()
        // параллельно не обязательно: источников немного, последовательного запроса с таймаутом хватает
        for (s in SOURCES[lang].orEmpty()) {
            try {
                val xml = httpText(s.rss)
                val items = parseRss(xml, s.name)
                if (items.isEmpty()) throw IllegalStateException("пустая лента")
                all.addAll(items)
            } catch (e: Exception) {
                failed.add(s.name)
            }
        }
        val feed = NewsFeed(all.take(120), System.currentTimeMillis(), failed)
        if (all.isNotEmpty()) {
            try {
                val o = JSONObject()
                o.put("fetchedAt", feed.fetchedAt)
                val arr = JSONArray()
                feed.items.forEach { i ->
                    arr.put(JSONObject().put("source", i.source).put("title", i.title).put("link", i.link).put("date", i.date))
                }
                o.put("items", arr)
                cacheFile(ctx, lang).writeText(o.toString())
            } catch (_: Exception) { }
        }
        // если сеть не дала ничего — отдаём хотя бы старый кэш
        if (all.isEmpty() && cached != null) cached else feed
    }

    private fun httpText(url: String): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 10000
        conn.readTimeout = 10000
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Android) Trackaer/2.1")
        conn.setRequestProperty("Accept", "application/rss+xml, application/xml, text/xml, */*")
        try {
            if (conn.responseCode !in 200..299) throw IllegalStateException("HTTP ${conn.responseCode}")
            return conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    /** RSS 2.0 (channel/item) и Atom (feed/entry). */
    private fun parseRss(xml: String, source: String): List<NewsItem> {
        val out = ArrayList<NewsItem>()
        try {
            val p = Xml.newPullParser()
            p.setInput(xml.reader())
            var event = p.eventType
            var tag = ""
            var title = ""
            var link = ""
            var date = ""
            var inItem = false
            var linkHref = ""
            while (event != XmlPullParser.END_DOCUMENT) {
                when (event) {
                    XmlPullParser.START_TAG -> {
                        tag = p.name
                        if (tag == "item" || tag == "entry") { inItem = true; title = ""; link = ""; date = ""; linkHref = "" }
                        if (tag == "link" && inItem) {
                            for (i in 0 until p.attributeCount) if (p.getAttributeName(i) == "href") linkHref = p.getAttributeValue(i)
                        }
                    }
                    XmlPullParser.TEXT -> {
                        when (tag) {
                            "title" -> if (inItem && title.isEmpty()) title = p.text?.trim() ?: ""
                            "pubDate", "published", "updated" -> if (inItem && date.isEmpty()) date = p.text?.trim() ?: ""
                        }
                    }
                    XmlPullParser.END_TAG -> {
                        if (p.name == "link" && inItem && link.isEmpty()) link = linkHref
                        if (p.name == "item" || p.name == "entry") {
                            inItem = false
                            val l = link.ifBlank { linkHref }
                            if (title.isNotEmpty()) out.add(NewsItem(source, title, l, date))
                        }
                        tag = ""
                    }
                }
                event = p.next()
            }
        } catch (_: Exception) { }
        return out
    }
}
