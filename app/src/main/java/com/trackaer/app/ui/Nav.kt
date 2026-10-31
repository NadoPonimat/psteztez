package com.trackaer.app.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.trackaer.app.ui.screens.BookReaderScreen
import com.trackaer.app.ui.screens.CourseDetailScreen
import com.trackaer.app.ui.screens.CoursesScreen
import com.trackaer.app.ui.screens.FinanceScreen
import com.trackaer.app.ui.screens.FoodScreen
import com.trackaer.app.ui.screens.HabitsScreen
import com.trackaer.app.ui.screens.HomeScreen
import com.trackaer.app.ui.screens.LessonScreen
import com.trackaer.app.ui.screens.MoreScreen
import com.trackaer.app.ui.screens.NewsScreen
import com.trackaer.app.ui.screens.PeopleGraphScreen
import com.trackaer.app.ui.screens.PeopleScreen
import com.trackaer.app.ui.screens.PhrasebookScreen
import com.trackaer.app.ui.screens.RatesScreen
import com.trackaer.app.ui.screens.SettingsScreen
import com.trackaer.app.ui.screens.StatsScreen
import com.trackaer.app.ui.screens.StudyScreen
import com.trackaer.app.ui.screens.WorkoutScreen

private data class Tab(val route: String, val emoji: String, val label: String)

private val tabs = listOf(
    Tab("home", "🏠", "Главная"),
    Tab("courses", "📚", "Курсы"),
    Tab("stats", "📈", "Статистика"),
    Tab("more", "⚙️", "Ещё")
)

@Composable
fun AppRoot() {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route
    val showBottom = route in tabs.map { it.route }.toSet()

    Scaffold(
        bottomBar = {
            if (showBottom) {
                NavigationBar {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = route == tab.route,
                            onClick = {
                                nav.navigate(tab.route) {
                                    popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Text(tab.emoji, fontSize = 20.sp) },
                            label = { Text(tab.label) }
                        )
                    }
                }
            }
        }
    ) { pad ->
        NavHost(
            navController = nav,
            startDestination = "splash",
            modifier = Modifier.padding(pad)
        ) {
            composable("splash") {
                SplashScreen(
                    onDone = {
                        nav.navigate("home") {
                            popUpTo("splash") { inclusive = true }
                        }
                    }
                )
            }
            composable("home") { HomeScreen(nav) }
            composable("courses") { CoursesScreen(nav) }
            composable("stats") { StatsScreen() }
            composable("more") { MoreScreen(nav) }
            composable("habits") { HabitsScreen() }
            composable("finance") { FinanceScreen() }
            composable("workout") { WorkoutScreen() }
            composable("study") { StudyScreen(nav) }
            composable("food") { FoodScreen() }
            composable("settings") { SettingsScreen() }
            composable("people") { PeopleScreen(nav) }
            composable("peopleGraph") { PeopleGraphScreen(nav) }
            composable("phrasebook") { PhrasebookScreen(nav) }
            composable("news") { NewsScreen(nav) }
            composable("rates") { RatesScreen(nav) }
            composable(
                "reader/{bookId}",
                arguments = listOf(navArgument("bookId") { type = NavType.LongType })
            ) { be ->
                BookReaderScreen(nav, be.arguments?.getLong("bookId") ?: 0L)
            }
            composable(
                "course/{courseId}",
                arguments = listOf(navArgument("courseId") { type = NavType.StringType })
            ) { be ->
                CourseDetailScreen(nav, be.arguments?.getString("courseId") ?: "")
            }
            composable(
                "lesson/{courseId}/{lessonId}",
                arguments = listOf(
                    navArgument("courseId") { type = NavType.StringType },
                    navArgument("lessonId") { type = NavType.StringType }
                )
            ) { be ->
                LessonScreen(
                    nav,
                    be.arguments?.getString("courseId") ?: "",
                    be.arguments?.getString("lessonId") ?: ""
                )
            }
        }
    }
}
