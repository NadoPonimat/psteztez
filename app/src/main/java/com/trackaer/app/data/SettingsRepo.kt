package com.trackaer.app.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "settings")

data class AppSettings(
    val kcalTarget: Int = 2200,
    val currency: String = "₸",
    val remindEnabled: Boolean = false,
    val remindHour: Int = 20,
    val remindMinute: Int = 0,
    /** Длительность анимации входа в миллисекундах; 0 — без анимации. */
    val splashMillis: Int = 2500,
    /** Вариант анимации: radar, pulse, scan, horns, hearing, flash, lightning, rain, crack, none. */
    val splashAnim: String = "radar",
    /** Показывать название и подпись на заставке. */
    val splashShowTitle: Boolean = true
)

class SettingsRepo(private val context: Context) {

    val settings: Flow<AppSettings> = context.dataStore.data.map { p ->
        AppSettings(
            kcalTarget = p[KEY_KCAL] ?: 2200,
            currency = p[KEY_CURRENCY] ?: "₸",
            remindEnabled = p[KEY_REMIND_ON] ?: false,
            remindHour = p[KEY_REMIND_H] ?: 20,
            remindMinute = p[KEY_REMIND_M] ?: 0,
            splashMillis = p[KEY_SPLASH] ?: 2500,
            splashAnim = p[KEY_SPLASH_ANIM] ?: "radar",
            splashShowTitle = p[KEY_SPLASH_TITLE] ?: true
        )
    }

    suspend fun setKcalTarget(v: Int) = context.dataStore.edit {
        it[KEY_KCAL] = v.coerceIn(800, 6000)
    }

    suspend fun setCurrency(v: String) = context.dataStore.edit {
        it[KEY_CURRENCY] = v
    }

    suspend fun setReminder(enabled: Boolean, hour: Int, minute: Int) = context.dataStore.edit {
        it[KEY_REMIND_ON] = enabled
        it[KEY_REMIND_H] = hour
        it[KEY_REMIND_M] = minute
    }

    /** v — длительность анимации входа в миллисекундах (0..15000). */
    suspend fun setSplashMillis(v: Int) = context.dataStore.edit {
        it[KEY_SPLASH] = v.coerceIn(0, 15000)
    }

    suspend fun setSplashAnim(v: String) = context.dataStore.edit {
        it[KEY_SPLASH_ANIM] = v
    }

    suspend fun setSplashShowTitle(v: Boolean) = context.dataStore.edit {
        it[KEY_SPLASH_TITLE] = v
    }

    private companion object {
        val KEY_KCAL = intPreferencesKey("kcal_target")
        val KEY_CURRENCY = stringPreferencesKey("currency")
        val KEY_REMIND_ON = booleanPreferencesKey("remind_enabled")
        val KEY_REMIND_H = intPreferencesKey("remind_hour")
        val KEY_REMIND_M = intPreferencesKey("remind_minute")
        val KEY_SPLASH = intPreferencesKey("splash_millis")
        val KEY_SPLASH_ANIM = stringPreferencesKey("splash_anim")
        val KEY_SPLASH_TITLE = booleanPreferencesKey("splash_title")
    }
}
