package com.trackaer.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.trackaer.app.data.PhrasebookRepo
import com.trackaer.app.data.PhrasebookRepo.PbLine
import com.trackaer.app.data.PhrasebookRepo.PbSituation
import com.trackaer.app.ui.components.ScreenTopBar
import com.trackaer.app.util.Tts
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PhrasebookScreen(nav: NavHostController) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var presets by remember { mutableStateOf<List<PbSituation>>(emptyList()) }
    var userSits by remember { mutableStateOf<List<PbSituation>>(emptyList()) }
    var open by remember { mutableStateOf<PbSituation?>(null) }
    var adding by remember { mutableStateOf(false) }
    var train by remember { mutableStateOf<PbSituation?>(null) }

    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            presets = PhrasebookRepo.loadPresets(ctx)
            userSits = PhrasebookRepo.userSits(ctx)
        }
    }

    Scaffold(
        topBar = { ScreenTopBar("Разговорник", nav) },
        floatingActionButton = {
            FloatingActionButton(onClick = { adding = true }) { Icon(Icons.Default.Add, null) }
        }
    ) { pad ->
        val all = userSits + presets
        Column(Modifier.padding(pad).fillMaxSize()) {
            Text(
                "Ситуация → кто говорит → фразы. ▶ — послушать, «Заучивание» — тренировка: видишь русский, говоришь вслух, проверяешь.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
            )
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 96.dp)
            ) {
                items(all, key = { it.id }) { s ->
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.padding(bottom = 8.dp).clickable { open = s; train = null }
                    ) {
                        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("🗣", fontSize = 20.sp)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(s.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                Text(
                                    "${s.roles.joinToString(" / ")} · ${s.lines.size} фраз",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            if (!s.preset) {
                                IconButton(onClick = {
                                    scope.launch {
                                        userSits = userSits - s
                                        PhrasebookRepo.saveUserSits(ctx, userSits)
                                    }
                                }) { Icon(Icons.Default.Close, "Удалить", Modifier.height(18.dp)) }
                            }
                        }
                    }
                }
            }
        }
    }

    // Просмотр диалога
    open?.let { s ->
        var playingAll by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { Tts.stop(); playingAll = false; open = null },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { Tts.stop(); playingAll = false; open = null }) { Text("Закрыть") }
            },
            title = { Text(s.name) },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    s.lines.forEach { line ->
                        val role = s.roles.getOrElse(line.role) { "—".repeat(1) }
                        Text(
                            role,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(line.ru, style = MaterialTheme.typography.bodyMedium)
                                Text(line.en, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            IconButton(onClick = {
                                Tts.speak(ctx, line.en, "en-US")
                            }) { Text("🔊", fontSize = 18.sp) }
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    Row {
                        TextButton(onClick = {
                            if (playingAll) {
                                Tts.stop(); playingAll = false
                            } else {
                                playingAll = true
                                scope.launch {
                                    s.lines.forEach { line ->
                                        if (!playingAll) return@launch
                                        Tts.speak(ctx, line.en, "en-US")
                                        delay(2500)
                                    }
                                    playingAll = false
                                }
                            }
                        }) { Text(if (playingAll) "■ Стоп" else "▶ Прослушать диалог") }
                        TextButton(onClick = { train = s; open = null }) { Text("Заучивание") }
                    }
                }
            }
        )
    }

    // Режим заучивания: видишь русский → говоришь вслух → проверяешь → дальше
    train?.let { s ->
        var idx by remember { mutableStateOf(0) }
        var revealed by remember { mutableStateOf(false) }
        val line = s.lines.getOrNull(idx) ?: s.lines.first()
        AlertDialog(
            onDismissRequest = { Tts.stop(); train = null },
            confirmButton = {
                TextButton(onClick = {
                    if (revealed) {
                        if (idx + 1 >= s.lines.size) { Tts.stop(); train = null }
                        else { idx++; revealed = false }
                    } else {
                        revealed = true
                        Tts.speak(ctx, line.en, "en-US")
                    }
                }) {
                    Text(
                        when {
                            !revealed -> "Показать перевод"
                            idx + 1 >= s.lines.size -> "Готово"
                            else -> "Дальше"
                        }
                    )
                }
            },
            dismissButton = { TextButton(onClick = { Tts.stop(); train = null }) { Text("Выход") } },
            title = { Text("Заучивание · ${idx + 1}/${s.lines.size}") },
            text = {
                Column {
                    Text(line.ru, style = MaterialTheme.typography.titleMedium)
                    if (revealed) {
                        Spacer(Modifier.height(8.dp))
                        Text(line.en, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                    } else {
                        Spacer(Modifier.height(8.dp))
                        Text("Произнеси перевод вслух, потом проверь", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        )
    }

    // Новая ситуация: имя + роли + строки (по-русски / перевод)
    if (adding) {
        var name by remember { mutableStateOf("") }
        var roleA by remember { mutableStateOf("Я") }
        var roleB by remember { mutableStateOf("Собеседник") }
        var lines by remember { mutableStateOf(listOf(PbLine(0, "", ""))) }
        AlertDialog(
            onDismissRequest = { adding = false },
            confirmButton = {
                TextButton(onClick = {
                    val clean = lines.filter { it.ru.isNotBlank() || it.en.isNotBlank() }
                    if (name.isNotBlank() && clean.isNotEmpty()) {
                        val s = PbSituation(
                            id = "user_${System.currentTimeMillis()}",
                            name = name.trim(),
                            roles = listOf(roleA.ifBlank { "Я" }, roleB.ifBlank { "Собеседник" }),
                            lines = clean,
                            preset = false
                        )
                        scope.launch {
                            userSits = userSits + s
                            PhrasebookRepo.saveUserSits(ctx, userSits)
                        }
                    }
                    adding = false
                }) { Text("Сохранить") }
            },
            dismissButton = { TextButton(onClick = { adding = false }) { Text("Отмена") } },
            title = { Text("Новая ситуация") },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    OutlinedTextField(name, { name = it }, label = { Text("Название (например: У врача)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                    Row {
                        OutlinedTextField(roleA, { roleA = it }, label = { Text("Роль 1") }, modifier = Modifier.weight(1f), singleLine = true)
                        Spacer(Modifier.width(8.dp))
                        OutlinedTextField(roleB, { roleB = it }, label = { Text("Роль 2") }, modifier = Modifier.weight(1f), singleLine = true)
                    }
                    Spacer(Modifier.height(8.dp))
                    Text("Фразы: по-русски и перевод (перевод можно поправить после)", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    lines.forEachIndexed { i, l ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            TextButton(onClick = {
                                lines = lines.toMutableList().also { it[i] = it[i].copy(role = if (it[i].role == 0) 1 else 0) }
                            }) {
                                Text((if (l.role == 0) roleA else roleB).take(8), fontSize = 11.sp)
                            }
                            Column(Modifier.weight(1f)) {
                                OutlinedTextField(
                                    l.ru, { v -> lines = lines.toMutableList().also { it[i] = it[i].copy(ru = v) } },
                                    label = { Text("По-русски") }, modifier = Modifier.fillMaxWidth(), singleLine = true
                                )
                                OutlinedTextField(
                                    l.en, { v -> lines = lines.toMutableList().also { it[i] = it[i].copy(en = v) } },
                                    label = { Text("Перевод") }, modifier = Modifier.fillMaxWidth(), singleLine = true
                                )
                            }
                            IconButton(onClick = { lines = lines.toMutableList().also { it.removeAt(i) } }) {
                                Icon(Icons.Default.Close, null, Modifier.height(16.dp))
                            }
                        }
                    }
                    TextButton(onClick = { lines = lines + PbLine(lines.size % 2, "", "") }) { Text("+ фраза") }
                }
            }
        )
    }
}
