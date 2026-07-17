package com.moame.app.ui.settings

import androidx.lifecycle.ViewModel
import com.moame.app.data.repository.SettingsRepository
import com.moame.app.gmail.GmailAuthManager
import com.moame.app.work.SyncScheduler
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

data class SettingsUiState(
    val anthropicApiKey: String = "",
    val adzunaAppId: String = "",
    val adzunaAppKey: String = "",
    val gmailAccountEmail: String? = null,
    val autoSubmitEnabledForAts: Boolean = false,
    val syncIntervalMinutes: Int = 30,
    val greenhouseBoardTokensCsv: String = "",
    val leverCompanySlugsCsv: String = "",
    val adzunaEnabled: Boolean = false,
    val adzunaQuery: String = "",
    val adzunaLocation: String = "",
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settingsRepository: SettingsRepository,
    val gmailAuthManager: GmailAuthManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(loadState())
    val uiState = _uiState.asStateFlow()

    private fun loadState() = SettingsUiState(
        anthropicApiKey = settingsRepository.anthropicApiKey.orEmpty(),
        adzunaAppId = settingsRepository.adzunaAppId.orEmpty(),
        adzunaAppKey = settingsRepository.adzunaAppKey.orEmpty(),
        gmailAccountEmail = settingsRepository.gmailAccountEmail,
        autoSubmitEnabledForAts = settingsRepository.autoSubmitEnabledForAtsSources,
        syncIntervalMinutes = settingsRepository.syncIntervalMinutes,
        greenhouseBoardTokensCsv = settingsRepository.greenhouseBoardTokensCsv,
        leverCompanySlugsCsv = settingsRepository.leverCompanySlugsCsv,
        adzunaEnabled = settingsRepository.adzunaEnabled,
        adzunaQuery = settingsRepository.adzunaQuery,
        adzunaLocation = settingsRepository.adzunaLocation,
    )

    fun saveAnthropicApiKey(value: String) {
        settingsRepository.anthropicApiKey = value
        _uiState.value = _uiState.value.copy(anthropicApiKey = value)
    }

    fun saveAdzunaCredentials(appId: String, appKey: String) {
        settingsRepository.adzunaAppId = appId
        settingsRepository.adzunaAppKey = appKey
        _uiState.value = _uiState.value.copy(adzunaAppId = appId, adzunaAppKey = appKey)
    }

    fun onGmailSignedIn(email: String) {
        settingsRepository.gmailAccountEmail = email
        _uiState.value = _uiState.value.copy(gmailAccountEmail = email)
    }

    fun signOutGmail() {
        gmailAuthManager.signOut()
        settingsRepository.gmailAccountEmail = null
        _uiState.value = _uiState.value.copy(gmailAccountEmail = null)
    }

    fun setAutoSubmitForAts(enabled: Boolean) {
        settingsRepository.autoSubmitEnabledForAtsSources = enabled
        _uiState.value = _uiState.value.copy(autoSubmitEnabledForAts = enabled)
    }

    fun setSyncInterval(context: android.content.Context, minutes: Int) {
        settingsRepository.syncIntervalMinutes = minutes
        _uiState.value = _uiState.value.copy(syncIntervalMinutes = minutes)
        SyncScheduler.schedule(context, minutes)
    }

    fun saveJobSources(
        greenhouseBoardTokensCsv: String,
        leverCompanySlugsCsv: String,
        adzunaEnabled: Boolean,
        adzunaQuery: String,
        adzunaLocation: String,
    ) {
        settingsRepository.greenhouseBoardTokensCsv = greenhouseBoardTokensCsv
        settingsRepository.leverCompanySlugsCsv = leverCompanySlugsCsv
        settingsRepository.adzunaEnabled = adzunaEnabled
        settingsRepository.adzunaQuery = adzunaQuery
        settingsRepository.adzunaLocation = adzunaLocation
        _uiState.value = _uiState.value.copy(
            greenhouseBoardTokensCsv = greenhouseBoardTokensCsv,
            leverCompanySlugsCsv = leverCompanySlugsCsv,
            adzunaEnabled = adzunaEnabled,
            adzunaQuery = adzunaQuery,
            adzunaLocation = adzunaLocation,
        )
    }
}
