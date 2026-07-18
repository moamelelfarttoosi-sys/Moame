package com.moame.core.email

import com.moame.core.model.EmailActionDecision
import com.moame.core.model.EmailCategory
import com.moame.core.model.EmailItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EmailClassifierTest {

    private fun email(subject: String, body: String, from: String = "someone@example.com") = EmailItem(
        id = "e1",
        threadId = "t1",
        from = from,
        subject = subject,
        snippet = body.take(100),
        bodyText = body,
        receivedAt = 0L,
        isUnread = true,
    )

    @Test
    fun `interview invitation is categorized and urgent`() {
        val result = EmailClassifier().classify(
            email(
                subject = "Interview Invitation - Contracts Engineer",
                body = "We would like to invite you to interview for the role. Would you be available next Tuesday?",
            ),
        )
        assertEquals(EmailCategory.INTERVIEW_INVITATION, result.category)
        assertTrue(result.isUrgent)
        assertEquals(EmailActionDecision.NEEDS_USER_ATTENTION, result.decision)
    }

    @Test
    fun `promotional email is not urgent and needs no action`() {
        val result = EmailClassifier().classify(
            email(
                subject = "50% off - limited time offer!",
                body = "Check out our newsletter and sale ends soon. Unsubscribe at any time.",
            ),
        )
        assertEquals(EmailCategory.PROMOTION_SPAM, result.category)
        assertTrue(!result.isUrgent)
        assertEquals(EmailActionDecision.NO_ACTION_NEEDED, result.decision)
    }

    @Test
    fun `application status with rejection language is urgent`() {
        val result = EmailClassifier().classify(
            email(
                subject = "Your application update",
                body = "Thank you for applying. We regret to inform you we will not be progressing with your application.",
            ),
        )
        assertEquals(EmailCategory.JOB_APPLICATION, result.category)
        assertTrue(result.isUrgent)
    }

    @Test
    fun `recruiter outreach without urgent language is not urgent but requires approval`() {
        val result = EmailClassifier().classify(
            email(
                subject = "Opportunity at a growing EPC firm",
                body = "Hi, I'm a recruiter reaching out regarding a role at our company that matches your background.",
            ),
        )
        assertEquals(EmailCategory.RECRUITER_MESSAGE, result.category)
        assertTrue(!result.isUrgent)
        assertTrue(result.requiresApproval)
    }

    @Test
    fun `generic personal email is drafted awaiting approval not auto sent`() {
        val result = EmailClassifier().classify(
            email(subject = "Dinner this weekend?", body = "Hey, are you free for dinner this weekend?"),
        )
        assertEquals(EmailCategory.PERSONAL, result.category)
        assertEquals(EmailActionDecision.NEEDS_USER_ATTENTION, result.decision)
    }
}
