package com.trackaer.app.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.trackaer.app.data.StudyPlanStore
import com.trackaer.app.data.db.BookEntity
import com.trackaer.app.data.db.VocabEntity
import com.trackaer.app.ui.components.EmptyHint
import com.trackaer.app.ui.components.IconActionButton
import com.trackaer.app.ui.components.ScreenTopBar
import com.trackaer.app.ui.components.SectionCard
import com.trackaer.app.util.BookText
import com.trackaer.app.util.Fmt.dayShort
import com.trackaer.app.util.Tts
import com.trackaer.app.vm.StudyViewModel
import com.trackaer.app.vm.todayDay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

private val VOICE = Icons.Filled.PlayArrow

@Composable
fun StudyScreen(nav: NavHostController) {
    val vm: StudyViewModel = viewModel()
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val sessions by vm.sessions.collectAsState()
    val books by vm.books.collectAsState()
    val words by vm.words.collectAsState()
    val plan by StudyPlanStore.flow(ctx).collectAsState(initial = emptyList())

    var tab by remember { mutableIntStateOf(0) }
    var showSession by remember { mutableStateOf(false) }
    var sessionPreset by remember { mutableStateOf<String?>(null) }
    var showBook by remember { mutableStateOf(false) }
    var showWord by remember { mutableStateOf(false) }
    var editPlan by remember { mutableStateOf(false) }

    val weekMin = sessions.filter { it.day >= todayDay() - 6 }.sumOf { it.minutes }

    // Загрузка своей книги (TXT / FB2 / PDF)
    val pickBook = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            scope.launch(Dispatchers.IO) {
                val tmpId = (0..999999).random().toLong() + 1
                val fmt = BookText.importBook(ctx, uri, tmpId) ?: return@launch
                var title = ""
                try {
                    val name = uri.lastPathSegment ?: ""
                    title = name.substringAfterLast('/').substringBeforeLast('.')
                } catch (_: Exception) { }
                if (title.isBlank()) title = "Моя книга"
                val pageCount = when (fmt) {
                    "pdf" -> BookText.pdfPageCount(ctx, tmpId, fmt, "")
                    else -> BookText.loadTextPages(ctx, tmpId, fmt, "")?.size ?: 1
                }
                // файл importBook сохранил под tmpId — переименуем под настоящий id после вставки
                val realId = vm.addBookFile(title, "", pageCount, fmt, series = "")
                try {
                    val src = File(File(ctx.filesDir, "books"), "$tmpId.$fmt")
                    val dst = File(File(ctx.filesDir, "books"), "$realId.$fmt")
                    if (src.exists()) src.renameTo(dst)
                } catch (_: Exception) { }
            }
        }
    }

    Scaffold(
        topBar = { ScreenTopBar("Учёба") },
        floatingActionButton = {
            FloatingActionButton(onClick = {
                when (tab) {
                    0 -> { sessionPreset = null; showSession = true }
                    1 -> showBook = true
                    2 -> showWord = true
                    else -> editPlan = true
                }
            }) { Icon(Icons.Default.Add, contentDescription = "Добавить") }
        }
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            TabRow(selectedTabIndex = tab) {
                listOf("Занятия", "Книги", "Слова", "План").forEachIndexed { i, t ->
                    Tab(selected = tab == i, onClick = { tab = i }, text = { Text(t) })
                }
            }
            when (tab) {
                0 -> {
                    SectionCard("За неделю", Modifier.padding(16.dp, 8.dp)) {
                        Text(
                            "📖 $weekMin минут занятий",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    if (sessions.isEmpty()) EmptyHint("Занятий нет. Запиши первое — тема и минуты.")
                    else LazyColumn(
                        Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 20.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(sessions, key = { it.id }) { s ->
                            Card(shape = RoundedCornerShape(14.dp)) {
                                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) {
                                        Text(
                                            "${s.subject} · ${s.minutes} мин",
                                            style = MaterialTheme.typography.titleSmall
                                        )
                                        Text(
                                            dayShort(s.day) + if (s.topic.isNotBlank()) " · ${s.topic}" else "",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            maxLines = 1
                                        )
                                    }
                                    IconActionButton(Icons.Default.Delete, "Удалить") { vm.deleteSession(s) }
                                }
                            }
                        }
                    }
                }
                1 -> BookTab(books, vm, nav) { pickBook.launch(arrayOf("*/*")) }
                2 -> VocabTab(words, vm)
                else -> PlanTab(plan, sessions, vm, scope, ctx) { subj -> sessionPreset = subj; showSession = true }
            }
        }
    }

    if (showSession) {
        SessionDialog(
            presetSubject = sessionPreset,
            onSave = { subj, min, topic -> vm.addSession(subj, min, topic); showSession = false },
            onDismiss = { showSession = false }
        )
    }
    if (showBook) {
        BookDialog(
            onSave = { t, a, p, ser -> vm.addBook(t, a, p, ser); showBook = false },
            onDismiss = { showBook = false }
        )
    }
    if (showWord) {
        WordDialog(
            onSave = { w, tr, lang -> vm.addWord(w, tr, lang); showWord = false },
            onDismiss = { showWord = false }
        )
    }
    if (editPlan) {
        PlanEditDialog(
            plan = plan,
            onSave = { updated ->
                scope.launch { StudyPlanStore.save(ctx, updated) }
                editPlan = false
            },
            onDismiss = { editPlan = false }
        )
    }
}

