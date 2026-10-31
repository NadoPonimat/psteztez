package com.trackaer.app.ui

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.trackaer.app.TrackaerApp
import com.trackaer.app.data.AppSettings
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import java.io.File
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

/**
 * Анимация входа, как в старой версии: 10 вариантов (radar, pulse, scan, horns,
 * hearing, flash, lightning, rain, crack, none), своё фото фоном, показ заголовка.
 * Длительность — в Настройках; тап пропускает.
 */
@Composable
fun SplashScreen(onDone: () -> Unit) {
    val app = LocalContext.current.applicationContext as TrackaerApp
    var settings by remember { mutableStateOf(AppSettings()) }
    var photo by remember { mutableStateOf<android.graphics.Bitmap?>(null) }

    LaunchedEffect(Unit) {
        val s = app.settings.settings.first()
        settings = s
        val f = File(app.filesDir, "splash_photo.jpg")
        if (f.exists()) {
            photo = try {
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeFile(f.absolutePath, bounds)
                val sample = maxOf(1, bounds.outWidth / 1080)
                BitmapFactory.decodeFile(f.absolutePath, BitmapFactory.Options().apply { inSampleSize = sample })
            } catch (e: Exception) { null }
        }
        delay(if (s.splashMillis <= 0) 150 else s.splashMillis.toLong())
        onDone()
    }

    val bg = Color(0xFF101418)
    val accent = Color(0xFF2DD4BF)

    Surface(Modifier.fillMaxSize(), color = bg) {
        Box(
            Modifier
                .fillMaxSize()
                .clickable(MutableInteractionSource(), indication = null) { onDone() },
            contentAlignment = Alignment.Center
        ) {
            // своё фото фоном + затемнение (как ddBgPhoto + ddBgDim в старой версии)
            photo?.let { bmp ->
                Image(
                    bitmap = bmp.asImageBitmap(),
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
                Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.55f)))
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(contentAlignment = Alignment.Center) {
                    SplashDecor(settings.splashAnim, accent)
                    TLogo(accent, settings.splashAnim)
                }
                if (settings.splashShowTitle) {
                    Spacer(Modifier.height(26.dp))
                    SplashTitle(settings.splashAnim)
                    Text(
                        "твой личный трекер",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFF8B98A5)
                    )
                }
            }
        }
    }
}

