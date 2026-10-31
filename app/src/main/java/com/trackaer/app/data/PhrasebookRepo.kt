package com.trackaer.app.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

internal val Context.localStore by preferencesDataStore(name = "local_json")

/** Разговорник: готовые ситуации из assets + свои ситуации (в локальном хранилище). */
object PhrasebookRepo {

    data class PbLine(val role: Int, val ru: String, val en: String)
    data class PbSituation(val id: String, val name: String, val roles: List<String>, val lines: List<PbLine>, val preset: Boolean)

    private val KEY_USER_SITS = stringPreferencesKey("phrasebook_sits")

    fun loadPresets(ctx: Context): List<PbSituation> = try {
        val json = ctx.assets.open("phrasebook.json").bufferedReader().use { it.readText() }
        val arr = JSONObject(json).optJSONArray("presets") ?: JSONArray()
        (0 until arr.length()).mapNotNull { i ->
            val o = arr.optJSONObject(i) ?: return@mapNotNull null
            val roles = ArrayList<String>()
            val rArr = o.optJSONArray("roles") ?: JSONArray()
            for (r in 0 until rArr.length()) roles.add(rArr.optString(r))
            val lines = ArrayList<PbLine>()
            val lArr = o.optJSONArray("lines") ?: JSONArray()
            for (l in 0 until lArr.length()) {
                val la = lArr.optJSONArray(l) ?: continue
                lines.add(PbLine(la.optInt(0), la.optString(1), la.optString(2)))
            }
            PbSituation("preset_$i", o.optString("name"), roles, lines, preset = true)
        }
    } catch (e: Exception) { emptyList() }

    /** id — "user_<timestamp>". */
    fun userSitsFlow(ctx: Context): Flow<List<PbSituation>> = ctx.localStore.data.map { p ->
        parseUser(p[KEY_USER_SITS] ?: "[]")
    }

    fun parseUser(json: String): List<PbSituation> = try {
        val arr = JSONArray(json)
        (0 until arr.length()).mapNotNull { i ->
            val o = arr.optJSONObject(i) ?: return@mapNotNull null
            val roles = ArrayList<String>()
            val rArr = o.optJSONArray("roles") ?: JSONArray()
            for (r in 0 until rArr.length()) roles.add(rArr.optString(r))
            val lines = ArrayList<PbLine>()
            val lArr = o.optJSONArray("lines") ?: JSONArray()
            for (l in 0 until lArr.length()) {
                val la = lArr.optJSONArray(l) ?: continue
                lines.add(PbLine(la.optInt(0), la.optString(1), la.optString(2)))
            }
            PbSituation(o.optString("id"), o.optString("name"), roles, lines, preset = false)
        }
    } catch (e: Exception) { emptyList() }

    suspend fun saveUserSits(ctx: Context, sits: List<PbSituation>) = withContext(Dispatchers.IO) {
        val arr = JSONArray()
        sits.forEach { s ->
            val roles = JSONArray(); s.roles.forEach { roles.put(it) }
            val lines = JSONArray()
            s.lines.forEach { l -> lines.put(JSONArray().put(l.role).put(l.ru).put(l.en)) }
            arr.put(JSONObject().put("id", s.id).put("name", s.name).put("roles", roles).put("lines", lines))
        }
        ctx.localStore.edit { it[KEY_USER_SITS] = arr.toString() }
    }

    suspend fun userSits(ctx: Context): List<PbSituation> =
        parseUser(ctx.localStore.data.first()[KEY_USER_SITS] ?: "[]")
}
