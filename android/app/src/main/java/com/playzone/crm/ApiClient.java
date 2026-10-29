package com.playzone.crm;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Простой клиент к нашему серверу: регистрация FCM-токена. */
public class ApiClient {
    private static final String BASE = "https://psteztez.vercel.app";

    /** POST /api/push/register-fcm — сообщить серверу токен этого телефона. */
    public static void registerFcmToken(String token, String label) {
        Thread t = new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection)
                        new URL(BASE + "/api/push/register-fcm").openConnection();
                c.setRequestMethod("POST");
                c.setRequestProperty("Content-Type", "application/json");
                c.setDoOutput(true);
                c.setConnectTimeout(10000);
                c.setReadTimeout(10000);
                String json = "{\"token\":\"" + token + "\",\"label\":\"" + label + "\"}";
                try (OutputStream os = c.getOutputStream()) {
                    os.write(json.getBytes(StandardCharsets.UTF_8));
                }
                c.getResponseCode(); // статус достаточно: токен сохранён на сервере
                c.disconnect();
            } catch (Exception ignored) {
                // сеть недоступна — токен отправится при следующем запуске
            }
        });
        t.setPriority(Thread.MIN_PRIORITY);
        t.start();
    }
}
