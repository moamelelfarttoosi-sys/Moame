package com.moame.app.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.moame.app.R
import com.moame.core.model.Urgency

object NotificationHelper {
    const val CHANNEL_HIGH = "moame_high_urgency"
    const val CHANNEL_MEDIUM = "moame_medium_urgency"
    const val CHANNEL_LOW = "moame_low_urgency"
    const val CHANNEL_APPROVAL = "moame_approval_needed"

    fun createChannels(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_HIGH, "Urgent alerts", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Interview invitations, deadlines, and other time-critical alerts"
            },
        )
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_MEDIUM, "Reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Upcoming events and follow-ups"
            },
        )
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_LOW, "Updates", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Low-priority updates and background sync summaries"
            },
        )
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_APPROVAL, "Needs your approval", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Emails and applications waiting for your approval before sending/submitting"
            },
        )
    }

    fun channelFor(urgency: Urgency): String = when (urgency) {
        Urgency.HIGH -> CHANNEL_HIGH
        Urgency.MEDIUM -> CHANNEL_MEDIUM
        Urgency.LOW -> CHANNEL_LOW
    }

    fun notify(
        context: Context,
        notificationId: Int,
        channelId: String,
        title: String,
        text: String,
    ) {
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(context).notify(notificationId, notification)
    }
}