/** Логотип «T» с рисующейся галочкой. */
@Composable
private fun TLogo(accent: Color, anim: String) {
    val scale = remember { Animatable(0.55f) }
    LaunchedEffect(Unit) {
        scale.animateTo(1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow))
    }
    val check = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        delay(350)
        check.animateTo(1f, tween(550, easing = FastOutSlowInEasing))
    }
    val pulse = rememberInfiniteTransition(label = "pulseT")
    val pt by pulse.animateFloat(
        0.96f, 1.04f,
        infiniteRepeatable(tween(1500, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "pt"
    )

    Canvas(
        Modifier
            .size(170.dp)
            .graphicsLayer {
                val s = if (anim == "pulse") scale.value * pt else scale.value
                scaleX = s
                scaleY = s
            }
    ) {
        val s = size.minDimension
        val t = Path().apply {
            moveTo(0.30f * s, 0.28f * s)
            lineTo(0.70f * s, 0.28f * s)
            lineTo(0.70f * s, 0.41f * s)
            lineTo(0.565f * s, 0.41f * s)
            lineTo(0.565f * s, 0.76f * s)
            lineTo(0.435f * s, 0.76f * s)
            lineTo(0.435f * s, 0.41f * s)
            lineTo(0.30f * s, 0.41f * s)
            close()
        }
        drawPath(t, accent)
        val cp = Path().apply {
            moveTo(0.56f * s, 0.60f * s)
            lineTo(0.63f * s, 0.67f * s)
            lineTo(0.78f * s, 0.50f * s)
        }
        val pm = PathMeasure()
        pm.setPath(cp, false)
        val seg = Path()
        pm.getSegment(0f, pm.length * check.value, seg, true)
        drawPath(seg, Color(0xFFF8FAFC), style = Stroke(width = 7.dp.toPx(), cap = StrokeCap.Round))
    }
}

@Composable
private fun SplashTitle(anim: String) {
    val transition = rememberInfiniteTransition(label = "title")
    val beat by transition.animateFloat(
        0.92f, 1.06f,
        infiniteRepeatable(tween(520, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "beat"
    )
    val fadeIn = remember { Animatable(if (anim == "scan" || anim == "horns" || anim == "hearing") 0f else 1f) }
    LaunchedEffect(Unit) {
        if (fadeIn.value == 0f) { delay(100); fadeIn.animateTo(1f, tween(400)) }
    }
    val modifier = when (anim) {
        "radar", "pulse" -> Modifier.graphicsLayer { scaleX = beat; scaleY = beat }
        "scan", "horns", "hearing" -> Modifier.alpha(fadeIn.value)
        else -> Modifier
    }
    Text(
        "Trackaer",
        modifier = modifier,
        style = MaterialTheme.typography.headlineMedium,
        fontWeight = FontWeight.Bold,
        color = Color(0xFFF8FAFC)
    )
}

/** Декорации вокруг логотипа — по варианту анимации (как data-anim в старой версии). */
@Composable
private fun SplashDecor(anim: String, accent: Color) {
    when (anim) {
        "radar" -> {
            val t = rememberInfiniteTransition(label = "radar")
            val p by t.animateFloat(0f, 1f, infiniteRepeatable(tween(1300, easing = LinearEasing)), label = "ping")
            Canvas(Modifier.size(230.dp)) {
                drawCircle(
                    accent.copy(alpha = (1f - p) * 0.5f),
                    radius = size.minDimension / 2f * (0.35f + 0.65f * p),
                    style = Stroke(3.dp.toPx())
                )
            }
        }
        "scan" -> {
            val t = rememberInfiniteTransition(label = "scan")
            val y by t.animateFloat(-1f, 1f, infiniteRepeatable(tween(1100, easing = LinearEasing)), label = "scanY")
            Canvas(
                Modifier
                    .size(220.dp)
                    .graphicsLayer { translationY = y * size.height / 2f }
            ) {
                drawLine(
                    accent.copy(alpha = 0.85f),
                    start = Offset(0f, size.height / 2f),
                    end = Offset(size.width, size.height / 2f),
                    strokeWidth = 2.dp.toPx()
                )
            }
        }
        "horns" -> {
            val t = remember { Animatable(0f) }
            LaunchedEffect(Unit) {
                delay(150)
                t.animateTo(1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium))
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("🤘", fontSize = 40.sp, modifier = Modifier.graphicsLayer { alpha = t.value; scaleX = t.value; scaleY = t.value })
                Spacer(Modifier.width(18.dp))
                Text("🤘", fontSize = 40.sp, modifier = Modifier.graphicsLayer { alpha = t.value; scaleX = t.value; scaleY = t.value })
            }
        }
        "hearing" -> {
            val t = rememberInfiniteTransition(label = "hear")
            val v by t.animateFloat(0.2f, 1f, infiniteRepeatable(tween(700, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "v")
            Row(verticalAlignment = Alignment.CenterVertically) {
                (0..2).forEach { i ->
                    val h = (34 * v * (1f - i * 0.25f)).dp.coerceAtLeast(6.dp)
                    Canvas(Modifier.padding(horizontal = 4.dp).width(6.dp).height(h)) {
                        drawRoundRect(accent.copy(alpha = 0.8f), cornerRadius = CornerRadius(3.dp.toPx()))
                    }
                }
            }
        }
        "flash" -> {
            val t = rememberInfiniteTransition(label = "flash")
            val v by t.animateFloat(0f, 1f, infiniteRepeatable(tween(900, easing = LinearEasing)), label = "f")
            if (v < 0.12f) {
                Box(Modifier.fillMaxSize().background(Color.White.copy(alpha = (0.12f - v) / 0.12f * 0.8f)))
            }
        }
        "lightning" -> {
            val t = rememberInfiniteTransition(label = "bolt")
            val v by t.animateFloat(0f, 1f, infiniteRepeatable(tween(1500, easing = LinearEasing)), label = "b")
            if (v < 0.12f) {
                Text("⚡", fontSize = 44.sp, modifier = Modifier.alpha((0.12f - v) / 0.12f))
            }
        }
        "rain" -> {
            val t = rememberInfiniteTransition(label = "rain")
            val now by t.animateFloat(0f, 1000f, infiniteRepeatable(tween(60000, easing = LinearEasing)), label = "t")
            val drops = remember { List(26) { Pair(Random.nextFloat(), 0.5f + Random.nextFloat()) } }
            Canvas(Modifier.size(260.dp)) {
                drops.forEach { (x0, sp) ->
                    val y = ((now * sp * 0.03f + x0 * 7f) % 1f)
                    val cx = x0 * size.width
                    val cy = y * size.height
                    drawLine(
                        accent.copy(alpha = 0.45f),
                        start = Offset(cx, cy),
                        end = Offset(cx, cy + 14f),
                        strokeWidth = 2f,
                        cap = StrokeCap.Round
                    )
                }
            }
        }
        "crack" -> {
            val t = remember { Animatable(0f) }
            LaunchedEffect(Unit) { delay(200); t.animateTo(1f, tween(600, easing = FastOutSlowInEasing)) }
            Canvas(Modifier.size(230.dp).graphicsLayer { scaleX = 1.6f; scaleY = 1.6f }) {
                val s = size.minDimension
                val c = Offset(s / 2, s / 2)
                val branches = listOf(
                    Pair(0.9f, -40f), Pair(0.8f, 30f), Pair(0.95f, 105f), Pair(0.75f, 175f),
                    Pair(0.88f, -110f), Pair(0.7f, -70f), Pair(0.92f, 60f), Pair(0.8f, 145f)
                )
                branches.forEach { (len, deg) ->
                    val rad = Math.toRadians(deg.toDouble())
                    val ex = c.x + (len * s / 2 * cos(rad)).toFloat()
                    val ey = c.y + (len * s / 2 * sin(rad)).toFloat()
                    val mid = Offset(
                        (c.x + ex) / 2 + 8f * (if (deg.toInt() % 2 == 0) 1f else -1f),
                        (c.y + ey) / 2 + 6f
                    )
                    val path = Path().apply { moveTo(c.x, c.y); quadraticBezierTo(mid.x, mid.y, ex, ey) }
                    drawPath(path, Color(0x66FFFFFF), style = Stroke(width = 1.5.dp.toPx(), cap = StrokeCap.Round))
                }
            }
        }
        else -> {}
    }
}
