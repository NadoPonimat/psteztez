package com.trackaer.app.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject

/** План занятий на день: предметы с нормой минут в день (как «План занятий» в старой версии). */
object StudyPlanStore {

    data class PlanItem(val subject: String, val minutes: Int)

    private val KEY = stringPreferencesKey("study_plan")

    fun flow(ctx: Context): Flow<List<PlanItem>> = ctx.localStore.data.map { p -> parse(p[KEY] ?: "[]") }

    fun parse(json: String): List<PlanItem> = try {
        val arr = JSONArray(json)
        (0 until arr.length()).mapNotNull { i ->
            val o = arr.optJSONObject(i) ?: return@mapNotNull null
            val s = o.optString("subject").trim()
            if (s.isEmpty()) null else PlanItem(s, o.optInt("minutes", 30).coerceIn(5, 600))
        }
    } catch (e: Exception) { emptyList() }

    suspend fun save(ctx: Context, plan: List<PlanItem>) {
        val arr = JSONArray()
        plan.forEach { arr.put(JSONObject().put("subject", it.subject).put("minutes", it.minutes)) }
        ctx.localStore.edit { it[KEY] = arr.toString() }
    }
}
