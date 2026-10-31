package com.trackaer.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import androidx.room.Room
import com.trackaer.app.data.SettingsRepo
import com.trackaer.app.data.db.AppDatabase

class TrackaerApp : Application() {

    lateinit var db: AppDatabase
        private set
    lateinit var settings: SettingsRepo
        private set

    override fun onCreate() {
        super.onCreate()
        db = Room.databaseBuilder(this, AppDatabase::class.java, "trackaer.db")
            .addMigrations(AppDatabase.MIGRATION_1_2)
            .fallbackToDestructiveMigration()
            .build()
        settings = SettingsRepo(this)
        val nm = getSystemService(NotificationManager::class.java)
        val ch = NotificationChannel(
            CHANNEL_REMINDERS, "Напоминания", NotificationManager.IMPORTANCE_DEFAULT
        )
        ch.description = "Ежедневные напоминания о занятиях и привычках"
        nm.createNotificationChannel(ch)
    }

    companion object {
        const val CHANNEL_REMINDERS = "reminders"
    }
}
