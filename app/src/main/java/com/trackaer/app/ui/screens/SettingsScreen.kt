package com.trackaer.app.ui.screens

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.trackaer.app.ui.components.ScreenTopBar
import com.trackaer.app.ui.components.SectionCard
import com.trackaer.app.vm.SettingsViewModel
import java.util.Locale

private val SPLASH_ANIMS = listOf(
    "radar" to "Радар",
    "pulse" to "Пульс",
    "scan" to "Скан",
    "horns" to "Рожки",
    "hearing" to "Звук",
    "flash" to "Вспышка",
    "lightning" to "Молния",
    "rain" to "Дождь",
    "crack" to "Трещина",
    "none" to "Без"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen() {
    val vm: SettingsViewModel = viewModel()
    val s by vm.settings.collectAsState()
    var showTime by remember { mutableStateOf(false) }
    var showKcal by remember { mutableStateOf(false) }
    val ctx = androidx.compose.ui.platform.LocalContext.current
    var hasPhoto by remember { mutableStateOf(java.io.File((ctx as android.content.Context).filesDir, "splash_photo.jpg").exists()) }

    val pickPhoto = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            try {
                val f = java.io.File((ctx as android.content.Context).filesDir, "splash_photo.jpg")
                ctx.contentResolver.openInputStream(uri)?.use { input ->
                    f.outputStream().use { output -> input.copyTo(output) }
                }
                hasPhoto = f.exists()
            } catch (_: Exception) { }
        }
    }

    Scaffold(topBar = { ScreenTopBar("Настройки") }) { pad ->
        Column(
            Modifier
                .padding(pad)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SectionCard("Анимация входа") {
                Text(
                    "Сколько показывать заставку при запуске. Тапом по экрану её можно пропустить в любой момент.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(10.dp))
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf(
                        0 to "Выкл", 1000 to "1 с", 2500 to "2,5 с",
                        5000 to "5 с", 8000 to "8 с", 15000 to "15 с"
                    ).forEach { (ms, label) ->
                        FilterChip(
                            selected = s.splashMillis == ms,
                            onClick = { vm.setSplashMillis(ms) },
                            label = { Text(label, fontSize = 12.sp) }
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                Text("Вариант анимации", style = MaterialTheme.typography.labelLarge)
                Spacer(Modifier.height(6.dp))
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    SPLASH_ANIMS.forEach { (key, label) ->
                        FilterChip(
                            selected = s.splashAnim == key,
                            onClick = { vm.setSplashAnim(key) },
                            label = { Text(label, fontSize = 12.sp) }
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Показывать название", style = MaterialTheme.typography.bodyLarge)
                    Switch(checked = s.splashShowTitle, onCheckedChange = { vm.setSplashShowTitle(it) })
                }
                Spacer(Modifier.height(6.dp))
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = {
                        pickPhoto.launch(androidx.activity.result.PickVisualMediaRequest(
                            androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia.ImageOnly
                        ))
                    }) { Text("🖼 Своё фото фоном") }
                    if (hasPhoto) {
                        TextButton(onClick = {
                            java.io.File((ctx as android.content.Context).filesDir, "splash_photo.jpg").delete()
                            hasPhoto = false
                        }) { Text("Убрать фото") }
                    }
                }
                if (hasPhoto) {
                    Text(
                        "Фото установлено — анимация будет поверх него",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }

            SectionCard("Напоминание на каждый день") {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Включено", style = MaterialTheme.typography.bodyLarge)
                    Switch(
                        checked = s.remindEnabled,
                        onCheckedChange = { on ->
                            vm.setReminder(on, s.remindHour, s.remindMinute)
                        }
                    )
                }
                if (s.remindEnabled) {
                    Spacer(Modifier.height(8.dp))
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            String.format(Locale.US, "%02d:%02d", s.remindHour, s.remindMinute),
                            style = MaterialTheme.typography.titleMedium
                        )
                        TextButton(onClick = { showTime = true }) { Text("Изменить") }
                    }
                }
            }

            SectionCard("Питание") {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Цель калорий", style = MaterialTheme.typography.bodyLarge)
                    TextButton(onClick = { showKcal = true }) { Text("${s.kcalTarget} ккал") }
                }
            }

            SectionCard("Валюта") {
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf("₸", "₽", "$", "€", "₴", "₺").forEach { c ->
                        FilterChip(
                            selected = s.currency == c,
                            onClick = { vm.setCurrency(c) },
                            label = { Text(c, fontSize = 16.sp) }
                        )
                    }
                }
            }

            SectionCard("О приложении") {
                Text(
                    "Trackaer 2.0.0 — нативная версия на Kotlin + Jetpack Compose. " +
                        "18 курсов и 841 урок уже внутри, база данных локальная (Room), работает офлайн.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(Modifier.height(20.dp))
        }
    }

    if (showTime) {
        TimeDialog(
            hour = s.remindHour, minute = s.remindMinute,
            onSet = { h, m -> vm.setReminder(true, h, m); showTime = false },
            onDismiss = { showTime = false }
        )
    }
    if (showKcal) {
        KcalDialog(
            current = s.kcalTarget,
            onSave = { vm.setKcalTarget(it); showKcal = false },
            onDismiss = { showKcal = false }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimeDialog(hour: Int, minute: Int, onSet: (Int, Int) -> Unit, onDismiss: () -> Unit) {
    val state = rememberTimePickerState(initialHour = hour, initialMinute = minute, is24Hour = true)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Время напоминания") },
        text = {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                TimePicker(state)
            }
        },
        confirmButton = {
            TextButton(onClick = { onSet(state.hour, state.minute) }) { Text("Готово") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}

@Composable
private fun KcalDialog(current: Int, onSave: (Int) -> Unit, onDismiss: () -> Unit) {
    var v by remember { mutableStateOf(current.toString()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Цель калорий в день") },
        text = {
            OutlinedTextField(
                value = v, onValueChange = { v = it },
                label = { Text("ккал") }, singleLine = true
            )
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
