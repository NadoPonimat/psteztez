package com.playzone.crm

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Получает FCM-сообщения от нашего сервера (через Google) и показывает
 * системное уведомление. Срабатывает даже когда приложение убито из
 * памяти — Google будит сервис, потому что сообщение high-priority.
 *
 * Это запасной канал: основной — локальный будильник (AlarmScheduler),
 * который не зависит ни от интернета, ни от Firebase.
 */
class PlayzoneMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        if (data.isEmpty()) return
        val title = data["title"]?.takeIf { it.isNotEmpty() } ?: "PlayZone"
        val body = data["body"] ?: ""
        val tag = data["tag"] ?: ""

        PlayzoneNotifications.ensureChannels(this)

        val open = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentIntent = PendingIntent.getActivity(
            this, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        @Suppress("DEPRECATION")
        val builder: Notification.Builder =
            if (Build.VERSION.SDK_INT >= 26) {
                Notification.Builder(this, PlayzoneNotifications.CHANNEL_ID)
            } else {
                Notification.Builder(this).setPriority(Notification.PRIORITY_HIGH)
            }

        builder.setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(contentIntent)

        val nm = getSystemService(NOTIFICATION_SERVICE) as? NotificationManager ?: return
        if (tag.isNotEmpty()) {
            nm.notify(tag, 0, builder.build()) // один сеанс = одно уведомление (заменяется)
        } else {
            nm.notify(0, builder.build())
        }
    }

    override fun onNewToken(token: String) {
        // Firebase иногда обновляет токен — сообщаем серверу
        ApiClient.registerFcmToken(token, "android")
    }
}
