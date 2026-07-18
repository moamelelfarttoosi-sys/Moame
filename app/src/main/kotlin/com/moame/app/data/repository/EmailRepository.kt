package com.moame.app.data.repository

import com.moame.app.data.db.ActionLogDao
import com.moame.app.data.db.ActionLogEntity
import com.moame.app.data.db.EmailDao
import com.moame.app.data.db.EmailEntity
import com.moame.core.model.EmailActionDecision
import com.moame.core.model.EmailClassification
import com.moame.core.model.EmailItem
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class EmailRepository @Inject constructor(
    private val dao: EmailDao,
    private val actionLogDao: ActionLogDao,
) {
    private val json = Json { ignoreUnknownKeys = true }

    fun observeAll(): Flow<List<EmailClassification>> = dao.observeAll().map { list -> list.map { it.toModel(json) } }

    fun observePendingAttention(): Flow<List<EmailClassification>> =
        dao.observePendingAttention().map { list -> list.map { it.toModel(json) } }

    fun observeHandledCount(): Flow<Int> = dao.observeHandledCount()

    /** Returns true if this email was newly inserted (i.e. not seen before). */
    suspend fun insertIfNew(classification: EmailClassification): Boolean {
        val rowId = dao.insertIfNew(classification.toEntity(json, handledAt = null))
        return rowId != -1L
    }

    suspend fun markAutoReplySent(email: EmailItem, replyText: String, nowMillis: Long) {
        val entity = dao.findById(email.id) ?: return
        dao.update(entity.copy(handledAt = nowMillis, suggestedReply = replyText))
        actionLogDao.insert(
            ActionLogEntity(
                timestamp = nowMillis,
                category = "EMAIL",
                summary = "Auto-replied to '${email.subject}' from ${email.from}",
                detail = replyText,
                requiredApproval = false,
                wasApproved = null,
            ),
        )
    }

    suspend fun approveAndSend(classification: EmailClassification, finalReplyText: String, nowMillis: Long) {
        val entity = dao.findById(classification.email.id) ?: return
        dao.update(entity.copy(handledAt = nowMillis, suggestedReply = finalReplyText))
        actionLogDao.insert(
            ActionLogEntity(
                timestamp = nowMillis,
                category = "EMAIL",
                summary = "Sent (with your approval) reply to '${classification.email.subject}'",
                detail = finalReplyText,
                requiredApproval = true,
                wasApproved = true,
            ),
        )
    }

    suspend fun dismiss(email: EmailItem, nowMillis: Long) {
        val entity = dao.findById(email.id) ?: return
        dao.update(entity.copy(handledAt = nowMillis))
    }
}

private fun EmailEntity.toModel(json: Json): EmailClassification {
    val item = EmailItem(
        id = id,
        threadId = threadId,
        from = from,
        subject = subject,
        snippet = snippet,
        bodyText = bodyText,
        receivedAt = receivedAt,
        isUnread = isUnread,
        labels = if (labelsJson.isBlank()) emptyList() else json.decodeFromString(labelsJson),
    )
    return EmailClassification(
        email = item,
        category = category,
        isUrgent = isUrgent,
        requiresApproval = requiresApproval,
        decision = EmailActionDecision.valueOf(decision),
        summaryBullets = if (summaryBulletsJson.isBlank()) emptyList() else json.decodeFromString(summaryBulletsJson),
        suggestedReply = suggestedReply,
        reasons = emptyList(),
    )
}

private fun EmailClassification.toEntity(json: Json, handledAt: Long?): EmailEntity = EmailEntity(
    id = email.id,
    threadId = email.threadId,
    from = email.from,
    subject = email.subject,
    snippet = email.snippet,
    bodyText = email.bodyText,
    receivedAt = email.receivedAt,
    isUnread = email.isUnread,
    labelsJson = json.encodeToString(email.labels),
    category = category,
    isUrgent = isUrgent,
    requiresApproval = requiresApproval,
    decision = decision.name,
    summaryBulletsJson = json.encodeToString(summaryBullets),
    suggestedReply = suggestedReply,
    handledAt = handledAt,
)
