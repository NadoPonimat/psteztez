package com.trackaer.app.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import org.xmlpull.v1.XmlPullParser
import java.io.File
import java.io.InputStreamReader
import java.nio.charset.Charset

/** Чтение собственных книг: TXT, FB2 и PDF (как читалка старой версии). */
object BookText {

    private fun bookFile(ctx: Context, bookId: Long, format: String): File? {
        if (format.isBlank()) return null
        val f = File(File(ctx.filesDir, "books"), "$bookId.$format")
        return if (f.exists()) f else null
    }

    private fun resolve(ctx: Context, bookId: Long, format: String, filePath: String): File? {
        val f = bookFile(ctx, bookId, format) ?: (if (filePath.isNotBlank()) File(filePath) else null)
        return if (f != null && f.exists()) f else null
    }

    /** Весь текст книги (TXT/FB2), разбитый на страницы по ~3500 символов. */
    fun loadTextPages(ctx: Context, bookId: Long, format: String, filePath: String): List<String>? {
        val raw = readRawText(ctx, bookId, format, filePath) ?: return null
        val clean = raw.replace("\r\n", "\n").replace("\r", "\n").replace("\u00A0", " ")
        val perPage = 3500
        val pages = ArrayList<String>()
        var i = 0
        while (i < clean.length) {
            var end = (i + perPage).coerceAtMost(clean.length)
            if (end < clean.length) {
                val br = clean.lastIndexOf('\n', end)
                if (br > i + perPage / 2) end = br + 1
            }
            pages.add(clean.substring(i, end).trim('\n'))
            i = end
        }
        return pages.ifEmpty { listOf("") }
    }

    private fun readRawText(ctx: Context, bookId: Long, format: String, filePath: String): String? {
        return try {
            val f = resolve(ctx, bookId, format, filePath) ?: return null
            val bytes = f.readBytes()
            val charset = detectCharset(bytes)
            if (format == "fb2") parseFb2(InputStreamReader(bytes.inputStream(), charset))
            else String(bytes, charset)
        } catch (e: Exception) { null }
    }

    /** Грубое определение кодировки: BOM/UTF-8-последовательности → UTF-8, иначе windows-1251. */
    private fun detectCharset(bytes: ByteArray): Charset {
        if (bytes.size >= 3 && (bytes[0].toInt() and 0xFF) == 0xEF && (bytes[1].toInt() and 0xFF) == 0xBB && (bytes[2].toInt() and 0xFF) == 0xBF)
            return Charsets.UTF_8
        var high = 0
        var utf8Seq = 0
        val n = bytes.size.coerceAtMost(8192)
        for (i in 0 until n) {
            val b = bytes[i].toInt() and 0xFF
            if (b > 0x7F) {
                high++
                if (b and 0xC0 == 0x80) utf8Seq++
            }
        }
        return if (high == 0 || utf8Seq > high / 2) Charsets.UTF_8
        else try { Charset.forName("windows-1251") } catch (e: Exception) { Charsets.UTF_8 }
    }

    /** FB2: текст всех <p> из <body>. */
    private fun parseFb2(reader: java.io.Reader): String {
        val sb = StringBuilder()
        try {
            val p = org.xmlpull.v1.XmlPullParserFactory.newInstance().newPullParser()
            p.setInput(reader)
            var event = p.eventType
            var inBody = false
            while (event != XmlPullParser.END_DOCUMENT) {
                when (event) {
                    XmlPullParser.START_TAG -> if (p.name == "body") inBody = true
                    XmlPullParser.TEXT -> if (inBody) sb.append(p.text)
                    XmlPullParser.END_TAG -> when (p.name) {
                        "p", "v" -> if (inBody) sb.append('\n')
                        "body" -> return sb.toString()
                    }
                }
                event = p.next()
            }
        } catch (_: Exception) { }
        return sb.toString()
    }

    /** Число страниц PDF. */
    fun pdfPageCount(ctx: Context, bookId: Long, format: String, filePath: String): Int {
        val f = resolve(ctx, bookId, format, filePath) ?: return 0
        return try {
            PdfRenderer(ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY)).use { it.pageCount }
        } catch (e: Exception) { 0 }
    }

    /** Рендер страницы PDF в Bitmap (масштаб по ширине экрана). */
    fun renderPdfPage(ctx: Context, bookId: Long, format: String, filePath: String, index: Int, targetWidth: Int): Bitmap? {
        val f = resolve(ctx, bookId, format, filePath) ?: return null
        return try {
            PdfRenderer(ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY)).use { r ->
                val page = r.openPage(index)
                val scale = targetWidth.toFloat() / page.width
                val bmp = Bitmap.createBitmap(targetWidth, (page.height * scale).toInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
                page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                page.close()
                bmp
            }
        } catch (e: Exception) { null }
    }

    /** Копирование выбранного файла книги в filesDir/books. Возвращает формат или null. */
    fun importBook(ctx: Context, uri: android.net.Uri, bookId: Long): String? {
        val name = uri.toString().lowercase()
        val fmt = when {
            name.endsWith(".pdf") -> "pdf"
            name.endsWith(".fb2") || name.endsWith(".fb2.zip") -> "fb2"
            name.endsWith(".txt") -> "txt"
            else -> when (ctx.contentResolver.getType(uri)) {
                "application/pdf" -> "pdf"
                else -> "txt"
            }
        }
        return try {
            val dir = File(ctx.filesDir, "books")
            dir.mkdirs()
            ctx.contentResolver.openInputStream(uri)?.use { input ->
                File(dir, "$bookId.$fmt").outputStream().use { output -> input.copyTo(output) }
            } ?: return null
            fmt
        } catch (e: Exception) { null }
    }

    fun deleteBookFile(ctx: Context, bookId: Long, format: String) {
        bookFile(ctx, bookId, format)?.delete()
    }
}
