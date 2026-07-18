package com.moame.app.ui.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.moame.core.model.Reminder
import com.moame.core.model.Urgency

@Composable
fun DashboardScreen(viewModel: DashboardViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(topBar = { TopAppBar(title = { Text("Moame") }) }) { padding ->
        LazyColumn(modifier = Modifier.padding(padding).fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatCard("Jobs applied", state.jobsAppliedCount.toString(), Modifier.weight(1f))
                    StatCard("Emails handled", state.emailsHandledCount.toString(), Modifier.weight(1f))
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatCard("Upcoming interviews", state.upcomingInterviews.size.toString(), Modifier.weight(1f))
                    StatCard("Pending tasks", state.pendingTasksCount.toString(), Modifier.weight(1f))
                }
            }
            item { SectionHeader("Important reminders") }
            items(state.importantReminders, key = { it.id }) { reminder -> ReminderRow(reminder) }
            item { SectionHeader("Recent activity") }
            items(state.recentActivity, key = { it.id }) { entry ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp)) {
                        Text(entry.summary, style = MaterialTheme.typography.bodyMedium)
                        if (entry.detail.isNotBlank()) {
                            Text(entry.detail, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier) {
        Column(Modifier.padding(16.dp)) {
            Text(value, style = MaterialTheme.typography.headlineMedium)
            Text(label, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
}

@Composable
private fun ReminderRow(reminder: Reminder) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(urgencyLabel(reminder.urgency), style = MaterialTheme.typography.labelSmall)
                Text(reminder.title, style = MaterialTheme.typography.bodyMedium)
            }
            Text(reminder.reason, style = MaterialTheme.typography.bodySmall)
            Text("Recommended: ${reminder.recommendedAction}", style = MaterialTheme.typography.bodySmall)
        }
    }
}

private fun urgencyLabel(urgency: Urgency): String = when (urgency) {
    Urgency.HIGH -> "[HIGH]"
    Urgency.MEDIUM -> "[MEDIUM]"
    Urgency.LOW -> "[LOW]"
}
