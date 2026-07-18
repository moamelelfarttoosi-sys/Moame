package com.moame.app.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.moame.core.model.ApplicationStatus
import com.moame.core.model.EmailCategory
import com.moame.core.model.JobSource
import com.moame.core.model.ReminderType
import com.moame.core.model.Urgency

/** Single-row table: the app has exactly one profile at a time. */
@Entity(tableName = "profile")
data class ProfileEntity(
    @PrimaryKey val id: String = "current_profile",
    val profileJson: String,
    val updatedAt: Long,
)

@Entity(tableName = "job_applications")
data class JobApplicationEntity(
    @PrimaryKey val id: String,
    val jobId: String,
    val jobTitle: String,
    val company: String,
    val source: JobSource,
    val appliedAt: Long?,
    val status: ApplicationStatus,
    val tailoredResumeText: String,
    val tailoredCoverLetterText: String,
    val submittedAutomatically: Boolean,
    val statusHistoryJson: String,
    val notes: String,
    val createdAt: Long,
)

@Entity(tableName = "emails")
data class EmailEntity(
    @PrimaryKey val id: String,
    val threadId: String,
    val from: String,
    val subject: String,
    val snippet: String,
    val bodyText: String,
    val receivedAt: Long,
    val isUnread: Boolean,
    val labelsJson: String,
    val category: EmailCategory,
    val isUrgent: Boolean,
    val requiresApproval: Boolean,
    val decision: String,
    val summaryBulletsJson: String,
    val suggestedReply: String?,
    val handledAt: Long?,
)

@Entity(tableName = "reminders")
data class ReminderEntity(
    @PrimaryKey val id: String,
    val type: ReminderType,
    val title: String,
    val reason: String,
    val urgency: Urgency,
    val recommendedAction: String,
    val dueAt: Long?,
    val createdAt: Long,
    val isResolved: Boolean,
    val relatedEntityId: String?,
)

@Entity(tableName = "action_log")
data class ActionLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val timestamp: Long,
    val category: String,
    val summary: String,
    val detail: String,
    val requiredApproval: Boolean,
    val wasApproved: Boolean?,
)
