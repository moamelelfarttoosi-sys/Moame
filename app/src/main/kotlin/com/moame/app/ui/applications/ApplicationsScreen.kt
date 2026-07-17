package com.moame.app.ui.applications

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
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
import com.moame.core.model.ApplicationStatus
import com.moame.core.model.JobApplication
import com.moame.core.model.JobSource
import com.moame.core.model.automationPolicy
import com.moame.core.model.AutomationPolicy

@Composable
fun ApplicationsScreen(viewModel: ApplicationsViewModel = hiltViewModel()) {
    val applications by viewModel.applications.collectAsState()

    Scaffold(topBar = { TopAppBar(title = { Text("Applications") }) }) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding).fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(applications, key = { it.id }) { application ->
                ApplicationCard(
                    application = application,
                    onMarkSubmitted = { viewModel.markSubmittedManually(application) },
                )
            }
        }
    }
}

@Composable
private fun ApplicationCard(application: JobApplication, onMarkSubmitted: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Text(application.jobTitle, style = MaterialTheme.typography.titleMedium)
            Text(application.company, style = MaterialTheme.typography.bodyMedium)
            Text("Source: ${application.source}", style = MaterialTheme.typography.bodySmall)
            Text("Status: ${statusLabel(application.status)}", style = MaterialTheme.typography.bodySmall)
            if (application.status == ApplicationStatus.DRAFTED && requiresManualSubmit(application.source)) {
                Text(
                    "This is a LinkedIn/Indeed listing: submit it yourself, then tap below to update the record.",
                    style = MaterialTheme.typography.bodySmall,
                )
                Button(onClick = onMarkSubmitted) { Text("I submitted this manually") }
            }
        }
    }
}

private fun requiresManualSubmit(source: JobSource): Boolean =
    source.automationPolicy() == AutomationPolicy.MANUAL_ASSIST_ONLY

private fun statusLabel(status: ApplicationStatus): String = when (status) {
    ApplicationStatus.DRAFTED -> "Drafted - awaiting submission"
    ApplicationStatus.PENDING_APPROVAL -> "Pending your approval"
    ApplicationStatus.SUBMITTED -> "Submitted"
    ApplicationStatus.ASSESSMENT_REQUESTED -> "Assessment requested"
    ApplicationStatus.INTERVIEW_SCHEDULED -> "Interview scheduled"
    ApplicationStatus.ADDITIONAL_INFO_REQUESTED -> "Additional info requested"
    ApplicationStatus.OFFER_RECEIVED -> "Offer received"
    ApplicationStatus.REJECTED -> "Rejected"
    ApplicationStatus.WITHDRAWN -> "Withdrawn"
}
