package com.moame.app.gmail

import android.util.Base64
import com.google.api.services.gmail.Gmail
import com.google.api.services.gmail.model.Message
import com.google.api.services.gmail.model.ModifyMessageRequest
import com.moame.core.model.EmailItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Properties
import javax.inject.Inject
import javax.inject.Singleton
import javax.mail.Session
import javax.mail.internet.InternetAddress
import javax.mail.internet.MimeMessage
import java.io.ByteArrayOutputStream

@Singleton
class GmailRepository @Inject constructor(private val authManager: GmailAuthManager) {

    /** Fetches the most recent messages (default: unread only) as domain EmailItems. */
    suspend fun fetchRecentEmails(maxResults: Long = 25, unreadOnly: Boolean = true): List<EmailItem> =
        withContext(Dispatchers.IO) {
            val gmail = clientOrNull() ?: return@withContext emptyList()
            val query = if (unreadOnly) "is:unread" else null
            val listResponse = gmail.users().messages().list("me")
                .setMaxResults(maxResults)
                .apply { if (query != null) q = query }
                .execute()

            val messages = listResponse.messages ?: return@withContext emptyList()
            messages.mapNotNull { ref ->
                runCatching {
                    val full = gmail.users().messages().get("me", ref.id).setFormat("full").execute()
                    full.toEmailItem()
                }.getOrNull()
            }
        }

    suspend fun sendReply(originalEmail: EmailItem, replyBodyText: String, fromAddress: String): Boolean =
        withContext(Dispatchers.IO) {
            val gmail = clientOrNull() ?: return@withContext false
            val original = gmail.users().messages().get("me", originalEmail.id).setFormat("metadata").execute()
            val subject = if (originalEmail.subject.startsWith("Re:", ignoreCase = true)) {
                originalEmail.subject
            } else {
                "Re: ${originalEmail.subject}"
            }

            val session = Session.getDefaultInstance(Properties())
            val mimeMessage = MimeMessage(session).apply {
                setFrom(InternetAddress(fromAddress))
                addRecipient(javax.mail.Message.RecipientType.TO, InternetAddress(originalEmail.from))
                setSubject(subject)
                setText(replyBodyText)
                setHeader("In-Reply-To", original.id)
                setHeader("References", original.id)
            }

            val buffer = ByteArrayOutputStream()
            mimeMessage.writeTo(buffer)
            val encodedEmail = Base64.encodeToString(buffer.toByteArray(), Base64.URL_SAFE or Base64.NO_WRAP)

            val message = Message().apply {
                raw = encodedEmail
                threadId = originalEmail.threadId
            }
            gmail.users().messages().send("me", message).execute()
            true
        }

    suspend fun applyLabel(emailId: String, labelName: String): Unit = withContext(Dispatchers.IO) {
        val gmail = clientOrNull() ?: return@withContext
        val labelId = findOrCreateLabel(gmail, labelName) ?: return@withContext
        gmail.users().messages().modify(
            "me", emailId,
            ModifyMessageRequest().setAddLabelIds(listOf(labelId)),
        ).execute()
    }

    private fun findOrCreateLabel(gmail: Gmail, labelName: String): String? {
        val existing = gmail.users().labels().list("me").execute().labels
            ?.firstOrNull { it.name.equals(labelName, ignoreCase = true) }
        if (existing != null) return existing.id

        val created = gmail.users().labels().create(
            "me",
            com.google.api.services.gmail.model.Label().setName(labelName)
                .setLabelListVisibility("labelShow")
                .setMessageListVisibility("show"),
        ).execute()
        return created.id
    }

    private fun clientOrNull(): Gmail? {
        val account = authManager.currentAccount() ?: return null
        return authManager.gmailClientFor(account)
    }

    private fun Message.toEmailItem(): EmailItem {
        val headers = payload?.headers.orEmpty()
        val subject = headers.firstOrNull { it.name.equals("Subject", ignoreCase = true) }?.value.orEmpty()
        val from = headers.firstOrNull { it.name.equals("From", ignoreCase = true) }?.value.orEmpty()
        val bodyText = extractPlainTextBody(this) ?: snippet.orEmpty()
        return EmailItem(
            id = id,
            threadId = threadId ?: id,
            from = from,
            subject = subject,
            snippet = snippet.orEmpty(),
            bodyText = bodyText,
            receivedAt = internalDate ?: 0L,
            isUnread = labelIds?.contains("UNREAD") == true,
            labels = labelIds.orEmpty(),
        )
    }

    private fun extractPlainTextBody(message: Message): String? {
        val payload = message.payload ?: return null
        fun decode(data: String?): String? = data?.let {
            runCatching { String(Base64.decode(it, Base64.URL_SAFE)) }.getOrNull()
        }

        if (payload.mimeType == "text/plain") {
            decode(payload.body?.data)?.let { return it }
        }
        val parts = payload.parts ?: return decode(payload.body?.data)
        val plainPart = parts.firstOrNull { it.mimeType == "text/plain" }
        if (plainPart != null) decode(plainPart.body?.data)?.let { return it }
        val htmlPart = parts.firstOrNull { it.mimeType == "text/html" }
        return htmlPart?.let { decode(it.body?.data) }
    }
}
