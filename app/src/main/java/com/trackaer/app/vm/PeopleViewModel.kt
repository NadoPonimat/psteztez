package com.trackaer.app.vm

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.trackaer.app.TrackaerApp
import com.trackaer.app.data.db.PersonEntity
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

data class PersonAction(val date: String, val desc: String, val rating: String)

fun parseHobbies(json: String): List<String> = try {
    val a = JSONArray(json); (0 until a.length()).map { a.optString(it) }
} catch (e: Exception) { emptyList() }

fun parseActions(json: String): List<PersonAction> = try {
    val a = JSONArray(json)
    (0 until a.length()).mapNotNull { i ->
        val o = a.optJSONObject(i) ?: return@mapNotNull null
        PersonAction(o.optString("date"), o.optString("desc"), o.optString("rating", "нейтрально"))
    }.filter { it.desc.isNotBlank() }
} catch (e: Exception) { emptyList() }

fun hobbiesJson(list: List<String>): String {
    val a = JSONArray(); list.filter { it.isNotBlank() }.forEach { a.put(it.trim()) }
    return a.toString()
}

fun actionsJson(list: List<PersonAction>): String {
    val a = JSONArray()
    list.filter { it.desc.isNotBlank() }.forEach {
        a.put(JSONObject().put("date", it.date).put("desc", it.desc).put("rating", it.rating))
    }
    return a.toString()
}

/** Связи двух людей: общие увлечения + одно место работы/учёбы (как peopleSharedItems). */
fun sharedItems(a: PersonEntity, b: PersonEntity): List<String> {
    val out = ArrayList<String>()
    val norm = { s: String -> s.trim().lowercase() }
    val ah = parseHobbies(a.hobbiesJson).map { norm(it) to it }.toMap()
    parseHobbies(b.hobbiesJson).forEach { h ->
        val k = norm(h)
        if (k.isNotBlank() && ah.containsKey(k)) out.add("увлечение: ${ah[k]}")
    }
    if (a.work.isNotBlank() && b.work.isNotBlank() && norm(a.work) == norm(b.work)) {
        out.add("место работы/учёбы: ${a.work}")
    }
    return out
}

class PeopleViewModel(app: Application) : AndroidViewModel(app) {
    private val db = (app as TrackaerApp).db

    val people: StateFlow<List<PersonEntity>> = db.peopleDao().all()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** Число связей у человека — для подписи в списке. */
    val linkCounts: StateFlow<Map<Long, Int>> = people.map { list ->
        val map = HashMap<Long, Int>()
        for (i in list.indices) for (j in i + 1 until list.size) {
            if (sharedItems(list[i], list[j]).isNotEmpty()) {
                map[list[i].id] = (map[list[i].id] ?: 0) + 1
                map[list[j].id] = (map[list[j].id] ?: 0) + 1
            }
        }
        map
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    fun save(p: PersonEntity) {
        if (p.name.isBlank()) return
        viewModelScope.launch {
            if (p.id == 0L) db.peopleDao().add(p.copy(createdAt = System.currentTimeMillis()))
            else db.peopleDao().update(p)
        }
    }

    fun delete(p: PersonEntity) = viewModelScope.launch { db.peopleDao().delete(p) }

    suspend fun get(id: Long): PersonEntity? = db.peopleDao().byId(id)
}
