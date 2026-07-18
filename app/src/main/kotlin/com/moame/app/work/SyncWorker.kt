package com.moame.app.work

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.moame.app.data.repository.ApplicationRepository
import com.moame.app.data.repository.EmailRepository
import com.moame.app.data.repository.ProfileRepository
import com.moame.app.data.repository.ReminderRepository
import com.moame.app.data.repository.SettingsRepository
import com.moame.app.di.AiServicesFactory
import com.moame.app.gmail.GmailRepository
import com.moame.app.jobsource.JobSourceAggregator
import com.moame.app.jobsource.toJobSourceConfig
import com.moame.app.notification.NotificationHelper
import com.moame.core.email.EmailClassifier
import com.moame.core.matching.JobMatcher
import com.moame.core.model.EmailActionDecision
import com.moame.core.model.JobMatchResult
import com.moame.core.model.ReminderType
import com.moame.core.model.automationPolicy
import com.moame.core.model.AutomationPolicy
import com.moame.core.reminder.UrgencyEngine
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/**
 * Periodic background pass: fetch new emails, classify them, fetch new job
 * listings from configured auto-apply-eligible sources, match against the
 * profile, tailor + (if enabled) auto-submit for high-confidence ATS matches,
 * and surface reminders/notifications for anything that needs the user's
 * attention. Runs on Android's WorkManager schedule (default ~30 min,
 * subject to Doze/battery-optimization - see README.md for what "periodic"
 * really means on-device).
 */
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val profileRepository: ProfileRepository,
    private val applicationRepository: ApplicationRepository,
    private val emailRepository: EmailRepository,
    private val reminderRepository: ReminderRepository,
    private val settingsRepository: SettingsRepository,
    private val gmailRepository: GmailRepository,
    private val jobSourceAggregator: JobSourceAggregator,
    private val jobMatcher: JobMatcher,
    private val emailClassifier: EmailClassifier,
    private val aiServicesFactory: AiServicesFactory,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val now = System.currentTimeMillis()
        return runCatching {
            syncEmails(now)
            syncJobs(now)
            Result.success()
        }.getOrElse {
            Result.retry()
        }
    }

    private suspend fun syncEmails(now: Long) {
        if (settingsRepository.gmailAccountEmail.isNullOrBlank()) return
        val emails = gmailRepository.fetchRecentEmails()
        val emailAssist = aiServicesFactory.emailAssistServiceOrNull()

        for (email in emails) {
            val classification = emailClassifier.classify(email)
            val isNew = emailRepository.insertIfNew(classification)
            if (!isNew) continue

            if (classification.isUrgent) {
                reminderRepository.upsert(
                    UrgencyEngine.buildReminder(
                        id = "email_${email.id}",
                        type = ReminderType.EMAIL_RESPONSE_NEEDED,
                        title = "Urgent email: ${email.subject}",
                        reason = "From ${email.from} - classified as urgent (${classification.category})",
                        nowMillis = now,
                        dueAtMillis = null,
                        relatedEntityId = email.id,
                    ),
                )
                applicationContext.notifyHigh("Urgent: ${email.subject}", "From ${email.from}")
            }

            if (classification.decision == EmailActionDecision.DRAFTED_AWAITING_APPROVAL && !classification.requiresApproval && emailAssist != null) {
                // Only reached for low-stakes categories that EmailClassifier explicitly
                // marked as not requiring approval (see EmailClassifier.requiresApproval).
                val reply = emailAssist.draftReply(classification)
                val fromAddress = settingsRepository.gmailAccountEmail
                if (!fromAddress.isNullOrBlank()) {
                    gmailRepository.sendReply(email, reply, fromAddress)
                    emailRepository.markAutoReplySent(email, reply, now)
                }
            } else if (classification.requiresApproval) {
                applicationContext.notifyApproval("Reply needs your approval", email.subject)
            }
        }
    }

    private suspend fun syncJobs(now: Long) {
        val config = settingsRepository.toJobSourceConfig()
        val listings = jobSourceAggregator.fetchAll(
            config,
            settingsRepository.adzunaAppId,
            settingsRepository.adzunaAppKey,
        )
        if (listings.isEmpty()) return

        val profile = profileRepository.getProfile()
        val matches = jobMatcher.matchAndFilter(profile, listings)
        val tailoringService = aiServicesFactory.resumeTailoringServiceOrNull() ?: return

        for (match in matches) {
            if (applicationRepository.alreadyApplied(match.job.id)) continue

            val materials = tailoringService.tailor(profile, match.job)
            val application = applicationRepository.recordDraft(
                match.job, materials.resumeText, materials.coverLetterText, now,
            )

            val canAutoApply = match.job.source.automationPolicy() == AutomationPolicy.FULL_AUTO_APPLY_ALLOWED &&
                settingsRepository.autoSubmitEnabledForAtsSources &&
                match.score >= HIGH_CONFIDENCE_THRESHOLD

            if (canAutoApply) {
                applicationRepository.markSubmitted(application, automatically = true, nowMillis = now)
                applicationContext.notifyMedium(
                    "Applied automatically: ${match.job.title}",
                    "${match.job.company} - match score ${(match.score * 100).toInt()}%",
                )
            } else {
                applicationContext.notifyApproval(
                    "Application ready for your review: ${match.job.title}",
                    "${match.job.company} - tap to review and submit",
                )
                reminderRepository.upsert(
                    UrgencyEngine.buildReminder(
                        id = "apply_${application.id}",
                        type = ReminderType.TASK_DEADLINE,
                        title = "Review application: ${match.job.title} at ${match.job.company}",
                        reason = reasonFor(match),
                        nowMillis = now,
                        dueAtMillis = null,
                        relatedEntityId = application.id,
                    ),
                )
            }
        }
    }

    private fun reasonFor(match: JobMatchResult): String =
        "Match score ${(match.score * 100).toInt()}%. ${match.reasons.joinToString("; ")}"

    private fun Context.notifyHigh(title: String, text: String) =
        NotificationHelper.notify(this, title.hashCode(), NotificationHelper.CHANNEL_HIGH, title, text)

    private fun Context.notifyMedium(title: String, text: String) =
        NotificationHelper.notify(this, title.hashCode(), NotificationHelper.CHANNEL_MEDIUM, title, text)

    private fun Context.notifyApproval(title: String, text: String) =
        NotificationHelper.notify(this, title.hashCode(), NotificationHelper.CHANNEL_APPROVAL, title, text)

    companion object {
        const val HIGH_CONFIDENCE_THRESHOLD = 0.75
        const val UNIQUE_WORK_NAME = "moame_periodic_sync"
    }
}
