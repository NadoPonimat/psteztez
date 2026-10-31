package com.trackaer.app.data.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        HabitEntity::class,
        HabitRecordEntity::class,
        TxEntity::class,
        JarEntity::class,
        DebtEntity::class,
        WorkoutEntity::class,
        StudyEntity::class,
        BookEntity::class,
        VocabEntity::class,
        FoodEntity::class,
        CourseProgressEntity::class,
        PersonEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun habitsDao(): HabitsDao
    abstract fun financeDao(): FinanceDao
    abstract fun jarsDao(): JarsDao
    abstract fun debtsDao(): DebtsDao
    abstract fun workoutsDao(): WorkoutsDao
    abstract fun studyDao(): StudyDao
    abstract fun booksDao(): BooksDao
    abstract fun vocabDao(): VocabDao
    abstract fun foodDao(): FoodDao
    abstract fun courseProgressDao(): CourseProgressDao
    abstract fun peopleDao(): PeopleDao

    companion object {
        /** v1 → v2: таблица «Люди» + поля файлов книг. Данные не теряются. */
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS people (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "name TEXT NOT NULL, " +
                        "phone TEXT NOT NULL DEFAULT '', " +
                        "work TEXT NOT NULL DEFAULT '', " +
                        "schedule TEXT NOT NULL DEFAULT '', " +
                        "attitude TEXT NOT NULL DEFAULT 'нейтрально', " +
                        "attitudeNote TEXT NOT NULL DEFAULT '', " +
                        "notes TEXT NOT NULL DEFAULT '', " +
                        "hobbiesJson TEXT NOT NULL DEFAULT '[]', " +
                        "actionsJson TEXT NOT NULL DEFAULT '[]', " +
                        "createdAt INTEGER NOT NULL DEFAULT 0)"
                )
                db.execSQL("ALTER TABLE books ADD COLUMN filePath TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE books ADD COLUMN format TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE books ADD COLUMN series TEXT NOT NULL DEFAULT ''")
            }
        }
    }
}
