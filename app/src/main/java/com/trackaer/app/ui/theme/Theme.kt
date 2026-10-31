package com.trackaer.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColors = darkColorScheme(
    primary = Color(0xFF2DD4BF),
    onPrimary = Color(0xFF04211D),
    primaryContainer = Color(0xFF115E59),
    onPrimaryContainer = Color(0xFFCCFBF1),
    secondary = Color(0xFF7DD3FC),
    onSecondary = Color(0xFF082F49),
    tertiary = Color(0xFFFBBF24),
    onTertiary = Color(0xFF422006),
    background = Color(0xFF101418),
    onBackground = Color(0xFFE7ECF1),
    surface = Color(0xFF171C22),
    onSurface = Color(0xFFE7ECF1),
    surfaceVariant = Color(0xFF1E252D),
    onSurfaceVariant = Color(0xFFA9B4BE),
    outline = Color(0xFF39434D),
    error = Color(0xFFF87171)
)

private val LightColors = androidx.compose.material3.lightColorScheme(
    primary = Color(0xFF0F766E),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFF0369A1),
    tertiary = Color(0xFFB45309),
    background = Color(0xFFF6F8FA),
    onBackground = Color(0xFF17202A),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF17202A),
    surfaceVariant = Color(0xFFE8EDF2),
    onSurfaceVariant = Color(0xFF4A5560),
    outline = Color(0xFFB3BEC7),
    error = Color(0xFFB91C1C)
)

@Composable
fun TrackaerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content
    )
}
