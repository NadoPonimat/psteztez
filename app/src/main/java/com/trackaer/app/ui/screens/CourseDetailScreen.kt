package com.trackaer.app.ui.screens

import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.trackaer.app.ui.components.IconActionButton
import com.trackaer.app.ui.components.ScreenTopBar
import com.trackaer.app.ui.components.SectionCard
import com.trackaer.app.vm.CoursesViewModel

@Composable
fun CourseDetailScreen(nav: NavHostController, courseId: String) {
    val vm: CoursesViewModel = viewModel()
    val courses by vm.courses.collectAsState()
    val progress by vm.progress.collectAsState()
    val course = courses.firstOrNull { it.id == courseId }

    if (course == null) {
        Scaffold(topBar = { ScreenTopBar("Курс", nav) }) { pad ->
            Box(Modifier.padding(pad).fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
        return
    }

    val doneIds = progress
        .filter { it.courseId == courseId && it.completedAt > 0 }
        .mapTo(HashSet()) { it.lessonId }
    val allLessons = course.modules.flatMap { it.lessons }
    val next = allLessons.firstOrNull { it.id !in doneIds }

    Scaffold(
        topBar = {
            ScreenTopBar(course.title, nav) {
                IconActionButton(Icons.Default.Refresh, "Сбросить прогресс") {
                    vm.resetCourse(courseId)
                }
            }
        }
    ) { pad ->
        Column(
            Modifier
                .padding(pad)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                course.emoji + "  " + course.category + " · " + course.level,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (course.about.isNotBlank()) {
                Text(course.about, style = MaterialTheme.typography.bodyMedium)
            }
            Text(
                "≈ ${course.estimatedHours} ч · ${course.lessonCount} уроков · пройдено ${doneIds.size}",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold
            )
            LinearProgressIndicator(
                progress = {
                    (doneIds.size.toDouble() / course.lessonCount.coerceAtLeast(1)).toFloat()
                },
                modifier = Modifier.fillMaxWidth().height(8.dp),
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )
            if (next != null) {
                FilledTonalButton(
                    onClick = { nav.navigate("lesson/$courseId/${next.id}") },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        if (doneIds.isEmpty()) "Начать курс" else "Продолжить",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
            course.modules.forEach { m ->
                SectionCard(m.title) {
                    if (m.summary.isNotBlank()) {
                        Text(
                            m.summary,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(Modifier.height(8.dp))
                    }
                    m.lessons.forEach { l ->
                        val done = l.id in doneIds
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clickable { nav.navigate("lesson/$courseId/${l.id}") }
                                .padding(vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(if (done) "✅" else "⬜", fontSize = 16.sp)
                            Column(Modifier.weight(1f).padding(start = 8.dp)) {
                                Text(
                                    l.title,
                                    style = MaterialTheme.typography.bodyLarge,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    "≈ ${l.minutes} мин",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Text("→", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}
