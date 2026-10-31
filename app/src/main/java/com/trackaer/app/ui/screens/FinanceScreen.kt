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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.trackaer.app.data.db.DebtEntity
import com.trackaer.app.data.db.JarEntity
import com.trackaer.app.data.db.TxEntity
import com.trackaer.app.ui.components.EmptyHint
import com.trackaer.app.ui.components.IconActionButton
import com.trackaer.app.ui.components.ScreenTopBar
import com.trackaer.app.ui.components.SectionCard
import com.trackaer.app.util.Fmt
import com.trackaer.app.util.Fmt.dayShort
import com.trackaer.app.vm.FinanceViewModel
import com.trackaer.app.vm.todayDay

@Composable
fun FinanceScreen() {
    val vm: FinanceViewModel = viewModel()
    val settings by vm.settings.collectAsState()
    val balance by vm.balance.collectAsState()
    val income by vm.incomeMonth.collectAsState()
    val expense by vm.expenseMonth.collectAsState()
    val tx by vm.tx.collectAsState()
    val jars by vm.jars.collectAsState()
    val debts by vm.debts.collectAsState()

    var tab by remember { mutableIntStateOf(0) }
    var showTx by remember { mutableStateOf(false) }
    var showJar by remember { mutableStateOf(false) }
    var showDebt by remember { mutableStateOf(false) }

    Scaffold(
        topBar = { ScreenTopBar("Финансы") },
        floatingActionButton = {
            FloatingActionButton(onClick = {
                when (tab) { 0 -> showTx = true; 1 -> showJar = true; else -> showDebt = true }
            }) { Icon(Icons.Default.Add, contentDescription = "Добавить") }
        }
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            Card(
                Modifier.fillMaxWidth().padding(16.dp, 12.dp),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text(
                        "Баланс",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        Fmt.money(balance, settings.currency),
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(
                            "↑ доходы " + Fmt.money(income, settings.currency),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        Text(
                            "↓ расходы " + Fmt.money(expense, settings.currency),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }

            TabRow(selectedTabIndex = tab) {
                listOf("Кошелёк", "Копилки", "Долги").forEachIndexed { i, t ->
                    Tab(selected = tab == i, onClick = { tab = i }, text = { Text(t) })
                }
            }

            when (tab) {
                0 -> if (tx.isEmpty()) EmptyHint("Операций пока нет.") else TxList(tx, settings.currency) { vm.deleteTx(it) }
                1 -> if (jars.isEmpty()) EmptyHint("Копилок нет. Добавь цель — «Подушка», «Ноутбук», «Отпуск».") else JarList(jars, settings.currency, vm)
                else -> if (debts.isEmpty()) EmptyHint("Долгов нет. И пусть так и остаётся 🙂") else DebtList(debts, settings.currency, vm)
            }
        }
    }

    if (showTx) {
        TxDialog(
            onSave = { type, amount, cat, note -> vm.addTx(type, amount, cat, note); showTx = false },
            onDismiss = { showTx = false }
        )
    }
    if (showJar) {
        JarDialog(
            onSave = { name, emoji, goal -> vm.addJar(name, emoji, goal); showJar = false },
            onDismiss = { showJar = false }
        )
    }
    if (showDebt) {
        DebtDialog(
            onSave = { dir, person, amount, note -> vm.addDebt(dir, person, amount, note); showDebt = false },
            onDismiss = { showDebt = false }
        )
    }
}

@Composable
private fun TxList(list: List<TxEntity>, currency: String, onDelete: (TxEntity) -> Unit) {
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 90.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(list, key = { it.id }) { t ->
            val isIn = t.type == "in"
            Card(shape = RoundedCornerShape(14.dp)) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(t.category, style = MaterialTheme.typography.titleSmall)
                        if (t.note.isNotBlank()) {
                            Text(
                                t.note,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1
                            )
                        }
                        Text(
                            dayShort(t.day),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Text(
                        (if (isIn) "+" else "−") + Fmt.money(t.amount, currency),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = if (isIn) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                    )
                    IconActionButton(Icons.Default.Delete, "Удалить") { onDelete(t) }
                }
            }
        }
    }
}

@Composable
private fun JarList(list: List<JarEntity>, currency: String, vm: FinanceViewModel) {
    var amountFor by remember { mutableStateOf<JarEntity?>(null) }
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 90.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        items(list, key = { it.id }) { j ->
            val frac = if (j.goal > 0) (j.saved.toDouble() / j.goal).coerceIn(0.0, 1.0) else 0.0
            Card(shape = RoundedCornerShape(16.dp)) {
                Column(Modifier.padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(j.emoji, fontSize = 20.sp)
                        Spacer(Modifier.width(8.dp))
                        Column(Modifier.weight(1f)) {
                            Text(j.name, style = MaterialTheme.typography.titleSmall)
                            Text(
                                "${Fmt.money(j.saved, currency)} из ${Fmt.money(j.goal, currency)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        IconActionButton(Icons.Default.Delete, "Убрать копилку") { vm.archiveJar(j.id) }
                    }
                    LinearProgressIndicator(
                        progress = { frac.toFloat() },
                        modifier = Modifier.fillMaxWidth().height(8.dp),
                        trackColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilledTonalButtonTextCompat("Положить") { amountFor = j }
                        TextButton(onClick = { amountFor = j }) { Text("Снять") }
                    }
                }
            }
        }
    }
    amountFor?.let { j ->
        AmountDialog(
            title = j.name,
            onConfirm = { amount ->
                vm.changeJar(j.id, amount)
                amountFor = null
            },
            onDismiss = { amountFor = null }
        )
    }
}

