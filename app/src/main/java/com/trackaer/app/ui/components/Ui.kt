package com.trackaer.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private val catPalette = listOf(
    Color(0xFF2DD4BF), Color(0xFF7DD3FC), Color(0xFFFBBF24), Color(0xFFF87171),
    Color(0xFFA78BFA), Color(0xFF34D399), Color(0xFFFB923C), Color(0xFF60A5FA),
    Color(0xFFF472B6), Color(0xFF94A3B8)
)

fun categoryColor(name: String): Color =
    catPalette[Math.abs(name.hashCode()) % catPalette.size]

@Composable
fun SectionCard(
    title: String? = null,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(Modifier.padding(16.dp)) {
            if (title != null) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(10.dp))
            }
            content()
        }
    }
}

@Composable
fun MetricTile(
    emoji: String,
    value: String,
    label: String,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        onClick = { onClick?.invoke() }
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(emoji, style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(8.dp))
            Text(
                value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                maxLines = 1
            )
            Text(
                label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1
            )
        }
    }
}

@Composable
fun EmptyHint(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(vertical = 12.dp)
    )
}

@Composable
fun LabeledValue(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
    }
}

/** Столбчатая диаграмма без внешних библиотек. */
@Composable
fun BarChart(
    values: List<Float>,
    labels: List<String>,
    modifier: Modifier = Modifier,
    target: Float? = null,
    accent: Color = MaterialTheme.colorScheme.primary
) {
    val outline = MaterialTheme.colorScheme.outline
    val labelColor = MaterialTheme.colorScheme.onSurfaceVariant
    val targetColor = MaterialTheme.colorScheme.tertiary
    val paint = remember {
        android.graphics.Paint().apply {
            isAntiAlias = true
            textSize = 26f
            textAlign = android.graphics.Paint.Align.CENTER
        }
    }
    paint.color = labelColor.toArgb()

    Canvas(modifier.fillMaxWidth().height(170.dp)) {
        if (values.isEmpty()) return@Canvas
        val bottom = size.height - 40f
        val maxV = maxOf(values.maxOrNull() ?: 1f, target ?: 0f, 1f)
        val n = values.size
        val slot = size.width / n
        val barW = slot * 0.55f
        values.forEachIndexed { i, v ->
            val h = (v / maxV) * (bottom - 16f)
            val x = slot * i + (slot - barW) / 2
            drawRoundRect(
                color = accent.copy(alpha = if (v > 0f) 1f else 0.22f),
                topLeft = Offset(x, bottom - h),
                size = Size(barW, h),
                cornerRadius = CornerRadius(8f, 8f)
            )
        }
        if (target != null && target > 0f) {
            val y = bottom - (target / maxV) * (bottom - 16f)
            drawLine(
                targetColor, Offset(0f, y), Offset(size.width, y),
                strokeWidth = 3f,
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 9f))
            )
        }
        drawLine(outline, Offset(0f, bottom), Offset(size.width, bottom), 2f)
        labels.forEachIndexed { i, l ->
            if (l.isNotEmpty() && (i % 3 == 0 || i == n - 1)) {
                drawContext.canvas.nativeCanvas.drawText(
                    l, slot * i + slot / 2, size.height - 10f, paint
                )
            }
        }
    }
}

/** Горизонтальные полосы по категориям. */
@Composable
fun CategoryBars(
    data: List<Pair<String, Long>>,
    formatValue: (Long) -> String
) {
    if (data.isEmpty()) return
    val max = data.maxOf { it.second }.coerceAtLeast(1)
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        data.forEach { (name, v) ->
            Column {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(name, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                    Text(
                        formatValue(v),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(Modifier.height(4.dp))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth((v.toFloat() / max).coerceIn(0.02f, 1f))
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(4.dp))
                            .background(categoryColor(name))
                    )
                }
            }
        }
    }
}

@Composable
fun IconActionButton(icon: ImageVector, desc: String, onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        Icon(icon, contentDescription = desc, tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
