package com.trackaer.app.vm

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.trackaer.app.TrackaerApp
import com.trackaer.app.data.AppSettings
import com.trackaer.app.data.Course
import com.trackaer.app.data.CourseRegistry
import com.trackaer.app.data.db.*
import com.trackaer.app.util.BookText
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate

fun todayDay(): Long = LocalDate.now().toEpochDay()

fun monthStartDay(): Long = LocalDate.now().withDayOfMonth(1).toEpochDay()

private fun <T> Flow<T>.auto(scope: CoroutineScope, initial: T): StateFlow<T> =
    stateIn(scope, SharingStarted.WhileSubscribed(5000), initial)

/** Серия привычки: сколько дней подряд отмечена (сегодня не закрыт — считаем со вчера). */
fun streakOf(records: List<HabitRecordEntity>, habitId: Long, today: Long): Int {
    val days = records.filter { it.habitId == habitId && it.done }.mapTo(HashSet()) { it.day }
    var d = if (today in days) today else today - 1
    var s = 0
    while (d in days) { s++; d-- }
    return s
}

// ---------- Главная ----------

class HomeViewModel(app: Application) : AndroidViewModel(app) {
    private val db = (app as TrackaerApp).db
    private val st = (app as TrackaerApp).settings
    private val today = todayDay()

    val settings = st.settings.auto(viewModelScope, AppSettings())
    val habits = db.habitsDao().habits().auto(viewModelScope, emptyList<HabitEntity>())
    val records = db.habitsDao().recordsSince(today - 60).auto(viewModelScope, emptyList<HabitRecordEntity>())
    val kcal = db.foodDao().since(today).map { it.sumOf { f -> f.kcal } }.auto(viewModelScope, 0)
    val workoutMin = db.workoutsDao().since(today).map { it.sumOf { w -> w.minutes } }.auto(viewModelScope, 0)
    val studyMin = db.studyDao().since(today).map { it.sumOf { s -> s.minutes } }.auto(viewModelScope, 0)
    val incomeMonth = db.financeDao().incomeSince(monthStartDay()).auto(viewModelScope, 0L)
    val expenseMonth = db.financeDao().expenseSince(monthStartDay()).auto(viewModelScope, 0L)
    val balance = db.financeDao().balance().auto(viewModelScope, 0L)
    val courseProgress = db.courseProgressDao().all().auto(viewModelScope, emptyList<CourseProgressEntity>())
    val courses = MutableStateFlow<List<Course>>(emptyList())

    init {
        viewModelScope.launch(Dispatchers.IO) {
            courses.value = CourseRegistry.get(getApplication())
        }
    }

    fun toggleHabit(habitId: Long, done: Boolean) {
        viewModelScope.launch {
            if (done) db.habitsDao().insertRecord(HabitRecordEntity(habitId = habitId, day = today, done = true))
            else db.habitsDao().clearRecord(habitId, today)
        }
    }
}

// ---------- Привычки ----------

class HabitsViewModel(app: Application) : AndroidViewModel(app) {
    private val db = (app as TrackaerApp).db
    private val today = todayDay()

    val habits = db.habitsDao().habits().auto(viewModelScope, emptyList<HabitEntity>())
    val records = db.habitsDao().recordsSince(today - 29).auto(viewModelScope, emptyList<HabitRecordEntity>())

    fun toggle(habitId: Long, day: Long, done: Boolean) {
        viewModelScope.launch {
            if (done) db.habitsDao().insertRecord(HabitRecordEntity(habitId = habitId, day = day, done = true))
            else db.habitsDao().clearRecord(habitId, day)
        }
    }

    fun add(name: String, emoji: String) {
        if (name.isBlank()) return
        viewModelScope.launch {
            db.habitsDao().addHabit(HabitEntity(name = name.trim(), emoji = emoji, createdAt = System.currentTimeMillis()))
        }
    }

    fun update(h: HabitEntity, name: String, emoji: String) {
        if (name.isBlank()) return
        viewModelScope.launch { db.habitsDao().updateHabit(h.copy(name = name.trim(), emoji = emoji)) }
    }

    fun archive(id: Long) = viewModelScope.launch { db.habitsDao().archive(id) }
}

// ---------- Финансы ----------

class FinanceViewModel(app: Application) : AndroidViewModel(app) {
    private val db = (app as TrackaerApp).db

    val settings = (app as TrackaerApp).settings.settings.auto(viewModelScope, AppSettings())
    val balance = db.financeDao().balance().auto(viewModelScope, 0L)
    val incomeMonth = db.financeDao().incomeSince(monthStartDay()).auto(viewModelScope, 0L)
    val expenseMonth = db.financeDao().expenseSince(monthStartDay()).auto(viewModelScope, 0L)
    val tx = db.financeDao().txAll().auto(viewModelScope, emptyList<TxEntity>())
    val jars = db.jarsDao().jars().auto(viewModelScope, emptyList<JarEntity>())
    val debts = db.debtsDao().debts().auto(viewModelScope, emptyList<DebtEntity>())

