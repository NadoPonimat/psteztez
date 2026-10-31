package com.playzone.crm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build

/**
 * Каналы уведомлений:
 *  - CHANNEL_ID («Время вышло») — FCM-push от сервера, обычный звук уведомления;
 *  - CHANNEL_ALARM («Будильник сеанса») — локальный будильник AlarmManager
 *    со звуком будильника, как у штатного приложения «Часы».
 * Создаются один раз; пользователь может настроить их в настройках Android.
 */
object PlayzoneNotifications {
    const val CHANNEL_ID = "playzone_sessions"
    const val CHANNEL_ALARM = "playzone_alarms"

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                ?: return

        if (nm.getNotificationChannel(CHANNEL_ID) == null) {
            val ch = NotificationChannel(
                CHANNEL_ID,
                "Время вышло",
                NotificationManager.IMPORTANCE_HIGH
            )
            ch.description = "Уведомления о конце сеансов"
            ch.setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                audioAttributes(AudioAttributes.USAGE_NOTIFICATION)
            )
            ch.enableVibration(true)
            nm.createNotificationChannel(ch)
        }

        if (nm.getNotificationChannel(CHANNEL_ALARM) == null) {
            val ch = NotificationChannel(
                CHANNEL_ALARM,
                "Будильник сеанса",
                NotificationManager.IMPORTANCE_HIGH
            )
            ch.description = "Звонок в конце оплаченного времени — как будильник"
            ch.setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                audioAttributes(AudioAttributes.USAGE_ALARM)
            )
            ch.enableVibration(true)
            nm.createNotificationChannel(ch)
        }
    }

    private fun audioAttributes(usage: Int): AudioAttributes =
        AudioAttributes.Builder()
            .setUsage(usage)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
}
