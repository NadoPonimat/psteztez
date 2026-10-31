package com.playzone.crm

import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

/** Простой клиент к нашему серверу: регистрация FCM-токена. */
object ApiClient {
    private const val BASE = "https://psteztez.vercel.app"

    /** POST /api/push/register-fcm — сообщить серверу токен этого телефона. */
    fun registerFcmToken(token: String, label: String) {
        Thread {
            try {
                val conn =
                    URL("$BASE/api/push/register-fcm").openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.connectTimeout = 10_000
                conn.readTimeout = 10_000
                val json = "{\"token\":\"$token\",\"label\":\"$label\"}"
                conn.outputStream.use { it.write(json.toByteArray(StandardCharsets.UTF_8)) }
                conn.responseCode // статус достаточно: токен сохранён на сервере
                conn.disconnect()
            } catch (_: Exception) {
                // сеть недоступна — токен отправится при следующем запуске
            }
        }.apply {
            priority = Thread.MIN_PRIORITY
            start()
        }
    }
}
