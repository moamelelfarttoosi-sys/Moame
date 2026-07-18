package com.moame.app.ui.emails

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.moame.app.data.repository.EmailRepository
import com.moame.app.data.repository.SettingsRepository
import com.moame.app.di.AiServicesFactory
import com.moame.app.gmail.GmailRepository
import com.moame.core.model.EmailClassification
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class EmailsViewModel @Inject constructor(
    private val emailRepository: EmailRepository,
    private val gmailRepository: GmailRepository,
    private val settingsRepository: SettingsRepository,
    private val aiServicesFactory: AiServicesFactory,
) : ViewModel() {

    val pendingAttention = emailRepository.observePendingAttention()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun approveAndSend(classification: EmailClassification, finalText: String) {
        viewModelScope.launch {
            val fromAddress = settingsRepository.gmailAccountEmail ?: return@launch
            val sent = gmailRepository.sendReply(classification.email, finalText, fromAddress)
            if (sent) {
                emailRepository.approveAndSend(classification, finalText, System.currentTimeMillis())
            }
        }
    }

    fun dismiss(classification: EmailClassification) {
        viewModelScope.launch {
            emailRepository.dismiss(classification.email, System.currentTimeMillis())
        }
    }

    /** Generates (or regenerates) a draft reply on demand, e.g. if the user wants a fresh suggestion. */
    suspend fun generateDraft(classification: EmailClassification): String? =
        aiServicesFactory.emailAssistServiceOrNull()?.draftReply(classification)
}
