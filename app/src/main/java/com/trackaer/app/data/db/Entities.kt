package com.trackaer.app.data.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "habits")
data class HabitEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val emoji: String,
    val createdAt: Long,
    val archived: Boolean = false
)

@Entity(
    tableName = "habit_records",
    indices = [Index("habitId"), Index("day")]
)
data class HabitRecordEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val habitId: Long,
    val day: Long,
    val done: Boolean
)

/** Доход/расход. type: "in" | "out". amount — в минорных единицах (тийин/копейки). */
@Entity(tableName = "tx", indices = [Index("day")])
data class TxEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val type: String,
    val amount: Long,
    val category: String,
    val note: String,
    val day: Long,
    val createdAt: Long
)

@Entity(tableName = "jars")
data class JarEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val emoji: String,
    val goal: Long,
    val saved: Long = 0,
    val archived: Boolean = false
)

/** direction: "given" — мне должны, "taken" — я должен. */
@Entity(tableName = "debts", indices = [Index("day")])
data class DebtEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val direction: String,
    val person: String,
    val amount: Long,
    val paid: Long = 0,
    val note: String,
    val day: Long,
    val closed: Boolean = false
)

@Entity(tableName = "workouts", indices = [Index("day")])
data class WorkoutEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val kind: String,
    val minutes: Int,
    val intensity: Int,
    val note: String,
    val day: Long,
    val createdAt: Long
)

@Entity(tableName = "study", indices = [Index("day")])
data class StudyEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val subject: String,
    val minutes: Int,
    val topic: String,
    val day: Long,
    val createdAt: Long
)

/** format: "" — книга добавлена вручную (без файла), "txt"/"fb2"/"pdf" — свой файл. */
@Entity(tableName = "books")
data class BookEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val author: String,
    val pages: Int,
    val read: Int = 0,
    val done: Boolean = false,
    val createdAt: Long,
    val filePath: String = "",
    val format: String = "",
    val series: String = ""
)

/** box — уровень интервального повторения (Лейтнер), dueDay — epoch day следующего показа. */
@Entity(tableName = "vocab")
data class VocabEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val word: String,
    val translation: String,
    val lang: String,
    val box: Int = 1,
    val dueDay: Long,
    val streak: Int = 0,
    val createdAt: Long
)

@Entity(tableName = "food", indices = [Index("day")])
data class FoodEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val meal: String,
    val name: String,
    val kcal: Int,
    val protein: Int,
    val fat: Int,
    val carbs: Int,
    val day: Long,
    val createdAt: Long
)

@Entity(tableName = "course_progress", primaryKeys = ["courseId", "lessonId"])
data class CourseProgressEntity(
    val courseId: String,
    val lessonId: String,
    val completedAt: Long
)

/** Человек из «Людей»: увлечения и поступки — JSON-массивы, как в старой версии. */
@Entity(tableName = "people")
data class PersonEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val phone: String = "",
    val work: String = "",
    val schedule: String = "",
    val attitude: String = "нейтрально",
    val attitudeNote: String = "",
    val notes: String = "",
    val hobbiesJson: String = "[]",
    val actionsJson: String = "[]",
    val createdAt: Long = 0
)
