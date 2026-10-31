package com.trackaer.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Create
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.trackaer.app.data.db.HabitEntity
import com.trackaer.app.ui.components.EmptyHint
import com.trackaer.app.ui.components.IconActionButton
import com.trackaer.app.ui.components.ScreenTopBar
import com.trackaer.app.vm.HabitsViewModel
import com.trackaer.app.vm.streakOf
import com.trackaer.app.vm.todayDay

@Composable
fun HabitsScreen() {
    val vm: HabitsViewModel = viewModel()
    val habits by vm.habits.collectAsState()
    val records by vm.records.collectAsState()
    var showAdd by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<HabitEntity?>(null) }
    val today = todayDay()

    Scaffold(
        topBar = {
            ScreenTopBar("Привычки") {
                IconActionButton(Icons.Default.Add, "Добавить") { showAdd = true }
            }
        }
    ) { pad ->
        if (habits.isEmpty()) {
            Column(Modifier.padding(pad).padding(16.dp)) {
                EmptyHint("Пока нет привычек. Добавь первую — например «10 000 шагов», «Читать 20 минут» или «Без сахара».")
            }
        } else {
            LazyColumn(
                Modifier.padding(pad).fillMaxSize(),
                contentPadding = PaddingValues(16.dp, 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(habits, key = { it.id }) { h ->
                    HabitCard(
                        h = h,
                        records = records,
                        today = today,
                        onToggle = { d -> vm.toggle(h.id, today, d) },
                        onEdit = { editing = h }
                    )
                }
            }
        }
    }

    if (showAdd) {
        HabitDialog(
            title = "Новая привычка",
            onSave = { name, emoji -> vm.add(name, emoji); showAdd = false },
            onDismiss = { showAdd = false }
        )
    }
    editing?.let { h ->
        HabitDialog(
            title = "Изменить привычку",
            initialName = h.name,
            initialEmoji = h.emoji,
            onSave = { name, emoji -> vm.update(h, name, emoji); editing = null },
            onDismiss = { editing = null },
            onDelete = { vm.archive(h.id); editing = null }
        )
    }
}

@Composable
private fun HabitCard(
    h: HabitEntity,
    records: List<com.trackaer.app.data.db.HabitRecordEntity>,
    today: Long,
    onToggle: (Boolean) -> Unit,
    onEdit: () -> Unit
) {
    val doneSet = records.filter { it.habitId == h.id && it.done }.mapTo(HashSet()) { it.day }
    val done = today in doneSet
    val streak = streakOf(records, h.id, today)

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(h.emoji, fontSize = 20.sp)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(h.name, style = MaterialTheme.typography.titleSmall, maxLines = 1)
                    Text(
                        if (streak > 0) "🔥 серия: $streak дн." else "серия: 0 дн.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                IconActionButton(Icons.Default.Create, "Изменить", onEdit)
                Checkbox(checked = done, onCheckedChange = onToggle)
            }
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                for (d in (today - 13)..today) {
                    val filled = d in doneSet
                    androidx.compose.foundation.layout.Box(
                        Modifier
                            .weight(1f)
                            .height(8.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(
                                if (filled) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.surfaceVariant
                            )
                    )
                }
            }
        }
    }
}

@Composable
private fun HabitDialog(
    title: String,
    initialName: String = "",
    initialEmoji: String = "✅",
    onSave: (String, String) -> Unit,
    onDismiss: () -> Unit,
    onDelete: (() -> Unit)? = null
) {
    var name by remember { mutableStateOf(initialName) }
    var emoji by remember { mutableStateOf(initialEmoji) }
    val options = listOf("✅", "💪", "🏃", "📚", "💧", "🧘", "🥗", "💰", "🧹", "📵", "🎸", "🛌")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Название") },
                    singleLine = true
                )
                Spacer(Modifier.height(10.dp))
                Text(
                    "Иконка",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(4.dp))
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    options.forEach { e ->
                        FilterChip(
                            selected = emoji == e,
                            onClick = { emoji = e },
                            label = { Text(e, fontSize = 18.sp) }
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(name, emoji) }) { Text("Сохранить") }
        },
        dismissButton = {
            Row {
                onDelete?.let {
                    TextButton(onClick = it) {
                        Text("Удалить", color = MaterialTheme.colorScheme.error)
                    }
                }
                TextButton(onClick = onDismiss) { Text("Отмена") }
            }
        }
    )
}
