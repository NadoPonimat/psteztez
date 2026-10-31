package com.trackaer.app.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.trackaer.app.ui.components.ScreenTopBar
import com.trackaer.app.vm.PeopleViewModel
import com.trackaer.app.vm.sharedItems
import kotlin.math.sqrt

private data class GNode(val id: Long, val name: String, var x: Float, var y: Float, var vx: Float = 0f, var vy: Float = 0f)
private data class GEdge(val a: Long, val b: Long, val label: String)

/**
 * Карта связей людей, как в старой версии: пружинная раскладка
 * (узлы отталкиваются, рёбра притягивают), узлы можно таскать,
 * карта масштабируется щипком и двигается пальцем.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PeopleGraphScreen(nav: NavHostController) {
    val vm: PeopleViewModel = viewModel()
    val people by vm.people.collectAsState()

    var nodes by remember(people) { mutableStateOf(layout(people)) }
    var scale by remember { mutableStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    var draggingId by remember { mutableStateOf<Long?>(null) }

    fun toWorld(p: Offset, sizePx: Offset): Offset =
        Offset((p.x - sizePx.x / 2 - offset.x) / scale, (p.y - sizePx.y / 2 - offset.y) / scale)

    fun hit(p: Offset, sizePx: Offset): Long? {
        val w = toWorld(p, sizePx)
        val r = 34f / scale.coerceAtLeast(0.05f)
        return nodes.minByOrNull { n -> (n.x - w.x) * (n.x - w.x) + (n.y - w.y) * (n.y - w.y) }
            ?.takeIf { n -> sqrt((n.x - w.x) * (n.x - w.x) + (n.y - w.y) * (n.y - w.y)) <= r * 1.6f }?.id
    }

    Scaffold(
        topBar = { ScreenTopBar("Карта связей", nav) },
        floatingActionButton = {
            ExtendedFloatingActionButton(onClick = {
                if (nodes.isNotEmpty()) {
                    val minX = nodes.minOf { it.x }; val maxX = nodes.maxOf { it.x }
                    val minY = nodes.minOf { it.y }; val maxY = nodes.maxOf { it.y }
                    // вписать в ~0.8 экрана: масштаб считаем на следующем кадре по центру масс
                    offset = Offset(
                        -((minX + maxX) / 2f),
                        -((minY + maxY) / 2f)
                    )
                    val spanX = (maxX - minX).coerceAtLeast(100f)
                    val spanY = (maxY - minY).coerceAtLeast(100f)
                    scale = 1f.coerceAtMost(560f / maxOf(spanX, spanY))
                }
            }) { Text("Вписать") }
        }
    ) { pad ->
        Box(
            Modifier
                .padding(pad)
                .fillMaxSize()
                .background(Color(0xFF0C1014))
        ) {
            if (people.isEmpty()) {
                Column(
                    Modifier.fillMaxSize().padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Spacer(Modifier.padding(48.dp))
                    Text(
                        "Нет людей для карты",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color(0xFFF8FAFC)
                    )
                    Text(
                        "Добавь людей и общие увлечения — они соединятся линиями",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF8B98A5)
                    )
                }
            } else {
                Canvas(
                    Modifier
                        .fillMaxSize()
                        .pointerInput(nodes, scale) {
                            detectTransformGestures { _, pan, zoom, _ ->
                                scale = (scale * zoom).coerceIn(0.2f, 4f)
                                offset += pan
                            }
                        }
                        .pointerInput(nodes) {
                            detectDragGestures(
                                onDragStart = { p ->
                                    draggingId = hit(p, Offset(size.width.toFloat(), size.height.toFloat()))
                                },
                                onDragEnd = { draggingId = null },
                                onDragCancel = { draggingId = null },
                                onDrag = { change, drag ->
                                    change.consume()
                                    if (draggingId != null) {
                                        val n = nodes.firstOrNull { it.id == draggingId } ?: return@detectDragGestures
                                        n.x += drag.x / scale
                                        n.y += drag.y / scale
                                        nodes = nodes.toList() // триггер перерисовки
                                    } else {
                                        offset += drag
                                    }
                                }
                            )
                        }
                ) {
                    val sizePx = Offset(size.width, size.height)
                    val cx = sizePx.x / 2 + offset.x
                    val cy = sizePx.y / 2 + offset.y

                    // рёбра красными, как «ведёт к» в старой версии
                    val byId = nodes.associateBy { it.id }
                    val edgePaint = android.graphics.Paint().apply {
                        color = 0x99E5484D.toInt()
                        strokeWidth = 2f * scale
                        isAntiAlias = true
                    }
                    val labelPaint = android.graphics.Paint().apply {
                        color = 0xFFE5484D.toInt()
                        textSize = 10.sp.toPx() * scale.coerceIn(0.5f, 1.4f)
                        isAntiAlias = true
                        textAlign = android.graphics.Paint.Align.CENTER
                    }
                    val namePaint = android.graphics.Paint().apply {
                        color = 0xFFF8FAFC.toInt()
                        textSize = 13.sp.toPx() * scale.coerceIn(0.6f, 1.6f)
                        isAntiAlias = true
                        textAlign = android.graphics.Paint.Align.CENTER
                    }

                    people.forEachIndexed { i, a ->
                        for (j in i + 1 until people.size) {
                            val b = people[j]
                            val links = sharedItems(a, b)
                            if (links.isEmpty()) continue
                            val na = byId[a.id] ?: continue
                            val nb = byId[b.id] ?: continue
                            val ax = cx + na.x * scale
                            val ay = cy + na.y * scale
                            val bx = cx + nb.x * scale
                            val byy = cy + nb.y * scale
                            drawContext.canvas.nativeCanvas.drawLine(ax, ay, bx, byy, edgePaint)
                            if (scale > 0.8f) {
                                drawContext.canvas.nativeCanvas.drawText(
                                    links.first().take(24), (ax + bx) / 2, (ay + byy) / 2 - 6f, labelPaint
                                )
                            }
                        }
                    }

                    nodes.forEach { n ->
                        val px = cx + n.x * scale
                        val py = cy + n.y * scale
                        drawCircle(Color(0xFF2DD4BF), radius = 18f * scale, center = Offset(px, py))
                        drawCircle(Color(0xFF101418), radius = 14f * scale, center = Offset(px, py))
                        drawContext.canvas.nativeCanvas.drawText(
                            n.name.take(16), px, py + 30f * scale + namePaint.textSize, namePaint
                        )
                    }
                }
            }
        }
    }
}

/** Пружинная раскладка: 180 итераций, отталкивание 2200/d², рёбра к длине 110. */
private fun layout(people: List<com.trackaer.app.data.db.PersonEntity>): List<GNode> {
    if (people.isEmpty()) return emptyList()
    val nodes = people.map { GNode(it.id, it.name, (0..400).random().toFloat(), (0..400).random().toFloat()) }
    val byId = nodes.associateBy { it.id }
    val edges = ArrayList<GEdge>()
    for (i in people.indices) for (j in i + 1 until people.size) {
        val shared = sharedItems(people[i], people[j])
        shared.forEach { label -> edges.add(GEdge(people[i].id, people[j].id, label)) }
    }
    repeat(180) {
        for (i in nodes.indices) for (j in i + 1 until nodes.size) {
            val n1 = nodes[i]; val n2 = nodes[j]
            var dx = n1.x - n2.x
            var dy = n1.y - n2.y
            val dist = sqrt(dx * dx + dy * dy).coerceAtLeast(0.01f)
            val force = 2200f / (dist * dist)
            dx /= dist; dy /= dist
            n1.vx += dx * force; n1.vy += dy * force
            n2.vx -= dx * force; n2.vy -= dy * force
        }
        edges.forEach { e ->
            val n1 = byId[e.a] ?: return@forEach
            val n2 = byId[e.b] ?: return@forEach
            var dx = n2.x - n1.x
            var dy = n2.y - n1.y
            val dist = sqrt(dx * dx + dy * dy).coerceAtLeast(0.01f)
            val force = (dist - 110f) * 0.01f
            dx /= dist; dy /= dist
            n1.vx += dx * force; n1.vy += dy * force
            n2.vx -= dx * force; n2.vy -= dy * force
        }
        nodes.forEach { n ->
            n.x += n.vx; n.y += n.vy
            n.vx *= 0.8f; n.vy *= 0.8f
        }
    }
    return nodes
}
