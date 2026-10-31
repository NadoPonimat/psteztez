package com.playzone.crm

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Принимает срабатывание будильника от AlarmManager и показывает системное
 * уведомление со звуком будильника. Работает даже когда приложение убито
 * из памяти: Android сам будит приёмник в назначенное время.
 */
class AlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_FIRE) return
        val title = intent.getStringExtra("title") ?: "⏰ Время вышло!"
        val body = intent.getStringExtra("body") ?: ""
        val tag = intent.getStringExtra("tag") ?: ""

        PlayzoneNotifications.ensureChannels(context)

        val open = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentIntent = PendingIntent.getActivity(
            context,
            0,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        @Suppress("DEPRECATION")
        val builder: Notification.Builder =
            if (Build.VERSION.SDK_INT >= 26) {
                Notification.Builder(context, PlayzoneNotifications.CHANNEL_ALARM)
            } else {
                Notification.Builder(context).setPriority(Notification.PRIORITY_HIGH)
            }

        builder.setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setCategory(Notification.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            // Открыть приложение на весь экран поверх блокировки, как будильник
            .setFullScreenIntent(contentIntent, true)
            .setVisibility(Notification.VISIBILITY_PUBLIC)

        val nm =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                ?: return
        val notification = builder.build()
        // Звук повторяется, пока уведомление не закрыли (как у будильника)
        notification.flags = notification.flags or Notification.FLAG_INSISTENT
        if (tag.isNotEmpty()) {
            // тот же tag, что у FCM: кто первый сработал — тот и покажет,
            // второе уведомление заменит первое, дубликата не будет
            nm.notify(tag, 0, notification)
        } else {
            nm.notify(0, notification)
        }
    }

    companion object {
        const val ACTION_FIRE = "com.playzone.crm.ALARM_FIRE"
    }
}
