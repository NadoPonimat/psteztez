package com.trackaer.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.trackaer.app.data.Course
import com.trackaer.app.data.CLesson
import com.trackaer.app.ui.components.LabeledValue
import com.trackaer.app.ui.components.MetricTile
import com.trackaer.app.ui.components.ScreenTopBar
import com.trackaer.app.ui.components.SectionCard
import com.trackaer.app.util.Fmt
import com.trackaer.app.vm.HomeViewModel
import com.trackaer.app.vm.todayDay
import com.trackaer.app.util.Fmt.dayFull
import java.time.LocalDate
import java.time.LocalTime

@Composable
fun HomeScreen(nav: NavHostController) {
    val vm: HomeViewModel = viewModel()
    val settings by vm.settings.collectAsState()
    val habits by vm.habits.collectAsState()
    val records by vm.records.collectAsState()
    val kcal by vm.kcal.collectAsState()
    val workoutMin by vm.workoutMin.collectAsState()
    val studyMin by vm.studyMin.collectAsState()
    val income by vm.incomeMonth.collectAsState()
    val expense by vm.expenseMonth.collectAsState()
    val balance by vm.balance.collectAsState()
    val progress by vm.courseProgress.collectAsState()
    val courses by vm.courses.collectAsState()

    val greeting = remember {
        when (LocalTime.now().hour) {
            in 5..11 -> "Доброе утро"
            in 12..17 -> "Добрый день"
            in 18..22 -> "Добрый вечер"
            else -> "Ночная смена"
        }
    }
    val doneToday = habits.count { h ->
        records.any { it.habitId == h.id && it.day == todayDay() && it.done }
    }
    val nextLesson: Pair<Course, CLesson>? = remember(courses, progress) {
        var found: Pair<Course, CLesson>? = null
        for (c in courses) {
            val all = c.modules.flatMap { m -> m.lessons }
            val doneIds = progress
                .filter { it.courseId == c.id && it.completedAt > 0 }
                .mapTo(HashSet()) { it.lessonId }
            val nl = all.firstOrNull { it.id !in doneIds }
            if (nl != null) { found = c to nl; break }
        }
        found
    }

    Scaffold(topBar = { ScreenTopBar(greeting) }) { pad ->
        Column(
            Modifier
                .padding(pad)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                dayFull(LocalDate.now().toEpochDay()),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MetricTile("✅", "$doneToday/${habits.size}", "привычки", Modifier.weight(1f)) { nav.navigate("habits") }
                MetricTile("🍽️", "$kcal/${settings.kcalTarget}", "ккал сегодня", Modifier.weight(1f)) { nav.navigate("food") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MetricTile("💪", "$workoutMin мин", "тренировка", Modifier.weight(1f)) { nav.navigate("workout") }
                MetricTile("📖", "$studyMin мин", "учёба", Modifier.weight(1f)) { nav.navigate("study") }
            }

            SectionCard("Финансы за месяц") {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    LabeledValue("Доходы", Fmt.money(income, settings.currency))
                    LabeledValue("Расходы", Fmt.money(expense, settings.currency))
                }
                Spacer(Modifier.height(10.dp))
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    LabeledValue("Баланс", Fmt.money(balance, settings.currency))
                    TextButton(onClick = { nav.navigate("finance") }) { Text("Подробнее") }
                }
            }

            if (nextLesson != null) {
                SectionCard("Продолжить обучение") {
                    Row(
                        Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                nextLesson.first.emoji + "  " + nextLesson.first.title,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                nextLesson.second.title,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 2
                            )
                        }
                        Spacer(Modifier.height(4.dp))
                        FilledTonalButton(onClick = {
                            nav.navigate("lesson/${nextLesson.first.id}/${nextLesson.second.id}")
                        }) { Text("Открыть") }
                    }
                }
            } else {
                SectionCard("Курсы") {
                    Text(
                        "18 курсов уже внутри: от SQL до выживания. Выбери свой.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(Modifier.height(6.dp))
                    TextButton(onClick = { nav.navigate("courses") }) { Text("К курсам") }
                }
            }

            if (habits.isNotEmpty()) {
                SectionCard("Привычки сегодня") {
                    habits.forEach { h ->
                        val done = records.any {
                            it.habitId == h.id && it.day == todayDay() && it.done
                        }
                        Row(
                            Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(h.emoji)
                            Spacer(Modifier.height(0.dp))
                            Text(
                                "  " + h.name,
                                style = MaterialTheme.typography.bodyLarge,
                                modifier = Modifier.weight(1f),
                                maxLines = 1
                            )
                            Checkbox(checked = done, onCheckedChange = { d -> vm.toggleHabit(h.id, d) })
                        }
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}
