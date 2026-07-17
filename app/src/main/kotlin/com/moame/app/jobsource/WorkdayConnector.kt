package com.moame.app.jobsource

import com.moame.core.model.JobListing
import com.moame.core.model.JobSource
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Workday's own careers-page frontend calls a public JSON endpoint at
 * https://{hostname}/wday/cxs/{tenant}/{site}/jobs - the same request the
 * company's public careers page itself makes to render listings. No auth,
 * no scraping of rendered HTML.
 */
class WorkdayConnector(
    private val config: WorkdayTenantConfig,
    private val httpClient: HttpClient,
) : JobSourceConnector {

    override val label: String = "Workday: ${config.tenant}/${config.site}"

    override suspend fun fetchListings(): List<JobListing> {
        val now = System.currentTimeMillis()
        val response: WorkdayJobsResponse = httpClient
            .post("https://${config.hostname}/wday/cxs/${config.tenant}/${config.site}/jobs") {
                contentType(ContentType.Application.Json)
                setBody(WorkdayJobsRequest(limit = 50, offset = 0, searchText = ""))
            }
            .body()

        return response.jobPostings.map { posting ->
            JobListing(
                id = "workday_${config.tenant}_${config.site}_${posting.externalPath}",
                source = JobSource.WORKDAY,
                title = posting.title,
                company = config.tenant,
                location = posting.locationsText.orEmpty(),
                remote = posting.locationsText?.contains("remote", ignoreCase = true) == true,
                description = "",
                applyUrl = "https://${config.hostname}/${config.tenant}/${config.site}${posting.externalPath}",
                postedAt = now,
                fetchedAt = now,
            )
        }
    }
}

@Serializable
private data class WorkdayJobsRequest(val limit: Int, val offset: Int, val searchText: String)

@Serializable
private data class WorkdayJobsResponse(@SerialName("jobPostings") val jobPostings: List<WorkdayPosting> = emptyList())

@Serializable
private data class WorkdayPosting(
    val title: String,
    @SerialName("externalPath") val externalPath: String,
    @SerialName("locationsText") val locationsText: String? = null,
)