@Composable
private fun FilledTonalButtonTextCompat(text: String, onClick: () -> Unit) {
    androidx.compose.material3.FilledTonalButton(onClick = onClick) { Text(text) }
}

@Composable
private fun DebtList(list: List<DebtEntity>, currency: String, vm: FinanceViewModel) {
    var payFor by remember { mutableStateOf<DebtEntity?>(null) }
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 90.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        items(list, key = { it.id }) { d ->
            val given = d.direction == "given"
            val frac = if (d.amount > 0) (d.paid.toDouble() / d.amount).coerceIn(0.0, 1.0) else 0.0
            Card(shape = RoundedCornerShape(16.dp)) {
                Column(Modifier.padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                if (given) "🟢 Мне должны: ${d.person}" else "🔴 Я должен: ${d.person}",
                                style = MaterialTheme.typography.titleSmall
                            )
                            Text(
                                "${Fmt.money(d.paid, currency)} из ${Fmt.money(d.amount, currency)} возвращено",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        IconActionButton(Icons.Default.Delete, "Удалить") { vm.deleteDebt(d) }
                    }
                    LinearProgressIndicator(
                        progress = { frac.toFloat() },
                        modifier = Modifier.fillMaxWidth().height(6.dp),
                        trackColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { payFor = d }) { Text("Платёж") }
                        TextButton(onClick = { vm.setDebtClosed(d.id, !d.closed) }) {
                            Text(if (d.closed) "Вернуть в список" else "Закрыт")
                        }
                    }
                }
            }
        }
    }
    payFor?.let { d ->
        AmountDialog(
            title = d.person,
            onConfirm = { amount ->
                vm.changeDebtPaid(d.id, amount)
                payFor = null
            },
            onDismiss = { payFor = null }
        )
    }
}

@Composable
private fun TxDialog(onSave: (String, Long, String, String) -> Unit, onDismiss: () -> Unit) {
    var isIncome by remember { mutableStateOf(false) }
    var amount by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Продукты") }
    var note by remember { mutableStateOf("") }
    val cats = if (isIncome)
        listOf("Зарплата", "Чаевые", "Продажа", "Прочее")
    else
        listOf("Продукты", "Кафе", "Транспорт", "Дом", "Здоровье", "Связь", "Одежда", "Развлечения", "Прочее")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Новая операция") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected = !isIncome, onClick = { isIncome = false; category = "Продукты" }, label = { Text("Расход") })
                    FilterChip(selected = isIncome, onClick = { isIncome = true; category = "Зарплата" }, label = { Text("Доход") })
                }
                OutlinedTextField(
                    value = amount, onValueChange = { amount = it },
                    label = { Text("Сумма") }, singleLine = true
                )
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    cats.forEach { c ->
                        FilterChip(
                            selected = category == c,
                            onClick = { category = c },
                            label = { Text(c, fontSize = 12.sp) }
                        )
                    }
                }
                OutlinedTextField(
                    value = note, onValueChange = { note = it },
                    label = { Text("Заметка") }, singleLine = true
                )
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val m = Fmt.parseAmount(amount)
                if (m != null && m > 0) onSave(if (isIncome) "in" else "out", m, category, note)
            }) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}

@Composable
private fun JarDialog(onSave: (String, String, Long) -> Unit, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var goal by remember { mutableStateOf("") }
    var emoji by remember { mutableStateOf("🏺") }
    val emojis = listOf("🏺", "🛒", "💻", "✈️", "🏠", "🚗", "🎓", "🎁")
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Новая копилка") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Название") }, singleLine = true)
                OutlinedTextField(value = goal, onValueChange = { goal = it }, label = { Text("Цель, сумма") }, singleLine = true)
                Row(
                    Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    emojis.forEach { e ->
                        FilterChip(selected = emoji == e, onClick = { emoji = e }, label = { Text(e, fontSize = 18.sp) })
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val g = Fmt.parseAmount(goal)
                if (name.isNotBlank() && g != null && g > 0) onSave(name, emoji, g)
            }) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}

@Composable
private fun DebtDialog(onSave: (String, String, Long, String) -> Unit, onDismiss: () -> Unit) {
    var given by remember { mutableStateOf(true) }
    var person by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Новый долг") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected = given, onClick = { given = true }, label = { Text("Мне должны") })
                    FilterChip(selected = !given, onClick = { given = false }, label = { Text("Я должен") })
                }
                OutlinedTextField(value = person, onValueChange = { person = it }, label = { Text("Кто") }, singleLine = true)
                OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Сумма") }, singleLine = true)
                OutlinedTextField(value = note, onValueChange = { note = it }, label = { Text("Заметка") }, singleLine = true)
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val m = Fmt.parseAmount(amount)
                if (person.isNotBlank() && m != null && m > 0)
                    onSave(if (given) "given" else "taken", person, m, note)
            }) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}

@Composable
private fun AmountDialog(title: String, onConfirm: (Long) -> Unit, onDismiss: () -> Unit) {
    var amount by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = amount, onValueChange = { amount = it },
                label = { Text("Сумма (со знаком минус — снятие)") }, singleLine = true
            )
        },
        confirmButton = {
            TextButton(onClick = {
                val m = Fmt.parseAmount(amount.removePrefix("-"))
                if (m != null && m > 0) onConfirm(if (amount.startsWith("-")) -m else m)
            }) { Text("ОК") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}
