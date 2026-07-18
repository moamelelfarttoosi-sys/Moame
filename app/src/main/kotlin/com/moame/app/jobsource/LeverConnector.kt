package com.moame.app.jobsource

import com.moame.core.model.JobListing
import com.moame.core.model.JobSource
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Lever's public postings API: https://api.lever.co/v0/postings/{company}?mode=json
 * {company} is the same slug used in that company's public jobs.lever.co URL.
 * Public, unauthenticated, no scraping/anti-bot bypass involved.
 */
class LeverConnector(
    private val companySlug: String,
    private val httpClient: HttpClient,
) : JobSourceConnector {

    override val label: String = "Lever: $companySlug"

    override suspend fun fetchListings(): List<JobListing> {
        val now = System.currentTimeMillis()
        val postings: List<LeverPosting> = httpClient
            .get("https://api.lever.co/v0/postings/$companySlug?mode=json")
            .body()

        return postings.map { posting ->
            JobListing(
                id = "lever_${companySlug}_${posting.id}",
                source = JobSource.LEVER,
                title = posting.text,
                company = companySlug,
                location = posting.categories?.location.orEmpty(),
                remote = posting.categories?.location?.contains("remote", ignoreCase = true) == true,
                description = posting.descriptionPlain ?: posting.description.orEmpty(),
                applyUrl = posting.applyUrl ?: posting.hostedUrl,
                postedAt = now,
                fetchedAt = now,
            )
        }
    }
}

@Serializable
private data class LeverPosting(
    val id: String,
    val text: String,
    val categories: LeverCategories? = null,
    val description: String? = null,
    @SerialName("descriptionPlain") val descriptionPlain: String? = null,
    @SerialName("hostedUrl") val hostedUrl: String,
    @SerialName("applyUrl") val applyUrl: String? = null,
)

@Serializable
private data class LeverCategories(val location: String? = null)
