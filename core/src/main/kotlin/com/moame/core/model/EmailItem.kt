package com.moame.core.model

import kotlinx.serialization.Serializable

enum class EmailCategory {
    JOB_APPLICATION,
    INTERVIEW_INVITATION,
    RECRUITER_MESSAGE,
    URGENT_REQUEST,
    PERSONAL,
    PROMOTION_SPAM,
    OTHER,
}

enum class EmailActionDecision {
    AUTO_REPLY_SENT,
    DRAFTED_AWAITING_APPROVAL,
    NO_ACTION_NEEDED,
    NEEDS_USER_ATTENTION,
}

@Serializable
data class EmailItem(
    val id: String,
    val threadId: String,
    val from: String,
    val subject: String,
    val snippet: String,
    val bodyText: String,
    val receivedAt: Long,
    val isUnread: Boolean,
    val labels: List<String> = emptyList(),
)

data class EmailClassification(
    val email: EmailItem,
    val category: EmailCategory,
    val isUrgent: Boolean,
    val requiresApproval: Boolean,
    val decision: EmailActionDecision,
    val summaryBullets: List<String>,
    val suggestedReply: String? = null,
    val reasons: List<String>,
)
