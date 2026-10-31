package com.trackaer.app.util

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

/** Озвучка фраз и слов (как ▶ в старой версии). Один экземпляр на всё приложение. */
object Tts {

    private var tts: TextToSpeech? = null
    private var ready = false
    private var pending: (() -> Unit)? = null

    fun speak(context: Context, text: String, lang: String = "en-US") {
        val t = text.trim()
        if (t.isEmpty()) return
        val engine = tts ?: TextToSpeech(context.applicationContext) { status ->
            ready = status == TextToSpeech.SUCCESS
            val p = pending
            pending = null
            if (ready && p != null) p()
        }.also { tts = it }
        if (!ready) { pending = { speak(context, text, lang) }; return }
        try {
            val loc = when (lang.take(2).lowercase()) {
                "ru" -> Locale("ru", "RU")
                "es" -> Locale("es", "ES")
                "ar" -> Locale("ar")
                "kz", "kk" -> Locale("kk")
                else -> Locale.US
            }
            val res = engine.setLanguage(loc)
            val useLang = if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) Locale.US else loc
            engine.language = useLang
            engine.setSpeechRate(0.95f)
            engine.speak(t, TextToSpeech.QUEUE_FLUSH, null, "trackaer_$t")
        } catch (_: Exception) { }
    }

    fun stop() {
        try { tts?.stop() } catch (_: Exception) { }
    }
}
