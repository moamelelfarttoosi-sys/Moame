package com.moame.app.work

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * WorkManager's own periodic work survives reboots on modern Android, but
 * this re-affirms scheduling defensively (e.g. after an OS/App update that
 * cleared WorkManager's DB). Reads the sync interval directly from the
 * encrypted prefs since Hilt entry points aren't available in a plain
 * BroadcastReceiver without additional wiring.
 */
class BootRescheduleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val masterKey = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        val prefs = EncryptedSharedPreferences.create(
            context,
            "moame_secure_settings",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
        val intervalMinutes = prefs.getInt("sync_interval_minutes", 30)
        SyncScheduler.schedule(context, intervalMinutes)
    }
}
