package com.trackaer.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.trackaer.app.data.db.PersonEntity
import com.trackaer.app.ui.components.ScreenTopBar
import com.trackaer.app.vm.PeopleViewModel
import com.trackaer.app.vm.PersonAction
import com.trackaer.app.vm.actionsJson
import com.trackaer.app.vm.hobbiesJson
import com.trackaer.app.vm.parseActions
import com.trackaer.app.vm.parseHobbies

private val VERDICTS = listOf(
    "ненавидит", "не любит", "скорее нет чем да", "нейтрально",
    "скорее да чем нет", "любит", "обожает"
)

private val VERDICT_COLORS = mapOf(
    "ненавидит" to Color(0xFFE5484D),
    "не любит" to Color(0xFFE58C48),
    "скорее нет чем да" to Color(0xFFD4B148),
    "нейтрально" to Color(0xFF8B98A5),
    "скорее да чем нет" to Color(0xFF7FBF7F),
    "любит" to Color(0xFF2DD4BF),
    "обожает" to Color(0xFF4DA3FF)
)

private fun verdictColor(v: String) = VERDICT_COLORS[v] ?: Color(0xFF8B98A5)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PeopleScreen(nav: NavHostController) {
    val vm: PeopleViewModel = viewModel()
    val people by vm.people.collectAsState()
    val links by vm.linkCounts.collectAsState()
    var editing by remember { mutableStateOf<PersonEntity?>(null) }
    var isNew by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            ScreenTopBar("Люди", nav, actions = {
                IconButton(onClick = { nav.navigate("peopleGraph") }) {
                    Text("🕸", fontSize = 20.sp)
                }
            })
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { isNew = true; editing = PersonEntity(name = "") },
                icon = { Icon(Icons.Default.Add, null) },
                text = { Text("Человек") }
            )
        }
    ) { pad ->
        if (people.isEmpty()) {
            Column(
                Modifier.padding(pad).fillMaxSize().padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text("🕸", fontSize = 44.sp)
                Spacer(Modifier.height(12.dp))
                Text("Пока никого нет", style = MaterialTheme.typography.titleMedium)
                Text(
                    "Добавь людей: телефон, работа, расписание, увлечения и отношение.\nОбщие увлечения и работа соединятся на карте связей.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        } else {
            LazyColumn(
                Modifier.padding(pad).fillMaxSize(),
                contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 96.dp)
            ) {
                items(people, key = { it.id }) { p ->
                    val attColor = verdictColor(p.attitude)
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.padding(bottom = 8.dp).clickable { isNew = false; editing = p }
                    ) {
                        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                Modifier.size(44.dp).background(attColor.copy(alpha = 0.22f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(p.name.take(1).uppercase(), fontWeight = FontWeight.Bold, color = attColor, fontSize = 18.sp)
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(p.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                val sub = listOfNotNull(
                                    p.work.takeIf { it.isNotBlank() },
                                    p.phone.takeIf { it.isNotBlank() }
                                ).joinToString(" · ")
                                if (sub.isNotEmpty()) {
                                    Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                Text(
                                    "${p.attitude} · связей: ${links[p.id] ?: 0}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = attColor
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    editing?.let { p ->
        PersonEditor(
            initial = p,
            creating = isNew,
            onClose = { editing = null },
            onSave = { saved -> vm.save(saved); editing = null },
            onDelete = if (!isNew && p.id != 0L) { { vm.delete(p); editing = null } } else null
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PersonEditor(
    initial: PersonEntity,
    creating: Boolean,
    onClose: () -> Unit,
    onSave: (PersonEntity) -> Unit,
    onDelete: (() -> Unit)?
) {
    var name by remember { mutableStateOf(initial.name) }
    var phone by remember { mutableStateOf(initial.phone) }
    var work by remember { mutableStateOf(initial.work) }
    var schedule by remember { mutableStateOf(initial.schedule) }
    var attitude by remember { mutableStateOf(initial.attitude) }
    var attitudeNote by remember { mutableStateOf(initial.attitudeNote) }
    var notes by remember { mutableStateOf(initial.notes) }
    var hobbies by remember { mutableStateOf(parseHobbies(initial.hobbiesJson)) }
    var actions by remember { mutableStateOf(parseActions(initial.actionsJson)) }
    var addHobby by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onClose,
        confirmButton = {
            TextButton(onClick = {
                onSave(
                    initial.copy(
                        name = name.trim(), phone = phone.trim(), work = work.trim(),
                        schedule = schedule.trim(), attitude = attitude,
                        attitudeNote = attitudeNote.trim(), notes = notes.trim(),
                        hobbiesJson = hobbiesJson(hobbies), actionsJson = actionsJson(actions)
                    )
                )
            }) { Text("Сохранить") }
        },
        dismissButton = {
            Row {
                onDelete?.let { del -> TextButton(onClick = del) { Text("Удалить", color = Color(0xFFE5484D)) } }
                TextButton(onClick = onClose) { Text("Отмена") }
            }
        },
        title = { Text(if (creating) "Новый человек" else "Редактировать") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                OutlinedTextField(name, { name = it }, label = { Text("Имя") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(phone, { phone = it }, label = { Text("Телефон") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(work, { work = it }, label = { Text("Место работы/учёбы") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(schedule, { schedule = it }, label = { Text("Расписание (когда видитесь)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                Spacer(Modifier.height(8.dp))
                Text("Отношение", style = MaterialTheme.typography.labelLarge)
                Spacer(Modifier.height(4.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    VERDICTS.forEach { v ->
                        FilterChip(
                            selected = attitude == v,
                            onClick = { attitude = v },
                            label = { Text(v, fontSize = 12.sp) }
                        )
                    }
                }
                OutlinedTextField(attitudeNote, { attitudeNote = it }, label = { Text("Комментарий к отношению") }, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                Text("Увлечения (общие соединяют людей)", style = MaterialTheme.typography.labelLarge)
                Spacer(Modifier.height(4.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    hobbies.forEach { h ->
                        FilterChip(
                            selected = true,
                            onClick = { hobbies = hobbies - h },
                            label = { Text("✕ $h", fontSize = 12.sp) }
                        )
                    }
                    FilterChip(selected = false, onClick = { addHobby = true }, label = { Text("+ увлечение", fontSize = 12.sp) })
                }
                Spacer(Modifier.height(8.dp))
                Text("Поступки", style = MaterialTheme.typography.labelLarge)
                Spacer(Modifier.height(4.dp))
                actions.forEachIndexed { i, a ->
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.weight(1f)) {
                            OutlinedTextField(
                                a.date, { v -> actions = actions.toMutableList().also { it[i] = it[i].copy(date = v) } },
                                label = { Text("Дата") }, modifier = Modifier.fillMaxWidth(), singleLine = true
                            )
                            OutlinedTextField(
                                a.desc, { v -> actions = actions.toMutableList().also { it[i] = it[i].copy(desc = v) } },
                                label = { Text("Что сделал(а)") }, modifier = Modifier.fillMaxWidth(), singleLine = true
                            )
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            TextButton(onClick = {
                                val idx = VERDICTS.indexOf(a.rating).let { if (it < 0) 3 else it }
                                val next = VERDICTS[(idx + 1) % VERDICTS.size]
                                actions = actions.toMutableList().also { it[i] = it[i].copy(rating = next) }
                            }) {
                                Text(a.rating.take(10), fontSize = 11.sp, color = verdictColor(a.rating))
                            }
                            IconButton(onClick = { actions = actions.toMutableList().also { it.removeAt(i) } }) {
                                Icon(Icons.Default.Close, null, Modifier.size(16.dp))
                            }
                        }
                    }
                }
                TextButton(onClick = { actions = actions + PersonAction("", "", "нейтрально") }) { Text("+ поступок") }
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(notes, { notes = it }, label = { Text("Заметки") }, modifier = Modifier.fillMaxWidth())
            }
        }
    )

    if (addHobby) {
        var v by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { addHobby = false },
            confirmButton = {
                TextButton(onClick = {
                    if (v.isNotBlank()) hobbies = hobbies + v.trim()
                    addHobby = false
                }) { Text("Добавить") }
            },
            dismissButton = { TextButton(onClick = { addHobby = false }) { Text("Отмена") } },
            title = { Text("Увлечение") },
            text = { OutlinedTextField(v, { v = it }, label = { Text("Например: шахматы") }, singleLine = true) }
        )
    }
}
