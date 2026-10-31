package com.playzone.crm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Настоящий системный будильник сеансов — как у приложения «Часы».
 *
 * Используется AlarmManager.setAlarmClock(): тот же механизм, что и у
 * штатного будильника — срабатывает в точное время, выводит телефон из
 * режима Doze, показывает иконку будильника в статус-баре и НЕ требует
 * никаких особых разрешений. Работает даже если приложение убито из
 * памяти, а интернета нет — время задаётся телефоном, а не сервером.
 */
object AlarmScheduler {

    data class AlarmItem(
        val id: Int,
        val triggerAt: Long,
        val title: String,
        val body: String,
        val tag: String
    )

    private const val PREFS = "playzone_alarms"
    private const val KEY = "items"

    /** Будильник ставим только на будущее (запас 5 секунд, чтобы не звонить сразу). */
    private const val MIN_LEAD_MS = 5_000L

    /**
     * Полная замена набора будильников. Сайт вызывает это при каждом
     * обновлении данных: новые сеансы добавляются, завершённые и
     * продлённые — отменяются. Если ничего не изменилось, ничего не делаем.
     */
    fun replaceAll(context: Context, items: List<AlarmItem>): Int {
        val am = alarmManager(context) ?: return -1
        val fresh = items.filter { it.triggerAt > System.currentTimeMillis() + MIN_LEAD_MS }
        val json = toJson(fresh)
        val prefs = prefs(context)
        if (json == prefs.getString(KEY, null)) return -1 // ничего не изменилось

        for (old in fromJson(prefs.getString(KEY, null))) cancelOne(context, am, old)
        for (item in fresh) scheduleOne(context, am, item)
        prefs.edit().putString(KEY, json).apply()
        return fresh.size
    }

    /** После перезагрузки телефона Android стирает все будильники — ставим заново. */
    fun rescheduleAfterBoot(context: Context) {
        val am = alarmManager(context) ?: return
        val items = fromJson(prefs(context).getString(KEY, null))
            .filter { it.triggerAt > System.currentTimeMillis() + MIN_LEAD_MS }
        for (item in items) scheduleOne(context, am, item)
        prefs(context).edit().putString(KEY, toJson(items)).apply()
    }

    private fun scheduleOne(context: Context, am: AlarmManager, item: AlarmItem) {
        val operation = operationIntent(context, item) ?: return
        am.setAlarmClock(
            AlarmManager.AlarmClockInfo(item.triggerAt, openIntent(context)),
            operation
        )
    }

    private fun cancelOne(context: Context, am: AlarmManager, item: AlarmItem) {
        operationIntent(context, item)?.let { am.cancel(it) }
    }

    private fun operationIntent(context: Context, item: AlarmItem): PendingIntent? {
        val intent = Intent(context, AlarmReceiver::class.java)
            .setAction(AlarmReceiver.ACTION_FIRE)
            .putExtra("id", item.id)
            .putExtra("title", item.title)
            .putExtra("body", item.body)
            .putExtra("tag", item.tag)
        return PendingIntent.getBroadcast(
            context,
            item.id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun openIntent(context: Context): PendingIntent {
        val intent = Intent(context, MainActivity::class.java)
        return PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun alarmManager(context: Context): AlarmManager? =
        context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun toJson(items: List<AlarmItem>): String {
        val array = JSONArray()
        for (item in items) {
            array.put(
                JSONObject()
                    .put("id", item.id)
                    .put("triggerAt", item.triggerAt)
                    .put("title", item.title)
                    .put("body", item.body)
                    .put("tag", item.tag)
            )
        }
        return array.toString()
    }

    private fun fromJson(json: String?): List<AlarmItem> {
        if (json.isNullOrEmpty()) return emptyList()
        return try {
            val array = JSONArray(json)
            val items = ArrayList<AlarmItem>(array.length())
            for (i in 0 until array.length()) {
                val o = array.getJSONObject(i)
                items.add(
                    AlarmItem(
                        id = o.getInt("id"),
                        triggerAt = o.getLong("triggerAt"),
                        title = o.optString("title", "⏰ Время вышло!"),
                        body = o.optString("body", ""),
                        tag = o.optString("tag", "")
                    )
                )
            }
            items
        } catch (_: Exception) {
            emptyList()
        }
    }
}
