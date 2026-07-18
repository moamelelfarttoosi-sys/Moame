package com.moame.core.email

import com.moame.core.model.EmailActionDecision
import com.moame.core.model.EmailCategory
import com.moame.core.model.EmailClassification
import com.moame.core.model.EmailItem

/**
 * Fast, deterministic rule-based first pass. This runs on every email locally
 * (cheap, no network/LLM call) to decide category + urgency + whether an
 * LLM-drafted reply even needs to be generated. Emails classified as
 * PROMOTION_SPAM never reach the LLM drafting step at all.
 */
class EmailClassifier {

    private val interviewKeywords = listOf(
        "interview", "schedule a call", "phone screen", "technical assessment",
        "would you be available", "invite you to interview", "meet the team",
    )
    private val recruiterKeywords = listOf(
        "recruiter", "talent acquisition", "hiring manager", "sourced your profile",
        "opportunity at", "reaching out regarding", "role at",
    )
    private val applicationKeywords = listOf(
        "your application", "application received", "thank you for applying",
        "application status", "candidate portal", "we have received your application",
    )
    private val urgentKeywords = listOf(
        "urgent", "asap", "immediate action", "action required", "deadline today",
        "final notice", "response needed", "please respond by",
    )
    private val assessmentKeywords = listOf(
        "assessment", "coding challenge", "take-home", "online test", "hackerrank", "codility",
    )
    private val rejectionKeywords = listOf(
        "not moving forward", "other candidates", "decided not to proceed",
        "unsuccessful", "regret to inform", "will not be progressing",
    )
    private val offerKeywords = listOf("pleased to offer", "job offer", "offer of employment", "congratulations")
    private val promoKeywords = listOf(
        "unsubscribe", "% off", "limited time offer", "newsletter", "webinar invite", "sale ends",
    )

    fun classify(email: EmailItem): EmailClassification {
        val haystack = "${email.subject}\n${email.bodyText}".lowercase()
        val reasons = mutableListOf<String>()

        val category = determineCategory(haystack, reasons)
        val hasAssessment = assessmentKeywords.any { haystack.contains(it) }
        val hasRejection = rejectionKeywords.any { haystack.contains(it) }
        val hasOffer = offerKeywords.any { haystack.contains(it) }
        val hasUrgentWord = urgentKeywords.any { haystack.contains(it) }

        val isUrgent = when (category) {
            EmailCategory.INTERVIEW_INVITATION -> true
            EmailCategory.URGENT_REQUEST -> true
            EmailCategory.JOB_APPLICATION -> hasAssessment || hasRejection || hasOffer
            EmailCategory.RECRUITER_MESSAGE -> hasUrgentWord
            else -> hasUrgentWord
        }
        if (isUrgent) reasons.add("Flagged urgent: category=$category, assessment=$hasAssessment, rejection=$hasRejection, offer=$hasOffer")

        val requiresApproval = when (category) {
            EmailCategory.PROMOTION_SPAM -> false
            EmailCategory.PERSONAL -> true
            EmailCategory.INTERVIEW_INVITATION, EmailCategory.URGENT_REQUEST,
            EmailCategory.JOB_APPLICATION, EmailCategory.RECRUITER_MESSAGE -> true
            EmailCategory.OTHER -> true
        }

        val decision = when {
            category == EmailCategory.PROMOTION_SPAM -> EmailActionDecision.NO_ACTION_NEEDED
            isUrgent || requiresApproval -> EmailActionDecision.NEEDS_USER_ATTENTION
            else -> EmailActionDecision.DRAFTED_AWAITING_APPROVAL
        }

        return EmailClassification(
            email = email,
            category = category,
            isUrgent = isUrgent,
            requiresApproval = requiresApproval,
            decision = decision,
            summaryBullets = emptyList(),
            reasons = reasons,
        )
    }

    private fun determineCategory(haystack: String, reasons: MutableList<String>): EmailCategory {
        return when {
            promoKeywords.any { haystack.contains(it) } -> {
                reasons.add("Matched promotional/marketing keywords")
                EmailCategory.PROMOTION_SPAM
            }
            interviewKeywords.any { haystack.contains(it) } -> {
                reasons.add("Matched interview-related keywords")
                EmailCategory.INTERVIEW_INVITATION
            }
            applicationKeywords.any { haystack.contains(it) } -> {
                reasons.add("Matched application-status keywords")
                EmailCategory.JOB_APPLICATION
            }
            recruiterKeywords.any { haystack.contains(it) } -> {
                reasons.add("Matched recruiter-outreach keywords")
                EmailCategory.RECRUITER_MESSAGE
            }
            urgentKeywords.any { haystack.contains(it) } -> {
                reasons.add("Matched urgent-request keywords")
                EmailCategory.URGENT_REQUEST
            }
            else -> EmailCategory.PERSONAL
        }
    }
}