// ---------- План занятий на день ----------

@Composable
private fun PlanTab(
    plan: List<StudyPlanStore.PlanItem>,
    sessions: List<com.trackaer.app.data.db.StudyEntity>,
    vm: StudyViewModel,
    scope: kotlinx.coroutines.CoroutineScope,
    ctx: android.content.Context,
    onQuickSession: (String) -> Unit
) {
    val today = todayDay()
    val doneToday = sessions.filter { it.day == today }.groupBy { it.subject }.mapValues { e -> e.value.sumOf { it.minutes } }

    if (plan.isEmpty()) {
        EmptyHint("План пуст. Нажми «+» и добавь предметы с нормой минут в день — план на день соберётся сам.")
        return
    }
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 90.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            val total = plan.sumOf { it.minutes }
            val done = plan.sumOf { (doneToday[it.subject] ?: 0).coerceAtMost(it.minutes) }
            SectionCard("План на сегодня") {
                Column {
                    Text(
                        "Выполнено $done из $total минут",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(6.dp))
                    LinearProgressIndicator(
                        progress = { if (total > 0) (done.toFloat() / total).coerceIn(0f, 1f) else 0f },
                        modifier = Modifier.fillMaxWidth().height(8.dp)
                    )
                }
            }
        }
        items(plan, key = { it.subject }) { p ->
            val done = doneToday[p.subject] ?: 0
            val ok = done >= p.minutes
            Card(shape = RoundedCornerShape(14.dp)) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            (if (ok) "✅ " else "📌 ") + p.subject,
                            style = MaterialTheme.typography.titleSmall
                        )
                        Text(
                            "$done из ${p.minutes} мин сегодня",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        LinearProgressIndicator(
                            progress = { (done.toFloat() / p.minutes).coerceIn(0f, 1f) },
                            modifier = Modifier.fillMaxWidth().height(6.dp).padding(top = 4.dp)
                        )
                    }
                    OutlinedButton(onClick = { onQuickSession(p.subject) }) { Text("+ мин") }
                }
            }
        }
    }
}

@Composable
private fun PlanEditDialog(
    plan: List<StudyPlanStore.PlanItem>,
    onSave: (List<StudyPlanStore.PlanItem>) -> Unit,
    onDismiss: () -> Unit
) {
    var draft by remember { mutableStateOf(plan.ifEmpty { listOf(StudyPlanStore.PlanItem("Английский", 30)) }) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("План занятий") },
        text = {
            Column {
                Text("Предмет и норма минут в день", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(8.dp))
                draft.forEachIndexed { i, item ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(
                            item.subject,
                            { v -> draft = draft.toMutableList().also { it[i] = it[i].copy(subject = v) } },
                            modifier = Modifier.weight(1f), singleLine = true
                        )
                        Spacer(Modifier.width(6.dp))
                        OutlinedTextField(
                            item.minutes.toString(),
                            { v -> draft = draft.toMutableList().also { it[i] = it[i].copy(minutes = v.toIntOrNull() ?: it[i].minutes) } },
                            modifier = Modifier.width(84.dp), singleLine = true
                        )
                        IconActionButton(Icons.Default.Delete, "Удалить") {
                            draft = draft.toMutableList().also { it.removeAt(i) }
                        }
                    }
                }
                TextButton(onClick = { draft = draft + StudyPlanStore.PlanItem("", 30) }) { Text("+ предмет") }
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(draft.filter { it.subject.isNotBlank() }) }) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}

