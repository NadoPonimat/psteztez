package com.trackaer.app.data.db

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface HabitsDao {
    @Query("SELECT * FROM habits WHERE archived = 0 ORDER BY id")
    fun habits(): Flow<List<HabitEntity>>

    @Query("SELECT * FROM habit_records WHERE day >= :from")
    fun recordsSince(from: Long): Flow<List<HabitRecordEntity>>

    @Insert
    suspend fun addHabit(h: HabitEntity): Long

    @Update
    suspend fun updateHabit(h: HabitEntity)

    @Query("UPDATE habits SET archived = 1 WHERE id = :id")
    suspend fun archive(id: Long)

    @Insert
    suspend fun insertRecord(r: HabitRecordEntity)

    @Query("DELETE FROM habit_records WHERE habitId = :habitId AND day = :day")
    suspend fun clearRecord(habitId: Long, day: Long)
}

@Dao
interface FinanceDao {
    @Query("SELECT * FROM tx ORDER BY day DESC, id DESC LIMIT 500")
    fun txAll(): Flow<List<TxEntity>>

    @Query("SELECT * FROM tx WHERE day >= :from ORDER BY day DESC, id DESC")
    fun txSince(from: Long): Flow<List<TxEntity>>

    @Query("SELECT COALESCE(SUM(CASE WHEN type = 'in' THEN amount ELSE -amount END), 0) FROM tx")
    fun balance(): Flow<Long>

    @Query("SELECT COALESCE(SUM(amount), 0) FROM tx WHERE type = 'in' AND day >= :from")
    fun incomeSince(from: Long): Flow<Long>

    @Query("SELECT COALESCE(SUM(amount), 0) FROM tx WHERE type = 'out' AND day >= :from")
    fun expenseSince(from: Long): Flow<Long>

    @Insert
    suspend fun addTx(t: TxEntity)

    @Delete
    suspend fun deleteTx(t: TxEntity)
}

@Dao
interface JarsDao {
    @Query("SELECT * FROM jars WHERE archived = 0 ORDER BY id")
    fun jars(): Flow<List<JarEntity>>

    @Insert
    suspend fun addJar(j: JarEntity): Long

    @Update
    suspend fun updateJar(j: JarEntity)

    @Query("UPDATE jars SET saved = MAX(0, saved + :delta) WHERE id = :id")
    suspend fun changeSaved(id: Long, delta: Long)

    @Query("UPDATE jars SET archived = 1 WHERE id = :id")
    suspend fun archive(id: Long)
}

@Dao
interface DebtsDao {
    @Query("SELECT * FROM debts ORDER BY closed ASC, day DESC, id DESC")
    fun debts(): Flow<List<DebtEntity>>

    @Insert
    suspend fun addDebt(d: DebtEntity)

    @Query("UPDATE debts SET paid = MAX(0, paid + :delta) WHERE id = :id")
    suspend fun changePaid(id: Long, delta: Long)

    @Query("UPDATE debts SET closed = :closed WHERE id = :id")
    suspend fun setClosed(id: Long, closed: Boolean)

    @Delete
    suspend fun deleteDebt(d: DebtEntity)
}

@Dao
interface WorkoutsDao {
    @Query("SELECT * FROM workouts WHERE day >= :from ORDER BY day DESC, id DESC")
    fun since(from: Long): Flow<List<WorkoutEntity>>

    @Insert
    suspend fun add(w: WorkoutEntity)

    @Delete
    suspend fun delete(w: WorkoutEntity)
}

@Dao
interface StudyDao {
    @Query("SELECT * FROM study WHERE day >= :from ORDER BY day DESC, id DESC")
    fun since(from: Long): Flow<List<StudyEntity>>

    @Insert
    suspend fun add(s: StudyEntity)

    @Delete
    suspend fun delete(s: StudyEntity)
}

@Dao
interface BooksDao {
    @Query("SELECT * FROM books ORDER BY done ASC, id DESC")
    fun books(): Flow<List<BookEntity>>

    @Insert
    suspend fun add(b: BookEntity): Long

    @Query("UPDATE books SET read = MAX(0, read + :delta) WHERE id = :id")
    suspend fun changeRead(id: Long, delta: Int)

    @Query("SELECT * FROM books WHERE id = :id")
    suspend fun byId(id: Long): BookEntity?

    @Query("UPDATE books SET read = :read WHERE id = :id")
    suspend fun setRead(id: Long, read: Int)
    @Query("UPDATE books SET done = :done WHERE id = :id")
    suspend fun setDone(id: Long, done: Boolean)

    @Delete
    suspend fun delete(b: BookEntity)
}

@Dao
interface VocabDao {
    @Query("SELECT * FROM vocab ORDER BY dueDay ASC, id DESC")
    fun all(): Flow<List<VocabEntity>>

    @Query("SELECT COUNT(*) FROM vocab WHERE dueDay <= :today")
    fun dueCount(today: Long): Flow<Int>

    @Insert
    suspend fun add(v: VocabEntity): Long

    @Update
    suspend fun update(v: VocabEntity)

    @Delete
    suspend fun delete(v: VocabEntity)
}

@Dao
interface FoodDao {
    @Query("SELECT * FROM food WHERE day >= :from ORDER BY day DESC, id DESC")
    fun since(from: Long): Flow<List<FoodEntity>>

    @Insert
    suspend fun add(f: FoodEntity)

    @Delete
    suspend fun delete(f: FoodEntity)
}

@Dao
interface CourseProgressDao {
    @Query("SELECT * FROM course_progress WHERE courseId = :courseId")
    fun byCourse(courseId: String): Flow<List<CourseProgressEntity>>

    @Query("SELECT * FROM course_progress")
    fun all(): Flow<List<CourseProgressEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun mark(p: CourseProgressEntity)

    @Query("DELETE FROM course_progress WHERE courseId = :courseId")
    suspend fun resetCourse(courseId: String)
}

@Dao
interface PeopleDao {
    @Query("SELECT * FROM people ORDER BY name COLLATE NOCASE")
    fun all(): Flow<List<PersonEntity>>

    @Query("SELECT * FROM people WHERE id = :id")
    suspend fun byId(id: Long): PersonEntity?

    @Insert
    suspend fun add(p: PersonEntity): Long

    @Update
    suspend fun update(p: PersonEntity)

    @Delete
    suspend fun delete(p: PersonEntity)
}
