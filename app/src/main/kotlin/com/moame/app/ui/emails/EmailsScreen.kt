package com.moame.app.ui.emails

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.moame.core.model.EmailClassification

@Composable
fun EmailsScreen(viewModel: EmailsViewModel = hiltViewModel()) {
    val pending by viewModel.pendingAttention.collectAsState()

    Scaffold(topBar = { TopAppBar(title = { Text("Emails needing your attention") }) }) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding).fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(pending, key = { it.email.id }) { classification ->
                EmailCard(
                    classification = classification,
                    onApprove = { text -> viewModel.approveAndSend(classification, text) },
                    onDismiss = { viewModel.dismiss(classification) },
                )
            }
        }
    }
}

@Composable
private fun EmailCard(
    classification: EmailClassification,
    onApprove: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var draftText by remember(classification.email.id) {
        mutableStateOf(classification.suggestedReply.orEmpty())
    }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(classification.email.subject, style = MaterialTheme.typography.titleMedium)
            Text("From: ${classification.email.from}", style = MaterialTheme.typography.bodySmall)
            Text("Category: ${classification.category}" + if (classification.isUrgent) " - URGENT" else "", style = MaterialTheme.typography.bodySmall)

            if (classification.summaryBullets.isNotEmpty()) {
                classification.summaryBullets.forEach { bullet ->
                    Text("• $bullet", style = MaterialTheme.typography.bodySmall)
                }
            } else {
                Text(classification.email.snippet, style = MaterialTheme.typography.bodySmall)
            }

            OutlinedTextField(
                value = draftText,
                onValueChange = { draftText = it },
                label = { Text("Reply (edit before sending)") },
                modifier = Modifier.fillMaxWidth(),
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { onApprove(draftText) }) { Text("Approve & send") }
                OutlinedButton(onClick = onDismiss) { Text("Dismiss") }
            }
        }
    }
}
