package com.moame.core.model

import kotlinx.serialization.Serializable

enum class ApplicationStatus {
    DRAFTED,
    PENDING_APPROVAL,
    SUBMITTED,
    ASSESSMENT_REQUESTED,
    INTERVIEW_SCHEDULED,
    ADDITIONAL_INFO_REQUESTED,
    OFFER_RECEIVED,
    REJECTED,
    WITHDRAWN,
}

@Serializable
data class JobApplication(
    val id: String,
    val jobId: String,
    val jobTitle: String,
    val company: String,
    val source: JobSource,
    val appliedAt: Long?,
    val status: ApplicationStatus,
    val tailoredResumeText: String,
    val tailoredCoverLetterText: String,
    val submittedAutomatically: Boolean,
    val statusHistory: List<StatusChange> = emptyList(),
    val notes: String = "",
)

@Serializable
data class StatusChange(
    val status: ApplicationStatus,
    val timestamp: Long,
    val detail: String = "",
)
