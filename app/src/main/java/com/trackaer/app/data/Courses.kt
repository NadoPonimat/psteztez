package com.trackaer.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Секция урока. kind: para | part | practice | cheatsheet | selfcheck */
data class CSection(
    val kind: String,
    val heading: String?,
    val text: String?,
    val items: List<String>
)

data class CLesson(
    val id: String,
    val title: String,
    val minutes: Int,
    val intro: String,
    val sections: List<CSection>
)

data class CModule(
    val id: String,
    val title: String,
    val summary: String,
    val lessons: List<CLesson>
)

data class Course(
    val id: String,
    val title: String,
    val tagline: String,
    val emoji: String,
    val level: String,
    val category: String,
    val estimatedHours: Int,
    val about: String,
    val modules: List<CModule>
) {
    val lessonCount: Int get() = modules.sumOf { it.lessons.size }
}

object CourseRegistry {
    @Volatile
    private var cached: List<Course>? = null

    fun get(context: Context): List<Course> {
        val local = cached
        if (local != null) return local
        synchronized(this) {
            if (cached == null) {
                cached = runCatching {
                    CourseLoader.loadAll(context.applicationContext)
                }.getOrDefault(emptyList())
            }
            return cached!!
        }
    }
}

private object CourseLoader {

    fun loadAll(context: Context): List<Course> {
        val am = context.assets
        val names = am.list("courses")?.filter { it.endsWith(".json") } ?: emptyList()
        val out = ArrayList<Course>(names.size)
        for (name in names) {
            try {
                val text = am.open("courses/$name").bufferedReader().use { it.readText() }
                out += parseCourse(JSONObject(text))
            } catch (_: Exception) {
                // битый файл курса не должен ронять приложение
            }
        }
        return out.sortedWith(compareBy({ it.category }, { it.title }))
    }

    private fun sections(arr: JSONArray?): List<CSection> {
        if (arr == null) return emptyList()
        val list = ArrayList<CSection>(arr.length())
        for (i in 0 until arr.length()) {
            val s = arr.optJSONObject(i) ?: continue
            val items = ArrayList<String>()
            val ia = s.optJSONArray("items")
            if (ia != null) {
                for (j in 0 until ia.length()) items += ia.optString(j)
            }
            list += CSection(
                kind = s.optString("kind", "para"),
                heading = if (s.has("heading")) s.optString("heading") else null,
                text = if (s.has("text")) s.optString("text") else null,
                items = items
            )
        }
        return list
    }

    private fun parseCourse(o: JSONObject): Course {
        val modulesArr = o.optJSONArray("modules") ?: JSONArray()
        val modules = ArrayList<CModule>(modulesArr.length())
        for (i in 0 until modulesArr.length()) {
            val m = modulesArr.optJSONObject(i) ?: continue
            val lessonsArr = m.optJSONArray("lessons") ?: JSONArray()
            val lessons = ArrayList<CLesson>(lessonsArr.length())
            for (j in 0 until lessonsArr.length()) {
                val l = lessonsArr.optJSONObject(j) ?: continue
                lessons += CLesson(
                    id = l.getString("id"),
                    title = l.getString("title"),
                    minutes = l.optInt("minutes", 50),
                    intro = l.optString("intro", ""),
                    sections = sections(l.optJSONArray("sections"))
                )
            }
            modules += CModule(
                id = m.getString("id"),
                title = m.getString("title"),
                summary = m.optString("summary", ""),
                lessons = lessons
            )
        }
        return Course(
            id = o.getString("id"),
            title = o.getString("title"),
            tagline = o.optString("tagline", ""),
            emoji = o.optString("emoji", "📘"),
            level = o.optString("level", ""),
            category = o.optString("category", ""),
            estimatedHours = o.optInt("estimatedHours", 0),
            about = o.optString("about", ""),
            modules = modules
        )
    }
}
