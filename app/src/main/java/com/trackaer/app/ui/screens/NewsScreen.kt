package com.trackaer.app.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.trackaer.app.data.NewsRepo
import com.trackaer.app.ui.components.ScreenTopBar
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun NewsScreen(nav: NavHostController) {
    val ctx = LocalContext.current
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    var lang by remember { mutableStateOf("ru") }
    var loading by remember { mutableStateOf(true) }
    var items by remember { mutableStateOf<List<NewsRepo.NewsItem>>(emptyList()) }
    var failed by remember { mutableStateOf<List<String>>(emptyList()) }
    var err by remember { mutableStateOf("") }

    suspend fun load(force: Boolean) {
        loading = true; err = ""
        try {
            val feed = NewsRepo.fetch(ctx, lang, force)
            items = feed.items
            failed = feed.failed
        } catch (e: Exception) {
            err = e.message ?: "не удалось загрузить"
        }
        loading = false
    }

    LaunchedEffect(lang) { load(false) }

    Scaffold(
        topBar = {
            ScreenTopBar("Новости", nav, actions = {
                IconButton(onClick = { scope.launch { load(true) } }) {
                    Icon(Icons.Default.Refresh, "Обновить")
                }
            })
        }
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            FlowRow(
                Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                NewsRepo.LANGS.forEach { l ->
                    androidx.compose.material3.FilterChip(
                        selected = lang == l,
                        onClick = { lang = l },
                        label = { Text(NewsRepo.LANG_TITLES[l] ?: l, fontSize = 13.sp) }
                    )
                }
            }
            when {
                loading && items.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                err.isNotEmpty() && items.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Нет сети и нет сохранённых новостей\n$err", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                else -> {
                    if (failed.isNotEmpty()) {
                        Text(
                            "Не ответили: ${failed.joinToString()}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                        )
                    }
                    LazyColumn(
                        Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 20.dp)
                    ) {
                        itemsIndexed(items) { i, n ->
                            Card(
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier
                                    .padding(bottom = 8.dp)
                                    .clickable {
                                        if (n.link.isNotBlank()) {
                                            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(n.link)))
                                        }
                                    }
                            ) {
                                Column(Modifier.padding(12.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            n.source,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = MaterialTheme.colorScheme.primary,
                                            modifier = Modifier
                                                .background(
                                                    MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                                                    RoundedCornerShape(6.dp)
                                                )
                                                .padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                        Spacer(Modifier.width(8.dp))
                                        Text(
                                            n.date.take(22),
                                            fontSize = 11.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    Text(n.title, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
