package com.trackaer.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.trackaer.app.data.RatesRepo
import com.trackaer.app.ui.components.ScreenTopBar
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val CURRENCIES = listOf("KZT") + RatesRepo.RATE_LIST

private fun symbol(c: String) = RatesRepo.SYMBOLS[c] ?: c

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun RatesScreen(nav: NavHostController) {
    val scope = rememberCoroutineScope()
    var market by remember { mutableStateOf<RatesRepo.Market?>(null) }
    var loading by remember { mutableStateOf(true) }
    var err by remember { mutableStateOf("") }

    var fromCur by remember { mutableStateOf("USD") }
    var toCur by remember { mutableStateOf("KZT") }
    var fromAmt by remember { mutableStateOf("100") }
    var toAmt by remember { mutableStateOf("") }

    fun rateOf(c: String): Double? {
        val m = market ?: return null
        if (c == "KZT") return 1.0
        return m.rates[c]
    }

    fun convert(f: String, t: String, amount: Double): String {
        val rf = rateOf(f) ?: return ""
        val rt = rateOf(t) ?: return ""
        val kzt = amount * rf
        val v = kzt / rt
        return if (v >= 100) String.format(Locale.US, "%.2f", v) else String.format(Locale.US, "%.4f", v).trimEnd('0').trimEnd('.')
    }

    fun refresh(force: Boolean) {
        scope.launch {
            loading = true; err = ""
            market = RatesRepo.fetch(nav.context, force)
            if (market == null) err = "Нет сети. Последние сохранённые курсы не найдены."
            toAmt = convert(fromCur, toCur, fromAmt.toDoubleOrNull() ?: 0.0)
            loading = false
        }
    }

    LaunchedEffect(Unit) { refresh(false) }

    Scaffold(
        topBar = {
            ScreenTopBar("Обмен валюты", nav, actions = {
                IconButton(onClick = { refresh(true) }) { Icon(Icons.Default.Refresh, "Обновить") }
            })
        }
    ) { pad ->
        LazyColumn(
            Modifier.padding(pad).fillMaxSize(),
            contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 24.dp)
        ) {
            item {
                val m = market
                Text(
                    when {
                        m != null -> "${m.src} · ${m.date.take(10)}"
                        loading -> "Загрузка курсов…"
                        else -> "Курсы недоступны"
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (err.isNotEmpty()) {
                    Text(err, style = MaterialTheme.typography.bodySmall, color = Color(0xFFE5484D))
                }
                Spacer(Modifier.height(8.dp))
                if (loading && m == null) {
                    Row(Modifier.fillMaxWidth().padding(vertical = 20.dp), horizontalArrangement = Arrangement.Center) {
                        CircularProgressIndicator()
                    }
                } else if (m != null) {
                    RatesRepo.RATE_LIST.forEach { c ->
                        val rate = m.rates[c] ?: return@forEach
                        val ch = m.change[c] ?: 0.0
                        Card(Modifier.padding(bottom = 6.dp)) {
                            Row(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text(symbol(c), fontSize = 18.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.width(10.dp))
                                Text(c, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                Spacer(Modifier.weight(1f))
                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        "${"%.2f".format(rate)} ₸",
                                        style = MaterialTheme.typography.titleMedium
                                    )
                                    Text(
                                        "за 1 $c · $ch",
                                        fontSize = 11.sp,
                                        color = when {
                                            ch > 0.0001 -> Color(0xFF7FBF7F)
                                            ch < -0.0001 -> Color(0xFFE5484D)
                                            else -> MaterialTheme.colorScheme.onSurfaceVariant
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(14.dp))
                Text("Конвертер", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                Card {
                    Column(Modifier.padding(14.dp)) {
                        Text("Отдаёшь", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                fromAmt,
                                { v ->
                                    fromAmt = v
                                    toAmt = convert(fromCur, toCur, v.toDoubleOrNull() ?: 0.0)
                                },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                            )
                            Spacer(Modifier.width(8.dp))
                            CurrencyPick(fromCur, CURRENCIES) { c ->
                                fromCur = c
                                toAmt = convert(fromCur, toCur, fromAmt.toDoubleOrNull() ?: 0.0)
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            OutlinedIconButton(onClick = {
                                val f = fromCur; fromCur = toCur; toCur = f
                                val a = fromAmt
                                fromAmt = toAmt
                                toAmt = convert(fromCur, toCur, fromAmt.toDoubleOrNull() ?: 0.0)
                            }) { Text("⇄", fontSize = 18.sp) }
                            Spacer(Modifier.width(8.dp))
                            Text("↕", fontSize = 18.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Spacer(Modifier.height(10.dp))
                        Text("Получаешь", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                toAmt,
                                { v ->
                                    toAmt = v
                                    fromAmt = convert(toCur, fromCur, v.toDoubleOrNull() ?: 0.0)
                                },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                            )
                            Spacer(Modifier.width(8.dp))
                            CurrencyPick(toCur, CURRENCIES) { c ->
                                toCur = c
                                toAmt = convert(fromCur, toCur, fromAmt.toDoubleOrNull() ?: 0.0)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    "Курс: 1 ${symbol(fromCur)} ${fromCur} = ${
                        convert(fromCur, toCur, 1.0).ifBlank { "…" }
                    } ${symbol(toCur)} ${toCur}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CurrencyPick(current: String, options: List<String>, onPick: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Button(onClick = { open = true }) { Text("$current ${symbol(current)}") }
    if (open) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { open = false },
            confirmButton = {},
            title = { Text("Валюта") },
            text = {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    options.forEach { c ->
                        FilterChip(
                            selected = c == current,
                            onClick = { onPick(c); open = false },
                            label = { Text("$c ${symbol(c)}") }
                        )
                    }
                }
            }
        )
    }
}
