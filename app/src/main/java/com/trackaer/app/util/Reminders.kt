package com.trackaer.app.util

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkerParameters
import com.trackaer.app.MainActivity
import com.trackaer.app.TrackaerApp
import java.time.Duration
import java.time.LocalDateTime

class ReminderWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val granted = if (Build.VERSION.SDK_INT >= 33) {
            ActivityCompat.checkSelfPermission(
                applicationContext, Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else true
        if (!granted) return Result.success()

        val intent = Intent(applicationContext, MainActivity::class.java)
        val pi = PendingIntent.getActivity(
            applicationContext, 11, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val n = NotificationCompat.Builder(applicationContext, TrackaerApp.CHANNEL_REMINDERS)
            .setSmallIcon(android.R.drawable.ic_menu_my_calendar)
            .setContentTitle("Напоминание Trackaer")
            .setContentText("Отметь привычки, занятие и дела дня 💪")
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(applicationContext).notify(2001, n)
        return Result.success()
    }
}

object ReminderScheduler {

    fun schedule(context: Context, enabled: Boolean, hour: Int, minute: Int) {
        val wm = androidx.work.WorkManager.getInstance(context)
        if (!enabled) {
            wm.cancelUniqueWork("daily_reminder")
            return
        }
        val now = LocalDateTime.now()
        var next = now.toLocalDate().atTime(hour.coerceIn(0, 23), minute.coerceIn(0, 59))
        if (!next.isAfter(now)) next = next.plusDays(1)
        val req = PeriodicWorkRequestBuilder<ReminderWorker>(Duration.ofHours(24))
            .setInitialDelay(Duration.between(now, next))
            .build()
        wm.enqueueUniquePeriodicWork("daily_reminder", ExistingPeriodicWorkPolicy.UPDATE, req)
    }
}
