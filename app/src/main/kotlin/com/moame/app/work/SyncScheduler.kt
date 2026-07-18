package com.moame.app.work

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Schedules SyncWorker on the requested interval. Android's WorkManager
 * enforces a 15-minute floor on periodic work regardless of what's
 * requested here - this is the realistic ceiling for a backend-less,
 * fully-on-device background agent (see README.md).
 */
object SyncScheduler {

    fun schedule(context: Context, intervalMinutes: Int) {
        val interval = intervalMinutes.coerceAtLeast(15)
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = PeriodicWorkRequestBuilder<SyncWorker>(interval.toLong(), TimeUnit.MINUTES)
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.LINEAR, 5, TimeUnit.MINUTES)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            SyncWorker.UNIQUE_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(SyncWorker.UNIQUE_WORK_NAME)
    }
}
