package com.moame.app.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.moame.app.data.db.ActionLogEntity
import com.moame.app.data.repository.ActionLogRepository
import com.moame.app.data.repository.ApplicationRepository
import com.moame.app.data.repository.EmailRepository
import com.moame.app.data.repository.ReminderRepository
import com.moame.core.model.Reminder
import com.moame.core.model.ReminderType
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

data class DashboardUiState(
    val jobsAppliedCount: Int = 0,
    val emailsHandledCount: Int = 0,
    val upcomingInterviews: List<Reminder> = emptyList(),
    val pendingTasksCount: Int = 0,
    val importantReminders: List<Reminder> = emptyList(),
    val recentActivity: List<ActionLogEntity> = emptyList(),
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    applicationRepository: ApplicationRepository,
    emailRepository: EmailRepository,
    reminderRepository: ReminderRepository,
    actionLogRepository: ActionLogRepository,
) : ViewModel() {

    val uiState = combine(
        applicationRepository.observeAppliedCount(),
        emailRepository.observeHandledCount(),
        reminderRepository.observeActive(),
        actionLogRepository.observeRecent(20),
    ) { appliedCount, handledCount, reminders, recentActivity ->
        DashboardUiState(
            jobsAppliedCount = appliedCount,
            emailsHandledCount = handledCount,
            upcomingInterviews = reminders.filter {
                it.type == ReminderType.INTERVIEW_INVITATION || it.type == ReminderType.INTERVIEW_UPCOMING
            },
            pendingTasksCount = reminders.size,
            importantReminders = reminders.take(10),
            recentActivity = recentActivity,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DashboardUiState())
}
