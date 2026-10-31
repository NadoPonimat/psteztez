package com.trackaer.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.LaunchedEffect
import android.Manifest
import com.trackaer.app.ui.AppRoot
import com.trackaer.app.ui.theme.TrackaerTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TrackaerTheme {
                val perm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {}
                LaunchedEffect(Unit) {
                    if (android.os.Build.VERSION.SDK_INT >= 33) {
                        perm.launch(Manifest.permission.POST_NOTIFICATIONS)
                    }
                }
                AppRoot()
            }
        }
    }
}
