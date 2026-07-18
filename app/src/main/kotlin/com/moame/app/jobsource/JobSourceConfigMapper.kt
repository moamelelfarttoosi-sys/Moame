package com.moame.app.jobsource

import com.moame.app.data.repository.SettingsRepository

fun SettingsRepository.toJobSourceConfig(): JobSourceConfig = JobSourceConfig(
    greenhouseBoardTokens = greenhouseBoardTokensCsv.splitCsv(),
    leverCompanySlugs = leverCompanySlugsCsv.splitCsv(),
    workdayTenants = workdayTenantsCsv.splitCsv().mapNotNull { entry ->
        val parts = entry.split("|")
        if (parts.size == 3) WorkdayTenantConfig(tenant = parts[0], site = parts[1], hostname = parts[2]) else null
    },
    adzunaEnabled = adzunaEnabled,
    adzunaCountry = adzunaCountry,
    adzunaQuery = adzunaQuery,
    adzunaLocation = adzunaLocation,
)

private fun String.splitCsv(): List<String> = split(",").map { it.trim() }.filter { it.isNotEmpty() }
