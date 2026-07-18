package com.moame.core.reminder

import com.moame.core.model.ReminderType
import com.moame.core.model.Urgency
import org.junit.Assert.assertEquals
import org.junit.Test

class UrgencyEngineTest {

    private val now = 1_000_000_000_000L
    private fun hoursFromNow(hours: Long) = now + hours * 3_600_000L

    @Test
    fun `interview invitation due in 12 hours is high urgency`() {
        val urgency = UrgencyEngine.urgencyFor(ReminderType.INTERVIEW_INVITATION, now, hoursFromNow(12))
        assertEquals(Urgency.HIGH, urgency)
    }

    @Test
    fun `application deadline in 5 days is low urgency`() {
        val urgency = UrgencyEngine.urgencyFor(ReminderType.APPLICATION_DEADLINE, now, hoursFromNow(120))
        assertEquals(Urgency.LOW, urgency)
    }

    @Test
    fun `overdue deadline is always high urgency`() {
        val urgency = UrgencyEngine.urgencyFor(ReminderType.TASK_DEADLINE, now, hoursFromNow(-5))
        assertEquals(Urgency.HIGH, urgency)
    }

    @Test
    fun `no due date falls back to type default`() {
        val urgency = UrgencyEngine.urgencyFor(ReminderType.EMAIL_RESPONSE_NEEDED, now, null)
        assertEquals(Urgency.HIGH, urgency)
    }

    @Test
    fun `sortForDisplay orders high urgency before low regardless of due date proximity`() {
        val lowUrgencyButFarDue = UrgencyEngine.buildReminder(
            id = "r1", type = ReminderType.INTERVIEW_INVITATION, title = "Interview",
            reason = "test", nowMillis = now, dueAtMillis = hoursFromNow(200),
        )
        val highUrgencyOverdue = UrgencyEngine.buildReminder(
            id = "r2", type = ReminderType.TASK_DEADLINE, title = "Task",
            reason = "test", nowMillis = now, dueAtMillis = hoursFromNow(-1),
        )
        val sorted = UrgencyEngine.sortForDisplay(listOf(lowUrgencyButFarDue, highUrgencyOverdue), now)
        assertEquals("r2", sorted.first().id)
    }
}
