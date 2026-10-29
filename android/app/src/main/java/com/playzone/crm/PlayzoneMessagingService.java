package com.playzone.crm;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Получает FCM-сообщения от нашего сервера (через Google) и показывает
 * системное уведомление. Срабатывает даже когда приложение убито из
 * памяти — Google будит сервис, потому что сообщение high-priority.
 */
public class PlayzoneMessagingService extends FirebaseMessagingService {

    @Override
    public void onMessageReceived(RemoteMessage message) {
        if (message.getData() == null || message.getData().isEmpty()) {
            return;
        }
        String title = message.getData().get("title");
        String body = message.getData().get("body");
        String tag = message.getData().get("tag");
        if (title == null || title.isEmpty()) title = "PlayZone";
        if (body == null) body = "";

        PlayzoneNotifications.ensureChannel(this);

        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            b = new Notification.Builder(this, PlayzoneNotifications.CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
            b.setPriority(Notification.PRIORITY_HIGH);
        }
        b.setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pi);

        NotificationManager nm =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (tag != null && !tag.isEmpty()) {
            nm.notify(tag, 0, b.build()); // один сеанс = одно уведомление (заменяется)
        } else {
            nm.notify(0, b.build());
        }
    }

    @Override
    public void onNewToken(String token) {
        // Firebase иногда обновляет токен — сообщаем серверу
        ApiClient.registerFcmToken(token, "android");
    }
}