    fun addTx(type: String, amountMinor: Long, category: String, note: String) {
        if (amountMinor <= 0) return
        viewModelScope.launch {
            db.financeDao().addTx(
                TxEntity(
                    type = type, amount = amountMinor, category = category.trim().ifBlank { "Прочее" },
                    note = note.trim(), day = todayDay(), createdAt = System.currentTimeMillis()
                )
            )
        }
    }

    fun deleteTx(t: TxEntity) = viewModelScope.launch { db.financeDao().deleteTx(t) }

    fun addJar(name: String, emoji: String, goalMinor: Long) {
        if (name.isBlank() || goalMinor <= 0) return
        viewModelScope.launch { db.jarsDao().addJar(JarEntity(name = name.trim(), emoji = emoji, goal = goalMinor)) }
    }

    fun changeJar(id: Long, deltaMinor: Long) = viewModelScope.launch { db.jarsDao().changeSaved(id, deltaMinor) }
    fun archiveJar(id: Long) = viewModelScope.launch { db.jarsDao().archive(id) }

    fun addDebt(direction: String, person: String, amountMinor: Long, note: String) {
        if (person.isBlank() || amountMinor <= 0) return
        viewModelScope.launch {
            db.debtsDao().addDebt(
                DebtEntity(
                    direction = direction, person = person.trim(), amount = amountMinor,
                    note = note.trim(), day = todayDay()
                )
            )
        }
    }

    fun changeDebtPaid(id: Long, deltaMinor: Long) = viewModelScope.launch { db.debtsDao().changePaid(id, deltaMinor) }
    fun setDebtClosed(id: Long, closed: Boolean) = viewModelScope.launch { db.debtsDao().setClosed(id, closed) }
    fun deleteDebt(d: DebtEntity) = viewModelScope.launch { db.debtsDao().deleteDebt(d) }
}

// ---------- Тренировки ----------

class WorkoutViewModel(app: Application) : AndroidViewModel(app) {
    private val db = (app as TrackaerApp).db

    val recent = db.workoutsDao().since(todayDay() - 29).auto(viewModelScope, emptyList<WorkoutEntity>())
    val last14 = db.workoutsDao().since(todayDay() - 13).auto(viewModelScope, emptyList<WorkoutEntity>())

    fun add(kind: String, minutes: Int, intensity: Int, note: String) {
        if (minutes <= 0) return
        viewModelScope.launch {
            db.workoutsDao().add(
                WorkoutEntity(
                    kind = kind, minutes = minutes, intensity = intensity.coerceIn(1, 3),
                    note = note.trim(), day = todayDay(), createdAt = System.currentTimeMillis()
                )
            )
        }
    }

    fun delete(w: WorkoutEntity) = viewModelScope.launch { db.workoutsDao().delete(w) }
}

// ---------- Учёба (занятия, книги, слова) ----------

class StudyViewModel(app: Application) : AndroidViewModel(app) {
    private val db = (app as TrackaerApp).db
    private val today = todayDay()

    val sessions = db.studyDao().since(today - 29).auto(viewModelScope, emptyList<StudyEntity>())
    val books = db.booksDao().books().auto(viewModelScope, emptyList<BookEntity>())
    val words = db.vocabDao().all().auto(viewModelScope, emptyList<VocabEntity>())

    fun addSession(subject: String, minutes: Int, topic: String) {
        if (subject.isBlank() || minutes <= 0) return
        viewModelScope.launch {
            db.studyDao().add(
                StudyEntity(subject = subject.trim(), minutes = minutes, topic = topic.trim(), day = today, createdAt = System.currentTimeMillis())
            )
        }
    }

    fun deleteSession(s: StudyEntity) = viewModelScope.launch { db.studyDao().delete(s) }

    fun addBook(title: String, author: String, pages: Int, series: String = "") {
        if (title.isBlank()) return
        viewModelScope.launch {
            db.booksDao().add(
                BookEntity(
                    title = title.trim(), author = author.trim(), pages = pages.coerceAtLeast(1),
                    series = series.trim(), createdAt = System.currentTimeMillis()
                )
            )
        }
    }

    /** Книга из своего файла. Возвращает id вставленной записи. */
    suspend fun addBookFile(title: String, author: String, pages: Int, format: String, series: String = ""): Long {
        return db.booksDao().add(
            BookEntity(
                title = title, author = author, pages = pages.coerceAtLeast(1),
                series = series, format = format, createdAt = System.currentTimeMillis()
            )
        )
    }

    fun changeRead(id: Long, delta: Int) = viewModelScope.launch { db.booksDao().changeRead(id, delta) }
    fun setBookDone(id: Long, done: Boolean) = viewModelScope.launch { db.booksDao().setDone(id, done) }
    fun deleteBook(b: BookEntity) = viewModelScope.launch {
        if (b.format.isNotBlank()) BookText.deleteBookFile(getApplication(), b.id, b.format)
        db.booksDao().delete(b)
    }