// ---------- Книги ----------

@Composable
private fun BookTab(
    books: List<BookEntity>,
    vm: StudyViewModel,
    nav: NavHostController,
    onPickFile: () -> Unit
) {
    Column(Modifier.fillMaxSize()) {
        OutlinedButton(
            onClick = onPickFile,
            modifier = Modifier.padding(16.dp, 8.dp).fillMaxWidth()
        ) { Text("📂 Загрузить свою книгу (TXT, FB2, PDF)") }
        if (books.isEmpty()) {
            EmptyHint("Книг нет. Загрузи файл или добавь читаемую книгу вручную.")
        } else {
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 90.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(books, key = { it.id }) { b ->
                    val frac = if (b.pages > 0) (b.read.toDouble() / b.pages).coerceIn(0.0, 1.0) else 0.0
                    Card(shape = RoundedCornerShape(16.dp)) {
                        Column(Modifier.padding(14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        "📕 " + b.title,
                                        style = MaterialTheme.typography.titleSmall,
                                        maxLines = 1
                                    )
                                    val meta = listOfNotNull(
                                        b.author.takeIf { it.isNotBlank() },
                                        b.series.takeIf { it.isNotBlank() },
                                        b.format.takeIf { it.isNotBlank() }?.uppercase()
                                    ).joinToString(" · ")
                                    if (meta.isNotEmpty()) {
                                        Text(
                                            meta,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            maxLines = 1
                                        )
                                    }
                                }
                                IconActionButton(Icons.Default.Delete, "Удалить") { vm.deleteBook(b) }
                            }
                            LinearProgressIndicator(
                                progress = { frac.toFloat() },
                                modifier = Modifier.fillMaxWidth().height(8.dp),
                                trackColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                "${b.read} из ${b.pages} стр." + if (b.done) " · прочитана ✅" else "",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                if (b.format.isNotBlank()) {
                                    androidx.compose.material3.FilledTonalButton(
                                        onClick = { nav.navigate("reader/${b.id}") }
                                    ) { Text("▶ Читать", fontSize = 12.sp) }
                                } else {
                                    listOf(10 to "+10", 25 to "+25", 50 to "+50").forEach { (d, label) ->
                                        androidx.compose.material3.FilledTonalButton(
                                            onClick = { vm.changeRead(b.id, d) },
                                            enabled = !b.done
                                        ) { Text(label, fontSize = 12.sp) }
                                    }
                                }
                                TextButton(onClick = { vm.setBookDone(b.id, !b.done) }) {
                                    Text(if (b.done) "Не дочитана" else "Дочитана")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---------- Слова ----------

@Composable
private fun VocabTab(words: List<VocabEntity>, vm: StudyViewModel) {
    val ctx = LocalContext.current
    val today = todayDay()
    val due = words.filter { it.dueDay <= today }
    var reveal by remember { mutableStateOf(false) }
    var current by remember { mutableStateOf<VocabEntity?>(null) }
    val shown = current ?: due.firstOrNull()

    Column(Modifier.fillMaxSize()) {
        if (shown != null) {
            SectionCard("К повторению: ${due.size}", Modifier.padding(16.dp, 8.dp)) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            shown.word,
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f)
                        )
                        IconActionButton(VOICE, "Озвучить") {
                            Tts.speak(ctx, shown.word, langTag(shown.lang))
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                    if (reveal) {
                        Text(
                            shown.translation,
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            androidx.compose.material3.FilledTonalButton(onClick = {
                                vm.reviewWord(shown, true); reveal = false; current = null
                            }) { Text("Знал ✅") }
                            androidx.compose.material3.FilledTonalButton(onClick = {
                                vm.reviewWord(shown, false); reveal = false; current = null
                            }) { Text("Не знал ❌") }
                        }
                    } else {
                        Text(
                            "Нажми «Показать», чтобы вспомнить перевод",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(Modifier.height(10.dp))
                        androidx.compose.material3.FilledTonalButton(onClick = { reveal = true }) {
                            Text("Показать")
                        }
                    }
                    Text(
                        "коробка Лейтнера: ${shown.box}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            SectionCard("Повторений нет 🎉", Modifier.padding(16.dp, 8.dp)) {
                Text(
                    "Все слова на сегодня отработаны. Добавь новые, чтобы не останавливаться.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        if (words.isEmpty()) {
            EmptyHint("Слов пока нет. Добавь первое слово или фразу.")
        } else {
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 90.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                items(words, key = { it.id }) { v ->
                    Card(shape = RoundedCornerShape(12.dp)) {
                        Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(
                                    "${v.word} — ${v.translation}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    maxLines = 1
                                )
                                Text(
                                    if (v.dueDay <= today) "к повторению: сегодня" else "след.: " + dayShort(v.dueDay),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            IconActionButton(VOICE, "Озвучить") {
                                Tts.speak(ctx, v.word, langTag(v.lang))
                            }
                            IconActionButton(Icons.Default.Delete, "Удалить") { vm.deleteWord(v) }
                        }
                    }
                }
            }
        }
    }
}

private fun langTag(lang: String) = when (lang.uppercase()) {
    "AR" -> "ar"
    "ES" -> "es-ES"
    "RU" -> "ru-RU"
    else -> "en-US"
}

// ---------- Диалоги ----------

@Composable
private fun SessionDialog(
    presetSubject: String?,
    onSave: (String, Int, String) -> Unit,
    onDismiss: () -> Unit
) {
    var subject by remember { mutableStateOf(presetSubject ?: "Английский") }
    var minutes by remember { mutableStateOf("30") }
    var topic by remember { mutableStateOf("") }
    val subjects = listOf("Английский", "Арабский", "Испанский", "SQL", "Excel", "Право", "Другое")
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Новое занятие") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    subjects.forEach { s ->
                        FilterChip(selected = subject == s, onClick = { subject = s }, label = { Text(s, fontSize = 12.sp) })
                    }
                }
                OutlinedTextField(value = subject, onValueChange = { subject = it }, label = { Text("Предмет") }, singleLine = true)
                OutlinedTextField(value = minutes, onValueChange = { minutes = it }, label = { Text("Минуты") }, singleLine = true)
                OutlinedTextField(value = topic, onValueChange = { topic = it }, label = { Text("Тема") }, singleLine = true)
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val m = minutes.trim().toIntOrNull()
                if (m != null && m > 0) onSave(subject, m, topic)
            }) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}

@Composable
private fun BookDialog(onSave: (String, String, Int, String) -> Unit, onDismiss: () -> Unit) {
    var title by remember { mutableStateOf("") }
    var author by remember { mutableStateOf("") }
    var pages by remember { mutableStateOf("") }
    var series by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Новая книга") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Название") }, singleLine = true)
                OutlinedTextField(value = author, onValueChange = { author = it }, label = { Text("Автор") }, singleLine = true)
                OutlinedTextField(value = series, onValueChange = { series = it }, label = { Text("Серия (необязательно)") }, singleLine = true)
                OutlinedTextField(value = pages, onValueChange = { pages = it }, label = { Text("Страниц") }, singleLine = true)
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val p = pages.trim().toIntOrNull() ?: 200
                if (title.isNotBlank()) onSave(title, author, p, series.trim())
            }) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}

@Composable
private fun WordDialog(onSave: (String, String, String) -> Unit, onDismiss: () -> Unit) {
    var word by remember { mutableStateOf("") }
    var translation by remember { mutableStateOf("") }
    var lang by remember { mutableStateOf("EN") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Новое слово") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("EN", "AR", "ES").forEach { l ->
                        FilterChip(selected = lang == l, onClick = { lang = l }, label = { Text(l) })
                    }
                }
                OutlinedTextField(value = word, onValueChange = { word = it }, label = { Text("Слово / фраза") }, singleLine = true)
                OutlinedTextField(value = translation, onValueChange = { translation = it }, label = { Text("Перевод") }, singleLine = true)
            }
        },
        confirmButton = {
            TextButton(onClick = {
                if (word.isNotBlank() && translation.isNotBlank()) onSave(word, translation, lang)
            }) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}
