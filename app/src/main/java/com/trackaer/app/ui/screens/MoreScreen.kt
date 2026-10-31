package com.trackaer.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.trackaer.app.ui.components.ScreenTopBar

private data class MoreItem(val emoji: String, val title: String, val subtitle: String, val route: String)

private val moreItems = listOf(
    MoreItem("✅", "Привычки", "серии и прогресс за 14 дней", "habits"),
    MoreItem("💰", "Финансы", "кошелёк, копилки, долги", "finance"),
    MoreItem("💪", "Тренировки", "журнал занятий за 30 дней", "workout"),
    MoreItem("📖", "Учёба", "занятия, книги, слова, план", "study"),
    MoreItem("🍽️", "Питание", "калории и БЖУ", "food"),
    MoreItem("🗣", "Разговорник", "ситуации, диалоги, заучивание", "phrasebook"),
    MoreItem("🕸", "Люди", "карта связей, увлечения, отношение", "people"),
    MoreItem("📰", "Новости", "живые ленты: ru, en, ar, es", "news"),
    MoreItem("💱", "Обмен валюты", "курсы Нацбанка РК + конвертер", "rates"),
    MoreItem("⚙️", "Настройки", "анимация входа, напоминания, валюта", "settings")
)

@Composable
fun MoreScreen(nav: NavHostController) {
    Scaffold(topBar = { ScreenTopBar("Ещё") }) { pad ->
        LazyColumn(
            Modifier.padding(pad).fillMaxSize(),
            contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 20.dp)
        ) {
            items(moreItems, key = { it.route }) { item ->
                Card(
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.padding(bottom = 8.dp),
                    onClick = { nav.navigate(item.route) }
                ) {
                    Row(
                        Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(item.emoji, fontSize = 22.sp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                item.title,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                item.subtitle,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Text("→", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}
