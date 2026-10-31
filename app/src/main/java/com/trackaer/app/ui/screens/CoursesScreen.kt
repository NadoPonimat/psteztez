package com.trackaer.app.ui.screens

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
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.trackaer.app.data.Course
import com.trackaer.app.ui.components.ScreenTopBar
import com.trackaer.app.vm.CoursesViewModel

@Composable
fun CoursesScreen(nav: NavHostController) {
    val vm: CoursesViewModel = viewModel()
    val courses by vm.courses.collectAsState()
    val progress by vm.progress.collectAsState()
    var filter by remember { mutableStateOf("Все") }
    val cats = remember(courses) { listOf("Все") + courses.map { it.category }.distinct().sorted() }
    val filtered = if (filter == "Все") courses else courses.filter { it.category == filter }

    Scaffold(topBar = { ScreenTopBar("Курсы") }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            Row(
                Modifier
                    .padding(horizontal = 16.dp, vertical = 4.dp)
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                cats.forEach { c ->
                    FilterChip(
                        selected = filter == c,
                        onClick = { filter = c },
                        label = { Text(c, fontSize = 12.sp) }
                    )
                }
            }
            if (courses.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 20.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(filtered, key = { it.id }) { c ->
                        val total = c.lessonCount
                        val done = progress.count { it.courseId == c.id && it.completedAt > 0 }
                        CourseCard(c, done, total) { nav.navigate("course/" + c.id) }
                    }
                }
            }
        }
    }
}

@Composable
private fun CourseCard(c: Course, done: Int, total: Int, onClick: () -> Unit) {
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        onClick = onClick
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(c.emoji, fontSize = 26.sp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        c.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        "${c.category} · ${c.level} · ≈${c.estimatedHours} ч",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
            LinearProgressIndicator(
                progress = { if (total > 0) done.toFloat() / total else 0f },
                modifier = Modifier.fillMaxWidth().height(6.dp),
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )
            Spacer(Modifier.height(6.dp))
            Text(
                if (done > 0) "пройдено $done из $total уроков" else "$total уроков",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
