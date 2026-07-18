package com.moame.app.ui.applications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.moame.app.data.repository.ApplicationRepository
import com.moame.core.model.ApplicationStatus
import com.moame.core.model.JobApplication
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ApplicationsViewModel @Inject constructor(
    private val applicationRepository: ApplicationRepository,
) : ViewModel() {

    val applications = applicationRepository.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** User confirms they submitted a manual-assist (LinkedIn/Indeed/other) application by hand. */
    fun markSubmittedManually(application: JobApplication) {
        viewModelScope.launch {
            applicationRepository.markSubmitted(application, automatically = false, nowMillis = System.currentTimeMillis())
        }
    }

    fun updateStatus(application: JobApplication, status: ApplicationStatus, detail: String) {
        viewModelScope.launch {
            applicationRepository.updateStatus(application, status, detail, System.currentTimeMillis())
        }
    }
}
