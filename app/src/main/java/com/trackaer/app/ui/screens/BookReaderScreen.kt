package com.trackaer.app.ui.screens

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.trackaer.app.TrackaerApp
import com.trackaer.app.data.db.BookEntity
import com.trackaer.app.ui.components.ScreenTopBar
import com.trackaer.app.util.BookText
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Читалка собственных книг: TXT/FB2 — текст по страницам,
 * PDF — постраничный рендер. Прогресс сохраняется как «прочитано».
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookReaderScreen(nav: NavHostController, bookId: Long) {
    val ctx = LocalContext.current
    val app = ctx.applicationContext as TrackaerApp
    val scope = rememberCoroutineScope()

    var book by remember { mutableStateOf<BookEntity?>(null) }
    var pages by remember { mutableStateOf<List<String>>(emptyList()) }
    var pdfCount by remember { mutableIntStateOf(0) }
    var page by remember { mutableIntStateOf(0) }
    var pdfBmp by remember { mutableStateOf<Bitmap?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(bookId) {
        withContext(Dispatchers.IO) {
            val b = app.db.booksDao().byId(bookId) ?: return@withContext
            book = b
            if (b.format == "pdf") {
                pdfCount = BookText.pdfPageCount(ctx, b.id, b.format, b.filePath)
                page = (b.read - 1).coerceIn(0, (pdfCount - 1).coerceAtLeast(0))
            } else {
                pages = BookText.loadTextPages(ctx, b.id, b.format, b.filePath) ?: listOf("Не удалось открыть файл книги.")
                page = (b.read - 1).coerceIn(0, pages.size - 1)
            }
            loading = false
        }
    }

    // рендер страницы PDF
    LaunchedEffect(page, book, pdfCount) {
        val b = book ?: return@LaunchedEffect
        if (b.format != "pdf") return@LaunchedEffect
        pdfBmp = null
        pdfBmp = withContext(Dispatchers.IO) {
            BookText.renderPdfPage(ctx, b.id, b.format, b.filePath, page, 1080)
        }
    }

    fun saveProgress() {
        val b = book ?: return
        scope.launch(Dispatchers.IO) { app.db.booksDao().setRead(b.id, page + 1) }
    }

    DisposableEffect(Unit) { onDispose { saveProgress() } }

    val isPdf = book?.format == "pdf"
    val total = if (isPdf) pdfCount else pages.size

    Scaffold(
        topBar = {
            ScreenTopBar(book?.title ?: "Читалка", nav)
        },
        bottomBar = {
            if (total > 0) {
                Surface {
                    Row(
                        Modifier.fillMaxWidth().padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedButton(
                            onClick = { if (page > 0) page-- },
                            enabled = page > 0
                        ) { Text("◀ Назад") }
                        Spacer(Modifier.weight(1f))
                        Text(
                            "${page + 1} / $total",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(Modifier.weight(1f))
                        Button(
                            onClick = {
                                if (page < total - 1) page++
                                if (page >= total - 1) book?.let { b ->
                                    if (!b.done) scope.launch(Dispatchers.IO) { app.db.booksDao().setDone(b.id, true) }
                                }
                            },
                            enabled = page < total - 1
                        ) { Text("Вперёд ▶") }
                    }
                }
            }
        }
    ) { pad ->
        Box(
            Modifier
                .padding(pad)
                .fillMaxSize()
                .background(Color(0xFF14181D))
        ) {
            when {
                loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Открываю книгу…", color = Color(0xFF8B98A5))
                }
                isPdf -> {
                    val bmp = pdfBmp
                    if (bmp != null) {
                        Image(
                            bitmap = bmp.asImageBitmap(),
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
                        )
                    } else {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text("Рендер страницы…", color = Color(0xFF8B98A5))
                        }
                    }
                }
                pages.isNotEmpty() -> Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(20.dp, 16.dp)
                ) {
                    Text(
                        pages[page],
                        color = Color(0xFFE8EDF2),
                        fontSize = 16.sp,
                        lineHeight = 24.sp
                    )
                    Spacer(Modifier.padding(bottom = 12.dp))
                }
                else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Файл пуст или повреждён", color = Color(0xFF8B98A5))
                }
            }
        }
    }
}
