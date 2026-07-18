package com.moame.app.jobsource

import com.moame.core.model.JobListing
import com.moame.core.model.JobSource
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Adzuna's official job search API (https://developer.adzuna.com/) requires
 * a free app_id/app_key registered by the user in Settings. This is a real,
 * ToS-compliant search API - not scraping.
 */
class AdzunaConnector(
    private val appId: String,
    private val appKey: String,
    private val country: String,
    private val query: String,
    private val location: String,
    private val httpClient: HttpClient,
) : JobSourceConnector {

    override val label: String = "Adzuna: $query in $location"

    override suspend fun fetchListings(): List<JobListing> {
        val now = System.currentTimeMillis()
        val response: AdzunaResponse = httpClient
            .get("https://api.adzuna.com/v1/api/jobs/$country/search/1") {
                parameter("app_id", appId)
                parameter("app_key", appKey)
                parameter("results_per_page", 50)
                if (query.isNotBlank()) parameter("what", query)
                if (location.isNotBlank()) parameter("where", location)
                parameter("content-type", "application/json")
            }
            .body()

        return response.results.map { r ->
            JobListing(
                id = "adzuna_${r.id}",
                source = JobSource.ADZUNA,
                title = r.title,
                company = r.company?.displayName.orEmpty(),
                location = r.location?.displayName.orEmpty(),
                remote = r.title.contains("remote", ignoreCase = true),
                description = r.description.orEmpty(),
                salaryMin = r.salaryMin?.toInt(),
                salaryMax = r.salaryMax?.toInt(),
                currency = null,
                applyUrl = r.redirectUrl,
                postedAt = now,
                fetchedAt = now,
            )
        }
    }
}

@Serializable
private data class AdzunaResponse(val results: List<AdzunaResult> = emptyList())

@Serializable
private data class AdzunaResult(
    val id: String,
    val title: String,
    val description: String? = null,
    val company: AdzunaCompany? = null,
    val location: AdzunaLocation? = null,
    @SerialName("salary_min") val salaryMin: Double? = null,
    @SerialName("salary_max") val salaryMax: Double? = null,
    @SerialName("redirect_url") val redirectUrl: String,
)

@Serializable
private data class AdzunaCompany(@SerialName("display_name") val displayName: String? = null)

@Serializable
private data class AdzunaLocation(@SerialName("display_name") val displayName: String? = null)
