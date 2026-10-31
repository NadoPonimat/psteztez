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
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
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
import com.trackaer.app.data.db.FoodEntity
import com.trackaer.app.ui.components.EmptyHint
import com.trackaer.app.ui.components.IconActionButton
import com.trackaer.app.ui.components.ScreenTopBar
import com.trackaer.app.ui.components.SectionCard
import com.trackaer.app.vm.FoodViewModel
import com.trackaer.app.vm.todayDay

@Composable
fun FoodScreen() {
    val vm: FoodViewModel = viewModel()
    val settings by vm.settings.collectAsState()
    val recent by vm.recent.collectAsState()
    var showAdd by remember { mutableStateOf(false) }
    var showTarget by remember { mutableStateOf(false) }

    val today = todayDay()
    val todayEntries = recent.filter { it.day == today }
    val kcal = todayEntries.sumOf { it.kcal }
    val protein = todayEntries.sumOf { it.protein }
    val fat = todayEntries.sumOf { it.fat }
    val carbs = todayEntries.sumOf { it.carbs }
    val target = settings.kcalTarget
    val frac = if (target > 0) (kcal.toDouble() / target).coerceIn(0.0, 1.0) else 0.0

    Scaffold(
        topBar = {
            ScreenTopBar("Питание") {
                IconActionButton(Icons.Default.Edit, "Цель калорий") { showTarget = true }
            }
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAdd = true }) {
                Icon(Icons.Default.Add, contentDescription = "Добавить")
            }
        }
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            SectionCard("Сегодня", Modifier.padding(16.dp, 8.dp)) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "🍽️ $kcal ккал",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "цель: $target",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(Modifier.height(8.dp))
                LinearProgressIndicator(
                    progress = { frac.toFloat() },
                    modifier = Modifier.fillMaxWidth().height(10.dp),
                    trackColor = MaterialTheme.colorScheme.surfaceVariant
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "Б: $protein г · Ж: $fat г · У: $carbs г",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (todayEntries.isEmpty()) {
                EmptyHint("Сегодня ничего не записано. Добавь приём пищи.")
            } else {
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 90.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(todayEntries, key = { it.id }) { f ->
                        FoodRow(f) { vm.delete(f) }
                    }
                }
            }
        }
    }

    if (showAdd) {
        FoodDialog(
            onSave = { meal, name, k, p, f, c -> vm.add(meal, name, k, p, f, c); showAdd = false },
            onDismiss = { showAdd = false }
        )
    }
    if (showTarget) {
        TargetDialog(target, { vm.setKcalTarget(it); showTarget = false }, { showTarget = false })
    }
}

// Отдельный диалог цели с собственным состоянием
@Composable
private fun TargetDialog(current: Int, onSave: (Int) -> Unit, onDismiss: () -> Unit) {
    var v by remember { mutableStateOf(current.toString()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Цель калорий в день") },
        text = {
            OutlinedTextField(value = v, onValueChange = { v = it }, label = { Text("ккал") }, singleLine = true)
        },
        confirmButton = {
            TextButton(onClick = {
                val n = v.trim().toIntOrNull()
                if (n != null && n > 0) onSave(n)
            }) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}

@Composable
private fun FoodRow(f: FoodEntity, onDelete: () -> Unit) {
    val mealEmoji = when (f.meal) {
        "Завтрак" -> "🌅"; "Обед" -> "☀️"; "Ужин" -> "🌙"; else -> "🍪"
    }
    Card(shape = RoundedCornerShape(14.dp)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(mealEmoji, fontSize = 18.sp)
            Column(Modifier.weight(1f).padding(start = 10.dp)) {
                Text(f.name, style = MaterialTheme.typography.titleSmall, maxLines = 1)
                Text(
                    "${f.meal} · ${f.kcal} ккал" +
                        if (f.protein + f.fat + f.carbs > 0) " · Б${f.protein}/Ж${f.fat}/У${f.carbs}" else "",
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
private fun FoodDialog(
    onSave: (String, String, Int, Int, Int, Int) -> Unit,
    onDismiss: () -> Unit
) {
    var meal by remember { mutableStateOf("Завтрак") }
    var name by remember { mutableStateOf("") }
    var kcal by remember { mutableStateOf("") }
    var protein by remember { mutableStateOf("") }
    var fat by remember { mutableStateOf("") }
    var carbs by remember { mutableStateOf("") }
    val meals = listOf("Завтрак", "Обед", "Ужин", "Перекус")

    fun num(s: String): Int = s.trim().toIntOrNull() ?: 0

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Что съел?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    meals.forEach { m ->
                        FilterChip(selected = meal == m, onClick = { meal = m }, label = { Text(m, fontSize = 12.sp) })
                    }
                }
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Блюдо / продукт") }, singleLine = true)
                OutlinedTextField(value = kcal, onValueChange = { kcal = it }, label = { Text("Ккал") }, singleLine = true)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = protein, onValueChange = { protein = it }, label = { Text("Б, г") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = fat, onValueChange = { fat = it }, label = { Text("Ж, г") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = carbs, onValueChange = { carbs = it }, label = { Text("У, г") }, singleLine = true, modifier = Modifier.weight(1f))
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val k = num(kcal)
                if (name.isNotBlank() && k > 0) onSave(meal, name, k, num(protein), num(fat), num(carbs))
            }) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}
