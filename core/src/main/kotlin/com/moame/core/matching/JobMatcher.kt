package com.moame.core.matching

import com.moame.core.model.JobListing
import com.moame.core.model.JobMatchResult
import com.moame.core.model.Profile

/**
 * Deterministic, explainable pre-filter over job listings. This intentionally
 * does NOT call an LLM: it's cheap, runs on every fetched listing, and its
 * output (matchedSkills/missingSkills/reasons) is exactly what gets shown to
 * the user and fed into the LLM-based resume tailoring step for listings that
 * pass the threshold.
 */
class JobMatcher(
    private val minScoreToSurface: Double = 0.35,
) {
    fun match(profile: Profile, job: JobListing): JobMatchResult {
        val reasons = mutableListOf<String>()

        val profileSkills = normalizedSkillSet(profile)
        val required = job.requiredSkills.ifEmpty { extractSkillLikeTokens(job.description) }
        val requiredNormalized = required.map { it.trim().lowercase() }.filter { it.isNotBlank() }.toSet()

        val matched = requiredNormalized.filter { skill -> profileSkills.any { it.contains(skill) || skill.contains(it) } }
        val missing = requiredNormalized - matched.toSet()

        val skillScore = if (requiredNormalized.isEmpty()) 0.5 else matched.size.toDouble() / requiredNormalized.size

        val titleScore = titleAffinity(profile, job)
        if (titleScore > 0.0) reasons.add("Title '${job.title}' aligns with your desired roles")

        val locationScore = locationAffinity(profile, job)
        if (locationScore > 0.0) reasons.add(
            if (job.remote) "Remote position" else "Location '${job.location}' matches your preferences",
        )

        val excludedHit = profile.preferences.excludedKeywords.any { kw ->
            job.description.contains(kw, ignoreCase = true) || job.title.contains(kw, ignoreCase = true)
        }
        val companyExcluded = profile.preferences.excludedCompanies.any { it.equals(job.company, ignoreCase = true) }

        if (matched.isNotEmpty()) {
            reasons.add("Matched skills: ${matched.take(5).joinToString(", ")}")
        }
        if (missing.isNotEmpty()) {
            reasons.add("Missing/unclear skills: ${missing.take(5).joinToString(", ")}")
        }

        var score = (skillScore * 0.6) + (titleScore * 0.25) + (locationScore * 0.15)
        if (excludedHit || companyExcluded) {
            score = 0.0
            reasons.add(0, "Excluded by your preferences (excluded company or keyword)")
        }

        return JobMatchResult(
            job = job,
            score = score.coerceIn(0.0, 1.0),
            matchedSkills = matched,
            missingSkills = missing.toList(),
            reasons = reasons,
        )
    }

    fun matchAndFilter(profile: Profile, jobs: List<JobListing>): List<JobMatchResult> =
        jobs.map { match(profile, it) }
            .filter { it.score >= minScoreToSurface }
            .sortedByDescending { it.score }

    private fun normalizedSkillSet(profile: Profile): Set<String> {
        val fromSkills = profile.skills.map { it.trim().lowercase() }
        val fromCompetencies = profile.coreCompetencyGroups.flatMap { it.items }.map { it.trim().lowercase() }
        return (fromSkills + fromCompetencies).filter { it.isNotBlank() }.toSet()
    }

    private fun titleAffinity(profile: Profile, job: JobListing): Double {
        val jobTitle = job.title.lowercase()
        val hit = profile.preferences.desiredTitles.any { desired ->
            val d = desired.lowercase()
            jobTitle.contains(d) || d.contains(jobTitle) || tokenOverlap(jobTitle, d) >= 0.5
        }
        return if (hit) 1.0 else 0.0
    }

    private fun locationAffinity(profile: Profile, job: JobListing): Double {
        if (job.remote && profile.preferences.remoteOk) return 1.0
        val jobLoc = job.location.lowercase()
        val hit = profile.preferences.locations.any { loc -> jobLoc.contains(loc.lowercase()) }
        return if (hit) 1.0 else 0.0
    }

    private fun tokenOverlap(a: String, b: String): Double {
        val ta = a.split(Regex("\\s+")).toSet()
        val tb = b.split(Regex("\\s+")).toSet()
        if (ta.isEmpty() || tb.isEmpty()) return 0.0
        val intersection = ta.intersect(tb).size.toDouble()
        return intersection / minOf(ta.size, tb.size)
    }

    /**
     * Fallback when a listing doesn't provide a structured skills list: pull
     * capitalized/technical-looking tokens out of the free-text description.
     * Deliberately crude - this is a pre-filter, not the final judgment call.
     */
    private fun extractSkillLikeTokens(description: String): List<String> {
        val stopwords = setOf("the", "and", "for", "with", "you", "our", "will", "are", "this", "that")
        return description
            .split(Regex("[,.;\\n]"))
            .flatMap { it.split(Regex("\\s+")) }
            .map { it.trim().trim('.', ',', ';', ':').lowercase() }
            .filter { it.length in 3..30 && it !in stopwords }
            .distinct()
            .take(40)
    }
}
