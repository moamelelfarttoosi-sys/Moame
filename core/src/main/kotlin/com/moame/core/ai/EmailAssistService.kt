package com.moame.core.ai

import com.moame.core.model.EmailClassification

data class EmailAssistResult(
    val summaryBullets: List<String>,
    val suggestedReply: String?,
)

/**
 * LLM-backed summarization and reply drafting. Only called for emails that
 * EmailClassifier decided are worth spending an API call on (not spam, not
 * trivially ignorable). Whether a drafted reply gets auto-sent or held for
 * approval is decided by EmailClassification.requiresApproval, upstream of
 * this class — this service only drafts, it never sends.
 */
class EmailAssistService(private val claudeClient: ClaudeClient) {

    suspend fun summarize(classification: EmailClassification): List<String> {
        val email = classification.email
        if (email.bodyText.length < 400) {
            // Short emails don't need LLM summarization; return as a single bullet.
            return listOf(email.snippet.ifBlank { email.bodyText.take(200) })
        }
        val system = "Summarize the email into 2-5 short bullet points capturing only the key facts and any action needed. Plain text, one bullet per line, no preamble."
        val user = "Subject: ${email.subject}\nFrom: ${email.from}\n\n${email.bodyText}"
        val raw = claudeClient.complete(system, user, maxTokens = 300)
        return raw.lines().map { it.trim().removePrefix("-").removePrefix("*").trim() }.filter { it.isNotBlank() }
    }

    suspend fun draftReply(classification: EmailClassification, userContextNotes: String = ""): String {
        val email = classification.email
        val system = """
            Draft a concise, professional email reply on behalf of the recipient.
            Match a warm but professional tone. Do not invent facts, commitments,
            availability, or figures not present in the notes provided. If
            information is missing (e.g. a specific date/time), leave a clearly
            marked placeholder like [YOUR AVAILABILITY] rather than guessing.
        """.trimIndent()
        val user = buildString {
            appendLine("Original email:")
            appendLine("Subject: ${email.subject}")
            appendLine("From: ${email.from}")
            appendLine(email.bodyText)
            if (userContextNotes.isNotBlank()) {
                appendLine()
                appendLine("Additional context to use when drafting the reply:")
                appendLine(userContextNotes)
            }
        }
        return claudeClient.complete(system, user, maxTokens = 500).trim()
    }
}
