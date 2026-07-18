package com.moame.app.jobsource

import com.moame.core.model.JobListing

interface JobSourceConnector {
    /** Human-readable name for logging/settings UI, e.g. "Greenhouse: Acme Corp". */
    val label: String

    suspend fun fetchListings(): List<JobListing>
}

/**
 * User-configured list of company/board identifiers per ATS. These are
 * plain public identifiers (e.g. a Greenhouse "board token" is part of that
 * company's public careers page URL) - not credentials.
 */
data class JobSourceConfig(
    val greenhouseBoardTokens: List<String> = emptyList(),
    val leverCompanySlugs: List<String> = emptyList(),
    val workdayTenants: List<WorkdayTenantConfig> = emptyList(),
    val adzunaEnabled: Boolean = false,
    val adzunaCountry: String = "gb",
    val adzunaQuery: String = "",
    val adzunaLocation: String = "",
)

data class WorkdayTenantConfig(
    val tenant: String,
    val site: String,
    val hostname: String,
)