    fun addWord(word: String, translation: String, lang: String) {
        if (word.isBlank() || translation.isBlank()) return
        viewModelScope.launch {
            db.vocabDao().add(
                VocabEntity(word = word.trim(), translation = translation.trim(), lang = lang, box = 1, dueDay = today, createdAt = System.currentTimeMillis())
            )
        }
    }

    fun reviewWord(v: VocabEntity, known: Boolean) = viewModelScope.launch {
        val newBox = if (known) (v.box + 1).coerceAtMost(7) else 1
        val interval = longArrayOf(1, 2, 4, 8, 16, 32, 64)[(newBox - 1).coerceIn(0, 6)]
        db.vocabDao().update(
            v.copy(box = newBox, dueDay = today + interval, streak = if (known) v.streak + 1 else 0)
        )
    }

    fun deleteWord(v: VocabEntity) = viewModelScope.launch { db.vocabDao().delete(v) }
}

// ---------- Питание ----------

class FoodViewModel(app: Application) : AndroidViewModel(app) {
    private val db = (app as TrackaerApp).db

    val settings = (app as TrackaerApp).settings.settings.auto(viewModelScope, AppSettings())
    val recent = db.foodDao().since(todayDay() - 13).auto(viewModelScope, emptyList<FoodEntity>())

    fun add(meal: String, name: String, kcal: Int, protein: Int, fat: Int, carbs: Int) {
        if (name.isBlank() || kcal <= 0) return
        viewModelScope.launch {
            db.foodDao().add(
                FoodEntity(
                    meal = meal, name = name.trim(), kcal = kcal,
                    protein = protein.coerceAtLeast(0), fat = fat.coerceAtLeast(0), carbs = carbs.coerceAtLeast(0),
                    day = todayDay(), createdAt = System.currentTimeMillis()
                )
            )
        }
    }

    fun delete(f: FoodEntity) = viewModelScope.launch { db.foodDao().delete(f) }
    fun setKcalTarget(v: Int) = viewModelScope.launch { (getApplication() as TrackaerApp).settings.setKcalTarget(v) }
}

// ---------- Статистика ----------

class StatsViewModel(app: Application) : AndroidViewModel(app) {
    private val db = (app as TrackaerApp).db

    val settings = (app as TrackaerApp).settings.settings.auto(viewModelScope, AppSettings())
    val food14 = db.foodDao().since(todayDay() - 13).auto(viewModelScope, emptyList<FoodEntity>())
    val workout14 = db.workoutsDao().since(todayDay() - 13).auto(viewModelScope, emptyList<WorkoutEntity>())
    val study14 = db.studyDao().since(todayDay() - 13).auto(viewModelScope, emptyList<StudyEntity>())
    val tx30 = db.financeDao().txSince(monthStartDay()).auto(viewModelScope, emptyList<TxEntity>())
    val habits = db.habitsDao().habits().auto(viewModelScope, emptyList<HabitEntity>())
    val records30 = db.habitsDao().recordsSince(todayDay() - 29).auto(viewModelScope, emptyList<HabitRecordEntity>())
}

// ---------- Курсы ----------

class CoursesViewModel(app: Application) : AndroidViewModel(app) {
    private val db = (app as TrackaerApp).db

    val courses = MutableStateFlow<List<Course>>(emptyList())
    val progress = db.courseProgressDao().all().auto(viewModelScope, emptyList<CourseProgressEntity>())

    init {
        viewModelScope.launch(Dispatchers.IO) {
            courses.value = CourseRegistry.get(getApplication())
        }
    }

    fun markDone(courseId: String, lessonId: String) = viewModelScope.launch {
        db.courseProgressDao().mark(CourseProgressEntity(courseId, lessonId, System.currentTimeMillis()))
    }

    fun unmark(courseId: String, lessonId: String) = viewModelScope.launch {
        db.courseProgressDao().mark(CourseProgressEntity(courseId, lessonId, 0))
    }

    fun resetCourse(courseId: String) = viewModelScope.launch { db.courseProgressDao().resetCourse(courseId) }
}

// ---------- Настройки ----------

class SettingsViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = (app as TrackaerApp).settings

    val settings = repo.settings.auto(viewModelScope, AppSettings())

    fun setKcalTarget(v: Int) = viewModelScope.launch { repo.setKcalTarget(v) }
    fun setCurrency(v: String) = viewModelScope.launch { repo.setCurrency(v) }
    fun setSplashMillis(v: Int) = viewModelScope.launch { repo.setSplashMillis(v) }
    fun setSplashAnim(v: String) = viewModelScope.launch { repo.setSplashAnim(v) }
    fun setSplashShowTitle(v: Boolean) = viewModelScope.launch { repo.setSplashShowTitle(v) }

    fun setReminder(enabled: Boolean, hour: Int, minute: Int) = viewModelScope.launch {
        repo.setReminder(enabled, hour, minute)
        com.trackaer.app.util.ReminderScheduler.schedule(getApplication(), enabled, hour, minute)
    }
}
