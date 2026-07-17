package com.moame.app.jobsource

import com.moame.core.model.JobListing
import io.ktor.client.HttpClient
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

class JobSourceAggregator(private val httpClient: HttpClient) {

    /** Fetches from every configured auto-apply-eligible source, in parallel. Failures in one source don't fail the others. */
    suspend fun fetchAll(config: JobSourceConfig, adzunaAppId: String?, adzunaAppKey: String?): List<JobListing> = coroutineScope {
        val connectors = buildConnectors(config, adzunaAppId, adzunaAppKey)
        connectors.map { connector ->
            async {
                runCatching { connector.fetchListings() }.getOrElse { emptyList() }
            }
        }.map { it.await() }.flatten()
    }

    private fun buildConnectors(
        config: JobSourceConfig,
        adzunaAppId: String?,
        adzunaAppKey: String?,
    ): List<JobSourceConnector> = buildList {
        config.greenhouseBoardTokens.forEach { add(GreenhouseConnector(it, httpClient)) }
        config.leverCompanySlugs.forEach { add(LeverConnector(it, httpClient)) }
        config.workdayTenants.forEach { add(WorkdayConnector(it, httpClient)) }
        if (config.adzunaEnabled && !adzunaAppId.isNullOrBlank() && !adzunaAppKey.isNullOrBlank()) {
            add(
                AdzunaConnector(
                    appId = adzunaAppId,
                    appKey = adzunaAppKey,
                    country = config.adzunaCountry,
                    query = config.adzunaQuery,
                    location = config.adzunaLocation,
                    httpClient = httpClient,
                ),
            )
        }
    }
}
