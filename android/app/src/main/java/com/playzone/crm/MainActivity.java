package com.playzone.crm;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Нативная оболочка PlayZone: показывает CRM (сайт) и включает уведомления
 * через Firebase. При первом запуске Android сам показывает стандартный
 * системный запрос «Разрешить уведомления?» — как у обычных приложений.
 */
public class MainActivity extends Activity {

    private static final String START_URL = "https://psteztez.vercel.app/";
    private static final int REQ_NOTIFICATIONS = 1001;

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        PlayzoneNotifications.ensureChannel(this);

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        // Метка внутри User-Agent: сайт понимает, что открыт нативный APK,
        // и не предлагает кнопку веб-push подписки
        s.setUserAgentString(s.getUserAgentString() + " PlayZoneNative/1.0");
        webView.setBackgroundColor(0xFF0B0B0F);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl().toString());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(url);
            }

            private boolean handleUrl(String url) {
                if (url.startsWith("https://psteztez.vercel.app")) {
                    return false; // наш сайт — открываем внутри приложения
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) {
                }
                return true; // внешние ссылки — системный браузер
            }
        });

        setContentView(webView);

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(START_URL);
        }

        requestNotificationPermission();
        registerFcmToken();
    }

    /** Стандартный системный запрос уведомлений (Android 13+). */
    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    REQ_NOTIFICATIONS);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions,
            int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_NOTIFICATIONS && grantResults.length > 0
                && grantResults[0] != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this,
                    "Уведомления выключены — «время вышло» не придёт. Включить: Настройки → Приложения → PlayZone → Уведомления",
                    Toast.LENGTH_LONG).show();
        }
    }

    /** Отправить FCM-токен на наш сервер (какое устройство подписывать). */
    private void registerFcmToken() {
        try {
            FirebaseMessaging.getInstance().getToken().addOnSuccessListener(
                    token -> ApiClient.registerFcmToken(token, "android"));
        } catch (Exception e) {
            // Firebase не настроен (нет google-services.json) — CRM всё равно работает
            Toast.makeText(this,
                    "Push не настроен: нужен google-services.json в Firebase-проекте",
                    Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }
}
