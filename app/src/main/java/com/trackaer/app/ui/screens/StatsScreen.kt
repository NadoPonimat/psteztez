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
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.trackaer.app.ui.components.BarChart
import androidx.compose.material3.Scaffold
import com.trackaer.app.ui.components.CategoryBars
import com.trackaer.app.ui.components.EmptyHint
import com.trackaer.app.ui.components.ScreenTopBar
import com.trackaer.app.ui.components.SectionCard
import com.trackaer.app.util.Fmt
import com.trackaer.app.util.Fmt.dayShort
import com.trackaer.app.vm.StatsViewModel
import com.trackaer.app.vm.todayDay

@Composable
fun StatsScreen() {
    val vm: StatsViewModel = viewModel()
    val settings by vm.settings.collectAsState()
    val food by vm.food14.collectAsState()
    val workout by vm.workout14.collectAsState()
    val study by vm.study14.collectAsState()
    val tx by vm.tx30.collectAsState()
    val habits by vm.habits.collectAsState()
    val records by vm.records30.collectAsState()

    val today = todayDay()
    val days = (0..13).map { today - 13 + it }
    val labels = days.map { dayShort(it) }
    val kcalSeries = days.map { d -> food.filter { it.day == d }.sumOf { it.kcal }.toFloat() }
    val workoutSeries = days.map { d -> workout.filter { it.day == d }.sumOf { it.minutes }.toFloat() }
    val studySeries = days.map { d -> study.filter { it.day == d }.sumOf { it.minutes }.toFloat() }
    val byCat = tx.filter { it.type == "out" }
        .groupBy { it.category }
        .map { (k, v) -> k to v.sumOf { it.amount } }
        .sortedByDescending { it.second }
        .take(8)

    Scaffold(topBar = { ScreenTopBar("Статистика") }) { pad ->
        Column(
            Modifier
                .padding(pad)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SectionCard("Калории, 14 дней") {
                BarChart(kcalSeries, labels, target = settings.kcalTarget.toFloat())
            }
            SectionCard("Тренировки, минут в день") {
                BarChart(
                    workoutSeries, labels,
                    accent = MaterialTheme.colorScheme.secondary
                )
            }
            SectionCard("Учёба, минут в день") {
                BarChart(
                    studySeries, labels,
                    accent = MaterialTheme.colorScheme.tertiary
                )
            }
            SectionCard("Траты по категориям, месяц") {
                if (byCat.isEmpty()) EmptyHint("Расходов пока нет.")
                else CategoryBars(byCat) { Fmt.money(it, settings.currency) }
            }
            SectionCard("Привычки, 30 дней") {
                if (habits.isEmpty()) EmptyHint("Привычек нет.")
                else Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    habits.forEach { h ->
                        val doneCount = records.count { it.habitId == h.id && it.done }
                        val pct = (doneCount / 30.0).coerceIn(0.0, 1.0)
                        Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Text(
                                "${h.emoji} ${h.name}",
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.weight(1f),
                                maxLines = 1
                            )
                            Text(
                                "${(pct * 100).toInt()}%",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        LinearProgressIndicator(
                            progress = { pct.toFloat() },
                            modifier = Modifier.fillMaxWidth().height(6.dp),
                            trackColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    }
                }
            }
            Spacer(Modifier.height(20.dp))
        }
    }
}
