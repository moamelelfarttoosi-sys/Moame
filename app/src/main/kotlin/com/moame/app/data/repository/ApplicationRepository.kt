package com.moame.app.data.repository

import com.moame.app.data.db.ActionLogDao
import com.moame.app.data.db.ActionLogEntity
import com.moame.app.data.db.JobApplicationDao
import com.moame.app.data.db.JobApplicationEntity
import com.moame.core.model.ApplicationStatus
import com.moame.core.model.JobApplication
import com.moame.core.model.JobListing
import com.moame.core.model.StatusChange
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ApplicationRepository @Inject constructor(
    private val dao: JobApplicationDao,
    private val actionLogDao: ActionLogDao,
) {
    private val json = Json { ignoreUnknownKeys = true }

    fun observeAll(): Flow<List<JobApplication>> = dao.observeAll().map { list -> list.map { it.toModel(json) } }

    fun observeAppliedCount(): Flow<Int> = dao.observeCount()

    suspend fun alreadyApplied(jobId: String): Boolean = dao.findByJobId(jobId) != null

    suspend fun recordDraft(
        job: JobListing,
        tailoredResume: String,
        tailoredCoverLetter: String,
        nowMillis: Long,
    ): JobApplication {
        val application = JobApplication(
            id = "app_${job.id}_$nowMillis",
            jobId = job.id,
            jobTitle = job.title,
            company = job.company,
            source = job.source,
            appliedAt = null,
            status = ApplicationStatus.DRAFTED,
            tailoredResumeText = tailoredResume,
            tailoredCoverLetterText = tailoredCoverLetter,
            submittedAutomatically = false,
            statusHistory = listOf(StatusChange(ApplicationStatus.DRAFTED, nowMillis, "Tailored materials generated")),
        )
        dao.upsert(application.toEntity(json, nowMillis))
        return application
    }

    suspend fun markSubmitted(application: JobApplication, automatically: Boolean, nowMillis: Long) {
        val updated = application.copy(
            appliedAt = nowMillis,
            status = ApplicationStatus.SUBMITTED,
            submittedAutomatically = automatically,
            statusHistory = application.statusHistory + StatusChange(
                ApplicationStatus.SUBMITTED, nowMillis,
                if (automatically) "Auto-submitted" else "Submitted by user",
            ),
        )
        dao.update(updated.toEntity(json, nowMillis))
        actionLogDao.insert(
            ActionLogEntity(
                timestamp = nowMillis,
                category = "APPLICATION",
                summary = "Applied to ${updated.jobTitle} at ${updated.company}",
                detail = if (automatically) "Submitted automatically (ATS auto-apply)" else "Submitted by user",
                requiredApproval = !automatically,
                wasApproved = if (automatically) null else true,
            ),
        )
    }

    suspend fun updateStatus(application: JobApplication, newStatus: ApplicationStatus, detail: String, nowMillis: Long) {
        val updated = application.copy(
            status = newStatus,
            statusHistory = application.statusHistory + StatusChange(newStatus, nowMillis, detail),
        )
        dao.update(updated.toEntity(json, nowMillis))
    }
}

private fun JobApplicationEntity.toModel(json: Json): JobApplication = JobApplication(
    id = id,
    jobId = jobId,
    jobTitle = jobTitle,
    company = company,
    source = source,
    appliedAt = appliedAt,
    status = status,
    tailoredResumeText = tailoredResumeText,
    tailoredCoverLetterText = tailoredCoverLetterText,
    submittedAutomatically = submittedAutomatically,
    statusHistory = if (statusHistoryJson.isBlank()) emptyList() else json.decodeFromString(statusHistoryJson),
    notes = notes,
)

private fun JobApplication.toEntity(json: Json, createdAt: Long): JobApplicationEntity = JobApplicationEntity(
    id = id,
    jobId = jobId,
    jobTitle = jobTitle,
    company = company,
    source = source,
    appliedAt = appliedAt,
    status = status,
    tailoredResumeText = tailoredResumeText,
    tailoredCoverLetterText = tailoredCoverLetterText,
    submittedAutomatically = submittedAutomatically,
    statusHistoryJson = json.encodeToString(statusHistory),
    notes = notes,
    createdAt = createdAt,
)
