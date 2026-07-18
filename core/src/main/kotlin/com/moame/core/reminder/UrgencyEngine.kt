package com.moame.core.reminder

import com.moame.core.model.Reminder
import com.moame.core.model.ReminderType
import com.moame.core.model.Urgency
import kotlin.math.abs

/**
 * Derives urgency + a human-readable recommended action purely from time
 * remaining until a deadline plus the reminder's type. Kept separate from
 * where reminders are created so the same rules apply whether the reminder
 * originated from an email, a job application, or a manually added task.
 */
object UrgencyEngine {

    private val hoursThresholdsByType: Map<ReminderType, Pair<Long, Long>> = mapOf(
        ReminderType.INTERVIEW_INVITATION to (24L to 72L),
        ReminderType.INTERVIEW_UPCOMING to (2L to 24L),
        ReminderType.APPLICATION_DEADLINE to (24L to 96L),
        ReminderType.EMAIL_RESPONSE_NEEDED to (12L to 48L),
        ReminderType.CALENDAR_EVENT to (1L to 24L),
        ReminderType.BILL_OR_RENEWAL to (48L to 168L),
        ReminderType.IMPORTANT_MESSAGE to (24L to 72L),
        ReminderType.FOLLOW_UP to (24L to 96L),
        ReminderType.TASK_DEADLINE to (24L to 96L),
        ReminderType.SYSTEM_NOTIFICATION to (24L to 72L),
    )

    fun urgencyFor(type: ReminderType, nowMillis: Long, dueAtMillis: Long?): Urgency {
        if (dueAtMillis == null) return defaultUrgencyWithoutDueDate(type)
        val hoursRemaining = (dueAtMillis - nowMillis) / 3_600_000.0
        if (hoursRemaining < 0) return Urgency.HIGH
        val (highCutoff, mediumCutoff) = hoursThresholdsByType[type] ?: (24L to 72L)
        return when {
            hoursRemaining <= highCutoff -> Urgency.HIGH
            hoursRemaining <= mediumCutoff -> Urgency.MEDIUM
            else -> Urgency.LOW
        }
    }

    private fun defaultUrgencyWithoutDueDate(type: ReminderType): Urgency = when (type) {
        ReminderType.INTERVIEW_INVITATION, ReminderType.EMAIL_RESPONSE_NEEDED -> Urgency.HIGH
        ReminderType.CALENDAR_EVENT, ReminderType.INTERVIEW_UPCOMING -> Urgency.MEDIUM
        else -> Urgency.LOW
    }

    fun recommendedAction(type: ReminderType, urgency: Urgency): String = when (type) {
        ReminderType.INTERVIEW_INVITATION -> "Review the invitation and confirm your availability"
        ReminderType.INTERVIEW_UPCOMING -> "Prepare for the interview: review the job description and your tailored resume"
        ReminderType.APPLICATION_DEADLINE -> if (urgency == Urgency.HIGH) "Submit the application now — deadline is imminent" else "Finish and submit the application before the deadline"
        ReminderType.EMAIL_RESPONSE_NEEDED -> "Reply to the email — it needs your input, not an automatic response"
        ReminderType.CALENDAR_EVENT -> "Check your calendar and prepare for the event"
        ReminderType.BILL_OR_RENEWAL -> "Review and pay/renew before the due date to avoid a lapse"
        ReminderType.IMPORTANT_MESSAGE -> "Read the full message — it was flagged as important"
        ReminderType.FOLLOW_UP -> "Send a follow-up message"
        ReminderType.TASK_DEADLINE -> "Complete the task before the deadline"
        ReminderType.SYSTEM_NOTIFICATION -> "Review the notification"
    }

    fun buildReminder(
        id: String,
        type: ReminderType,
        title: String,
        reason: String,
        nowMillis: Long,
        dueAtMillis: Long?,
        relatedEntityId: String? = null,
    ): Reminder {
        val urgency = urgencyFor(type, nowMillis, dueAtMillis)
        return Reminder(
            id = id,
            type = type,
            title = title,
            reason = reason,
            urgency = urgency,
            recommendedAction = recommendedAction(type, urgency),
            dueAt = dueAtMillis,
            createdAt = nowMillis,
            relatedEntityId = relatedEntityId,
        )
    }

    /** Sorts reminders for dashboard display: overdue/high first, then soonest due date. */
    fun sortForDisplay(reminders: List<Reminder>, nowMillis: Long): List<Reminder> {
        val urgencyRank = mapOf(Urgency.HIGH to 0, Urgency.MEDIUM to 1, Urgency.LOW to 2)
        return reminders.sortedWith(
            compareBy(
                { urgencyRank[it.urgency] },
                { it.dueAt?.let { due -> abs(due - nowMillis) } ?: Long.MAX_VALUE },
            ),
        )
    }
}
