package com.playzone.crm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * После перезагрузки телефона Android стирает все будильники.
 * Этот приёмник ставит будильники активных сеансов заново.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            AlarmScheduler.rescheduleAfterBoot(context)
        }
    }
}
