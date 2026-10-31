package com.trackaer.app.ui.screens

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
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.trackaer.app.ui.components.ScreenTopBar
import com.trackaer.app.ui.components.SectionCard
import com.trackaer.app.vm.CoursesViewModel

@Composable
fun LessonScreen(nav: NavHostController, courseId: String, lessonId: String) {
    val vm: CoursesViewModel = viewModel()
    val courses by vm.courses.collectAsState()
    val progress by vm.progress.collectAsState()
    val course = courses.firstOrNull { it.id == courseId }

    if (course == null) {
        Scaffold(topBar = { ScreenTopBar("Урок", nav) }) { pad ->
            Box(Modifier.padding(pad).fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
        return
    }

    val allLessons = course.modules.flatMap { m -> m.lessons }
    val idx = allLessons.indexOfFirst { it.id == lessonId }
    if (idx < 0) {
        Scaffold(topBar = { ScreenTopBar("Урок", nav) }) { pad ->
            Box(Modifier.padding(pad).fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Урок не найден", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        return
    }

    val lesson = allLessons[idx]
    val prev = allLessons.getOrNull(idx - 1)
    val nextL = allLessons.getOrNull(idx + 1)
    val done = progress.any {
        it.courseId == courseId && it.lessonId == lessonId && it.completedAt > 0
    }

    Scaffold(topBar = { ScreenTopBar("Урок ${idx + 1} из ${allLessons.size}", nav) }) { pad ->
        Column(
            Modifier
                .padding(pad)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                lesson.title,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            Text(
                "⏱ ≈ ${lesson.minutes} мин" + if (done) " · пройден ✅" else "",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (lesson.intro.isNotBlank()) {
                SectionCard("Как устроен урок") {
                    Text(lesson.intro, style = MaterialTheme.typography.bodyMedium)
                }
            }

            lesson.sections.forEach { s ->
                when (s.kind) {
                    "part" -> {
                        Text(
                            s.heading ?: "",
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Bold
                        )
                        HorizontalDivider()
                    }
                    "para" -> Column {
                        if (!s.heading.isNullOrBlank()) {
                            Text(
                                s.heading,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(Modifier.height(4.dp))
                        }
                        Text(
                            s.text ?: "",
                            style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 24.sp)
                        )
                    }
                    "practice" -> SectionCard(s.heading ?: "Практика") {
                        s.items.forEach { item ->
                            Text(item, style = MaterialTheme.typography.bodyMedium)
                            Spacer(Modifier.height(6.dp))
                        }
                    }
                    "cheatsheet" -> SectionCard(s.heading ?: "Шпаргалка") {
                        Text(
                            s.text ?: "",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                    "selfcheck" -> SectionCard(s.heading ?: "Проверь себя") {
                        Text(
                            "Ответь вслух или письменно — эти вопросы работают как карточки интервального повторения.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(Modifier.height(8.dp))
                        s.items.forEach { item ->
                            Text(item, style = MaterialTheme.typography.bodyMedium)
                            Spacer(Modifier.height(6.dp))
                        }
                    }
                    else -> {
                        if (!s.heading.isNullOrBlank()) {
                            Text(
                                s.heading,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        Text(
                            s.text ?: "",
                            style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 24.sp)
                        )
                    }
                }
            }

            Button(
                onClick = { if (!done) vm.markDone(courseId, lessonId) },
                modifier = Modifier.fillMaxWidth(),
                enabled = !done
            ) {
                Text(if (done) "Пройден ✓" else "Отметить пройденным")
            }

            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                TextButton(
                    onClick = {
                        prev?.let {
                            nav.navigate("lesson/$courseId/${it.id}") {
                                popUpTo("lesson/$courseId/$lessonId") { inclusive = true }
                            }
                        }
                    },
                    enabled = prev != null
                ) { Text("← Назад") }
                TextButton(
                    onClick = {
                        if (!done) vm.markDone(courseId, lessonId)
                        nextL?.let {
                            nav.navigate("lesson/$courseId/${it.id}") {
                                popUpTo("lesson/$courseId/$lessonId") { inclusive = true }
                            }
                        }
                    },
                    enabled = nextL != null
                ) { Text("Далее →") }
            }
            Spacer(Modifier.height(28.dp))
        }
    }
}
