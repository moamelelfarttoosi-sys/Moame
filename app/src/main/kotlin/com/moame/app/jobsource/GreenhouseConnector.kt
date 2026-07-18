package com.moame.app.jobsource

import com.moame.core.model.JobListing
import com.moame.core.model.JobSource
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Greenhouse exposes a public, unauthenticated Job Board API per company:
 * https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true
 * The board_token is the same slug used in that company's public careers URL
 * (boards.greenhouse.io/{board_token}). No scraping/anti-bot bypass involved.
 */
class GreenhouseConnector(
    private val boardToken: String,
    private val httpClient: HttpClient,
) : JobSourceConnector {

    override val label: String = "Greenhouse: $boardToken"

    override suspend fun fetchListings(): List<JobListing> {
        val now = System.currentTimeMillis()
        val response: GreenhouseJobsResponse = httpClient
            .get("https://boards-api.greenhouse.io/v1/boards/$boardToken/jobs?content=true")
            .body()

        return response.jobs.map { job ->
            JobListing(
                id = "greenhouse_${boardToken}_${job.id}",
                source = JobSource.GREENHOUSE,
                title = job.title,
                company = boardToken,
                location = job.location?.name.orEmpty(),
                remote = job.location?.name?.contains("remote", ignoreCase = true) == true,
                description = job.content.orEmpty(),
                applyUrl = job.absoluteUrl,
                postedAt = now,
                fetchedAt = now,
            )
        }
    }
}

@Serializable
private data class GreenhouseJobsResponse(val jobs: List<GreenhouseJob> = emptyList())

@Serializable
private data class GreenhouseJob(
    val id: Long,
    val title: String,
    val content: String? = null,
    val location: GreenhouseLocation? = null,
    @SerialName("absolute_url") val absoluteUrl: String,
)

@Serializable
private data class GreenhouseLocation(val name: String? = null)
