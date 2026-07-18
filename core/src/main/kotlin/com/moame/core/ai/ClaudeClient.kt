package com.moame.core.ai

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Thin wrapper over the Anthropic Messages API. The Android app supplies the
 * API key from encrypted local settings (entered by the user) — this class
 * never stores or hardcodes a key itself.
 */
class ClaudeClient(
    private val apiKey: String,
    private val model: String = "claude-sonnet-5",
    private val httpClient: HttpClient = defaultHttpClient(),
    private val baseUrl: String = "https://api.anthropic.com/v1/messages",
) {
    suspend fun complete(systemPrompt: String, userPrompt: String, maxTokens: Int = 1024): String {
        val response = httpClient.post(baseUrl) {
            contentType(ContentType.Application.Json)
            header("x-api-key", apiKey)
            header("anthropic-version", "2023-06-01")
            setBody(
                MessagesRequest(
                    model = model,
                    maxTokens = maxTokens,
                    system = systemPrompt,
                    messages = listOf(Message(role = "user", content = userPrompt)),
                ),
            )
        }
        val parsed: MessagesResponse = response.body()
        return parsed.content.joinToString("\n") { it.text }
    }

    companion object {
        fun defaultHttpClient(): HttpClient = HttpClient {
            install(ContentNegotiation) {
                json(Json { ignoreUnknownKeys = true })
            }
        }
    }
}

@Serializable
private data class MessagesRequest(
    val model: String,
    @SerialName("max_tokens") val maxTokens: Int,
    val system: String,
    val messages: List<Message>,
)

@Serializable
private data class Message(val role: String, val content: String)

@Serializable
private data class MessagesResponse(val content: List<ContentBlock>)

@Serializable
private data class ContentBlock(val type: String = "text", val text: String = "")
