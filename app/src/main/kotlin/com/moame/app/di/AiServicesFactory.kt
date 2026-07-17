package com.moame.app.di

import com.moame.app.data.repository.SettingsRepository
import com.moame.core.ai.ClaudeClient
import com.moame.core.ai.EmailAssistService
import com.moame.core.ai.ResumeTailoringService
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Builds AI-backed services using whatever API key is currently in Settings.
 * Not a plain Hilt-provided singleton because the key can change at runtime
 * (user edits it in the Settings screen) without an app restart.
 */
@Singleton
class AiServicesFactory @Inject constructor(private val settingsRepository: SettingsRepository) {

    fun resumeTailoringServiceOrNull(): ResumeTailoringService? =
        claudeClientOrNull()?.let { ResumeTailoringService(it) }

    fun emailAssistServiceOrNull(): EmailAssistService? =
        claudeClientOrNull()?.let { EmailAssistService(it) }

    private fun claudeClientOrNull(): ClaudeClient? {
        val key = settingsRepository.anthropicApiKey
        if (key.isNullOrBlank()) return null
        return ClaudeClient(apiKey = key)
    }
}
