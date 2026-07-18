package com.moame.core.model

import kotlinx.serialization.Serializable

/**
 * A user's professional profile. Deliberately generic (not tied to any one
 * discipline) so the same schema seeds an oil & gas procurement profile today
 * and a different specialist profile tomorrow.
 */
@Serializable
data class Profile(
    val id: String,
    val fullName: String,
    val headline: String,
    val email: String,
    val phone: String,
    val location: String,
    val linkedInUrl: String? = null,
    val summary: String,
    val yearsOfExperience: Int,
    val skills: List<String>,
    val coreCompetencyGroups: List<CompetencyGroup>,
    val experience: List<ExperienceEntry>,
    val education: List<EducationEntry>,
    val certifications: List<String>,
    val languages: List<LanguageProficiency>,
    val preferences: JobPreferences,
)

@Serializable
data class CompetencyGroup(
    val name: String,
    val items: List<String>,
)

@Serializable
data class ExperienceEntry(
    val title: String,
    val company: String,
    val location: String,
    val startDate: String,
    val endDate: String?,
    val isCurrent: Boolean = endDate == null,
    val bullets: List<String>,
)

@Serializable
data class EducationEntry(
    val degree: String,
    val institution: String,
    val location: String,
    val startYear: Int,
    val endYear: Int,
    val notes: List<String> = emptyList(),
)

@Serializable
data class LanguageProficiency(
    val language: String,
    val proficiency: String,
)

@Serializable
data class JobPreferences(
    val desiredTitles: List<String>,
    val minSalary: Int? = null,
    val currency: String = "USD",
    val locations: List<String>,
    val remoteOk: Boolean = true,
    val excludedCompanies: List<String> = emptyList(),
    val excludedKeywords: List<String> = emptyList(),
)
