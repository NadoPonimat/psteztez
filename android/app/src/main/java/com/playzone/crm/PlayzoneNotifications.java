package com.playzone.crm;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

/**
 * Канал уведомлений «Время вышло»: высокий приоритет, звук и вибрация.
 * Создаётся один раз; пользователь может настроить его в настройках Android.
 */
public class PlayzoneNotifications {
    public static final String CHANNEL_ID = "playzone_sessions";

    public static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Время вышло", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Уведомления о конце сеансов");
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        ch.setSound(sound, new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
        ch.enableVibration(true);
        nm.createNotificationChannel(ch);
    }
}
