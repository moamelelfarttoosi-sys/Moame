package com.moame.core.model

import kotlinx.serialization.Serializable

enum class Urgency { HIGH, MEDIUM, LOW }

enum class ReminderType {
    INTERVIEW_INVITATION,
    INTERVIEW_UPCOMING,
    APPLICATION_DEADLINE,
    EMAIL_RESPONSE_NEEDED,
    CALENDAR_EVENT,
    BILL_OR_RENEWAL,
    IMPORTANT_MESSAGE,
    FOLLOW_UP,
    TASK_DEADLINE,
    SYSTEM_NOTIFICATION,
}

@Serializable
data class Reminder(
    val id: String,
    val type: ReminderType,
    val title: String,
    val reason: String,
    val urgency: Urgency,
    val recommendedAction: String,
    val dueAt: Long?,
    val createdAt: Long,
    val isResolved: Boolean = false,
    val relatedEntityId: String? = null,
)
