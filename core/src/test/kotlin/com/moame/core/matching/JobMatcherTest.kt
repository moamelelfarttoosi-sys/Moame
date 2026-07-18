package com.moame.core.matching

import com.moame.core.model.CompetencyGroup
import com.moame.core.model.JobListing
import com.moame.core.model.JobPreferences
import com.moame.core.model.JobSource
import com.moame.core.model.Profile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class JobMatcherTest {

    private val profile = Profile(
        id = "p1",
        fullName = "Moamel Ali Mohaisen",
        headline = "Contracts & Procurement Engineer",
        email = "moamelali.alfarttoosi@gmail.com",
        phone = "+964 782 264 6895",
        location = "Basra, Iraq",
        linkedInUrl = "linkedin.com/in/moamelali",
        summary = "Contracts & Procurement Engineer with 5+ years in oil & gas and EPC.",
        yearsOfExperience = 5,
        skills = listOf("Contract Management", "SAP Ariba", "SAP MM", "Tendering", "Procurement Planning"),
        coreCompetencyGroups = listOf(
            CompetencyGroup("Contract Management & Administration", listOf("EPC agreements", "FIDIC-based contracts", "negotiation")),
            CompetencyGroup("Procurement & Sourcing", listOf("strategic sourcing", "supplier evaluation", "Incoterms 2020")),
        ),
        experience = emptyList(),
        education = emptyList(),
        certifications = listOf("Contract Management - LUKOIL Block 10"),
        languages = emptyList(),
        preferences = JobPreferences(
            desiredTitles = listOf("Contracts Engineer", "Procurement Engineer"),
            locations = listOf("Basra", "Iraq"),
            remoteOk = true,
            excludedCompanies = listOf("Bad Corp"),
            excludedKeywords = listOf("unpaid internship"),
        ),
    )

    private fun job(
        title: String = "Contracts Engineer",
        company: String = "Acme EPC",
        location: String = "Basra, Iraq",
        remote: Boolean = false,
        description: String = "We need someone skilled in SAP Ariba, FIDIC-based contracts, and strategic sourcing.",
        requiredSkills: List<String> = listOf("SAP Ariba", "FIDIC", "strategic sourcing"),
    ) = JobListing(
        id = "j1",
        source = JobSource.GREENHOUSE,
        title = title,
        company = company,
        location = location,
        remote = remote,
        description = description,
        requiredSkills = requiredSkills,
        applyUrl = "https://example.com/apply",
        postedAt = 0L,
        fetchedAt = 0L,
    )

    @Test
    fun `strong skill and title match scores highly`() {
        val result = JobMatcher().match(profile, job())
        assertTrue("expected high score, got ${result.score}", result.score > 0.6)
        assertTrue(result.matchedSkills.isNotEmpty())
    }

    @Test
    fun `excluded company forces score to zero`() {
        val result = JobMatcher().match(profile, job(company = "Bad Corp"))
        assertEquals(0.0, result.score, 0.0001)
    }

    @Test
    fun `excluded keyword in description forces score to zero`() {
        val result = JobMatcher().match(
            profile,
            job(description = "This is an unpaid internship requiring SAP Ariba experience."),
        )
        assertEquals(0.0, result.score, 0.0001)
    }

    @Test
    fun `unrelated job scores low`() {
        val result = JobMatcher().match(
            profile,
            job(
                title = "Senior iOS Developer",
                location = "San Francisco, USA",
                remote = false,
                description = "Looking for Swift, SwiftUI, and Xcode experience.",
                requiredSkills = listOf("Swift", "SwiftUI", "Xcode"),
            ),
        )
        assertTrue("expected low score, got ${result.score}", result.score < 0.35)
    }

    @Test
    fun `matchAndFilter sorts by descending score and drops below threshold`() {
        val strong = job()
        val weak = job(
            title = "Senior iOS Developer",
            description = "Looking for Swift, SwiftUI, and Xcode experience.",
            requiredSkills = listOf("Swift", "SwiftUI", "Xcode"),
        )
        val results = JobMatcher().matchAndFilter(profile, listOf(weak, strong))
        assertEquals(1, results.size)
        assertEquals("j1", results.first().job.id)
    }

    @Test
    fun `remote job matches when remoteOk is true even outside preferred locations`() {
        val result = JobMatcher().match(
            profile,
            job(location = "Remote - Global", remote = true),
        )
        assertTrue(result.score > 0.5)
    }
}
