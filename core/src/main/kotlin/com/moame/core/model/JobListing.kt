package com.moame.core.model

import kotlinx.serialization.Serializable

enum class JobSource {
    GREENHOUSE,
    LEVER,
    WORKDAY,
    ADZUNA,
    USAJOBS,
    LINKEDIN,
    INDEED,
    OTHER,
}

/**
 * Whether a source permits fully automated form submission. LinkedIn and
 * Indeed are deliberately pinned to MANUAL_ASSIST_ONLY: their Terms of
 * Service prohibit automated/bot applications, so this app never submits to
 * them unattended, regardless of match confidence.
 */
enum class AutomationPolicy {
    FULL_AUTO_APPLY_ALLOWED,
    MANUAL_ASSIST_ONLY,
}

fun JobSource.automationPolicy(): AutomationPolicy = when (this) {
    JobSource.GREENHOUSE, JobSource.LEVER, JobSource.WORKDAY,
    JobSource.ADZUNA, JobSource.USAJOBS -> AutomationPolicy.FULL_AUTO_APPLY_ALLOWED
    JobSource.LINKEDIN, JobSource.INDEED, JobSource.OTHER -> AutomationPolicy.MANUAL_ASSIST_ONLY
}

@Serializable
data class JobListing(
    val id: String,
    val source: JobSource,
    val title: String,
    val company: String,
    val location: String,
    val remote: Boolean,
    val description: String,
    val requiredSkills: List<String> = emptyList(),
    val salaryMin: Int? = null,
    val salaryMax: Int? = null,
    val currency: String? = null,
    val applyUrl: String,
    val postedAt: Long,
    val fetchedAt: Long,
)

data class JobMatchResult(
    val job: JobListing,
    val score: Double,
    val matchedSkills: List<String>,
    val missingSkills: List<String>,
    val reasons: List<String>,
)
