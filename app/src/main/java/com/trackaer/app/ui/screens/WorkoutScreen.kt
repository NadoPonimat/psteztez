package com.trackaer.app.ui.screens

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.trackaer.app.data.db.WorkoutEntity
import com.trackaer.app.ui.components.EmptyHint
import com.trackaer.app.ui.components.IconActionButton
import com.trackaer.app.ui.components.ScreenTopBar
import com.trackaer.app.ui.components.SectionCard
import com.trackaer.app.util.Fmt.dayShort
import com.trackaer.app.vm.WorkoutViewModel
import com.trackaer.app.vm.todayDay

@Composable
fun WorkoutScreen() {
    val vm: WorkoutViewModel = viewModel()
    val recent by vm.recent.collectAsState()
    var showAdd by remember { mutableStateOf(false) }

    val week = recent.filter { it.day >= todayDay() - 6 }
    val weekMin = week.sumOf { it.minutes }

    Scaffold(
        topBar = { ScreenTopBar("Тренировки") },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAdd = true }) {
                Icon(Icons.Default.Add, contentDescription = "Добавить")
            }
        }
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            SectionCard("Эта неделя") {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(
                        "💪 $weekMin мин",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        "тренировок: ${week.size}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            if (recent.isEmpty()) {
                EmptyHint("Тренировок нет. Добавь первую — даже 20 минут считаются.")
            } else {
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 90.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(recent, key = { it.id }) { w ->
                        WorkoutRow(w) { vm.delete(w) }
                    }
                }
            }
        }
    }

    if (showAdd) {
        WorkoutDialog(
            onSave = { kind, min, intensity, note -> vm.add(kind, min, intensity, note); showAdd = false },
            onDismiss = { showAdd = false }
        )
    }
}

@Composable
private fun WorkoutRow(w: WorkoutEntity, onDelete: () -> Unit) {
    val emoji = when (w.kind) {
        "Силовая" -> "🏋️"; "Бег" -> "🏃"; "Велосипед" -> "🚴"; "Плавание" -> "🏊"
        "Растяжка" -> "🧘"; "Ходьба" -> "🚶"; else -> "🏃"
    }
    val intensity = when (w.intensity) { 1 -> "легко"; 2 -> "средне"; else -> "тяжело" }
    Card(shape = RoundedCornerShape(14.dp)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(emoji, fontSize = 20.sp)
            Spacer(Modifier.height(0.dp))
            Column(Modifier.weight(1f).padding(start = 10.dp)) {
                Text("${w.kind} · ${w.minutes} мин", style = MaterialTheme.typography.titleSmall)
                Text(
                    "${dayShort(w.day)} · $intensity" + if (w.note.isNotBlank()) " · ${w.note}" else "",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1
                )
            }
            IconActionButton(Icons.Default.Delete, "Удалить", onDelete)
        }
    }
}

@Composable
private fun WorkoutDialog(onSave: (String, Int, Int, String) -> Unit, onDismiss: () -> Unit) {
    var kind by remember { mutableStateOf("Силовая") }
    var minutes by remember { mutableStateOf("45") }
    var intensity by remember { mutableStateOf(2) }
    var note by remember { mutableStateOf("") }
    val kinds = listOf("Силовая", "Бег", "Велосипед", "Плавание", "Растяжка", "Ходьба", "Другое")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Новая тренировка") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    kinds.forEach { k ->
                        FilterChip(selected = kind == k, onClick = { kind = k }, label = { Text(k, fontSize = 12.sp) })
                    }
                }
                OutlinedTextField(
                    value = minutes, onValueChange = { minutes = it },
                    label = { Text("Минуты") }, singleLine = true
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(1 to "Легко", 2 to "Средне", 3 to "Тяжело").forEach { (v, t) ->
                        FilterChip(selected = intensity == v, onClick = { intensity = v }, label = { Text(t, fontSize = 12.sp) })
                    }
                }
                OutlinedTextField(value = note, onValueChange = { note = it }, label = { Text("Заметка") }, singleLine = true)
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val m = minutes.trim().toIntOrNull()
                if (m != null && m > 0) onSave(kind, m, intensity, note)
            }) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}
