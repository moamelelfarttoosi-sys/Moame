package com.moame.core.ai

import com.moame.core.model.JobListing
import com.moame.core.model.Profile

data class TailoredApplicationMaterials(
    val resumeText: String,
    val coverLetterText: String,
)

/**
 * Builds prompts for and parses responses from Claude to tailor the user's
 * resume and cover letter to a specific job listing. The LLM never invents
 * experience: the system prompt constrains it to reorder/emphasize/reword
 * the profile's existing bullets, not fabricate new ones.
 */
class ResumeTailoringService(private val claudeClient: ClaudeClient) {

    suspend fun tailor(profile: Profile, job: JobListing): TailoredApplicationMaterials {
        val system = """
            You are a resume-tailoring assistant. You will be given a candidate's
            full profile (ground truth) and a job description. Produce a tailored
            resume and a one-page cover letter.

            Hard rules:
            - Never invent employers, titles, dates, degrees, or skills not present
              in the candidate profile.
            - You may reorder, re-emphasize, and rephrase existing bullets to match
              the job description's language and priorities.
            - Keep factual claims (dates, employers, titles, metrics) exactly as given.
            - Output must be plain text with two sections separated by the exact
              marker line "-----COVER LETTER-----", resume first.
        """.trimIndent()

        val user = buildString {
            appendLine("CANDIDATE PROFILE (JSON):")
            appendLine(profileSummaryFor(profile))
            appendLine()
            appendLine("JOB LISTING:")
            appendLine("Title: ${job.title}")
            appendLine("Company: ${job.company}")
            appendLine("Location: ${job.location}${if (job.remote) " (Remote)" else ""}")
            appendLine("Description:")
            appendLine(job.description)
        }

        val raw = claudeClient.complete(system, user, maxTokens = 2048)
        val parts = raw.split("-----COVER LETTER-----")
        val resume = parts.getOrElse(0) { raw }.trim()
        val coverLetter = parts.getOrElse(1) { "" }.trim()
        return TailoredApplicationMaterials(resumeText = resume, coverLetterText = coverLetter)
    }

    private fun profileSummaryFor(profile: Profile): String = buildString {
        appendLine("Name: ${profile.fullName}")
        appendLine("Headline: ${profile.headline}")
        appendLine("Summary: ${profile.summary}")
        appendLine("Skills: ${profile.skills.joinToString(", ")}")
        profile.coreCompetencyGroups.forEach { group ->
            appendLine("${group.name}: ${group.items.joinToString(", ")}")
        }
        profile.experience.forEach { exp ->
            appendLine("- ${exp.title} at ${exp.company} (${exp.startDate} - ${exp.endDate ?: "Present"})")
            exp.bullets.forEach { appendLine("  * $it") }
        }
        profile.education.forEach { edu ->
            appendLine("- ${edu.degree}, ${edu.institution} (${edu.startYear}-${edu.endYear})")
        }
        if (profile.certifications.isNotEmpty()) {
            appendLine("Certifications: ${profile.certifications.joinToString(", ")}")
        }
    }
}
