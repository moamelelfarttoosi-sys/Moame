package com.moame.app.jobsource

import com.moame.core.model.JobListing
import com.moame.core.model.JobSource

/**
 * LinkedIn and Indeed are never auto-fetched, scraped, or auto-submitted to -
 * see JobListing.automationPolicy() and README.md. Instead, the user pastes a
 * job URL + description they found manually on those sites; the app still
 * scores the match and tailors a resume/cover letter for it, but submission
 * always happens in the user's own browser/app, by the user, by hand.
 */
object ManualAssistJobIntake {

    fun buildListing(url: String, title: String, company: String, description: String): JobListing {
        val now = System.currentTimeMillis()
        val source = detectSource(url)
        return JobListing(
            id = "manual_${source.name.lowercase()}_${url.hashCode()}",
            source = source,
            title = title,
            company = company,
            location = "",
            remote = false,
            description = description,
            applyUrl = url,
            postedAt = now,
            fetchedAt = now,
        )
    }

    private fun detectSource(url: String): JobSource = when {
        url.contains("linkedin.com", ignoreCase = true) -> JobSource.LINKEDIN
        url.contains("indeed.com", ignoreCase = true) -> JobSource.INDEED
        else -> JobSource.OTHER
    }
}
