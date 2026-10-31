package com.playzone.crm

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONArray

/**
 * Нативная оболочка PlayZone (Kotlin): показывает CRM (сайт) и отвечает за
 * уведомления. При первом запуске Android сам показывает стандартный
 * системный запрос «Разрешить уведомления?» — как у обычных приложений.
 *
 * Внутрь страницы проброшен мост window.PlayZoneNative: сайт отдаёт оболочке
 * список активных сеансов, и Android ставит их в системный будильник
 * (AlarmManager.setAlarmClock) — тот же механизм, что у штатного «Часов».
 * Будильник срабатывает в точное время, даже если приложение убито из
 * памяти, без интернета и без Firebase.
 */
class MainActivity : Activity() {

    private var webView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        PlayzoneNotifications.ensureChannels(this)

        // Когда будильник открывает приложение — показываем его поверх
        // экрана блокировки и включаем экран
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }

        val web = WebView(this)
        webView = web
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            // Метка внутри User-Agent: сайт понимает, что открыт нативный APK,
            // и не предлагает кнопку веб-push подписки
            userAgentString = "$userAgentString PlayZoneNative/1.0"
        }
        web.setBackgroundColor(0xFF0B0B0F.toInt())
        web.addJavascriptInterface(NativeBridge(), "PlayZoneNative")

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean = handleUrl(request.url.toString())

            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean =
                handleUrl(url)

            // Сайт недоступен (нет интернета / сервер лежит) — показываем
            // понятный экран с кнопкой «Повторить» вместо пустой страницы
            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (request.isForMainFrame) showErrorPage(view)
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                errorResponse: WebResourceResponse
            ) {
                if (request.isForMainFrame && errorResponse.statusCode >= 400) {
                    showErrorPage(view)
                }
            }

            private fun handleUrl(url: String): Boolean {
                if (url.startsWith(START_URL_PREFIX)) return false // наш сайт — внутри приложения
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                } catch (_: Exception) {
                }
                return true // внешние ссылки — системный браузер
            }
        }

        setContentView(web)

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState)
        } else {
            web.loadUrl(START_URL)
        }

        requestNotificationPermission()
        registerFcmToken()
    }

    /** Экран «сайт недоступен» — вместо белой страницы при ошибке сети. */
    private fun showErrorPage(view: WebView) {
        val html = """<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{background:#0b0b0f;color:#e5e5e5;font-family:sans-serif;margin:0;height:100vh;display:flex;align-items:center;justify-content:center;text-align:center}
.box{padding:24px;max-width:340px}
h1{font-size:22px;margin:0 0 10px}
p{color:#9ca3af;font-size:15px;line-height:1.55;margin:0 0 26px}
button{background:#6366f1;color:#fff;border:none;border-radius:12px;padding:14px 36px;font-size:16px}
</style></head><body><div class="box">
<h1>Нет связи с сайтом</h1>
<p>PlayZone CRM временно недоступна. Проверьте интернет и попробуйте ещё раз. Уже поставленные будильники сеансов продолжат работать.</p>
<button onclick="location.href='$START_URL'">Повторить</button>
</div></body></html>"""
        view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
    }

    /** Стандартный системный запрос уведомлений (Android 13+). */
    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                REQ_NOTIFICATIONS
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_NOTIFICATIONS && grantResults.isNotEmpty() &&
            grantResults[0] != PackageManager.PERMISSION_GRANTED
        ) {
            Toast.makeText(
                this,
                "Уведомления выключены — «время вышло» не придёт. Включить: Настройки → Приложения → PlayZone → Уведомления",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    /** Отправить FCM-токен на наш сервер (какое устройство подписывать). */
    private fun registerFcmToken() {
        try {
            FirebaseMessaging.getInstance().getToken()
                .addOnSuccessListener { token ->
                    ApiClient.registerFcmToken(token, "android")
                }
        } catch (_: Exception) {
            // Firebase не настроен (нет google-services.json) — CRM всё равно работает
            Toast.makeText(
                this,
                "Push не настроен: нужен google-services.json в Firebase-проекте",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    override fun onBackPressed() {
        val web = webView
        if (web != null && web.canGoBack()) {
            web.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView?.saveState(outState)
    }

    /**
     * Мост «сайт → Android». Страница CRM вызывает syncAlarms при каждом
     * обновлении данных (раз в 10 секунд): активные сеансы превращаются
     * в системные будильники, завершённые/продлённые — отменяются.
     */
    inner class NativeBridge {
        @JavascriptInterface
        fun syncAlarms(json: String?) {
            try {
                val array = JSONArray(json ?: "[]")
                val items = ArrayList<AlarmScheduler.AlarmItem>(array.length())
                for (i in 0 until array.length()) {
                    val o = array.getJSONObject(i)
                    items.add(
                        AlarmScheduler.AlarmItem(
                            id = o.getInt("id"),
                            triggerAt = o.getLong("endAt"),
                            title = o.optString("title", "⏰ Время вышло!"),
                            body = o.optString("body", ""),
                            tag = o.optString("tag", "")
                        )
                    )
                }
                val set = AlarmScheduler.replaceAll(applicationContext, items)
                if (set >= 0) {
                    runOnUiThread {
                        Toast.makeText(
                            this@MainActivity,
                            if (set > 0) "⏰ Будильников поставлено: $set" else "⏰ Будильники сняты",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            } catch (_: Exception) {
                // кривой json — ждём следующей синхронизации (раз в 10 секунд)
            }
        }
    }

    companion object {
        private const val START_URL = "file:///android_asset/index.html"
        private const val START_URL_PREFIX = "file:///android_asset"
        private const val REQ_NOTIFICATIONS = 1001
    }
}
