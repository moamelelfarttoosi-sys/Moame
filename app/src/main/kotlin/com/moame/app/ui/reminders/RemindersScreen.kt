package com.moame.app.ui.reminders

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import java.text.DateFormat
import java.util.Date

@Composable
fun RemindersScreen(viewModel: RemindersViewModel = hiltViewModel()) {
    val reminders by viewModel.reminders.collectAsState()

    Scaffold(topBar = { TopAppBar(title = { Text("Reminders") }) }) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding).fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(reminders, key = { it.id }) { reminder ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("[${reminder.urgency}]", style = MaterialTheme.typography.labelMedium)
                            Text(reminder.title, style = MaterialTheme.typography.titleMedium)
                        }
                        Text(reminder.reason, style = MaterialTheme.typography.bodyMedium)
                        Text("Recommended action: ${reminder.recommendedAction}", style = MaterialTheme.typography.bodySmall)
                        val dueAt = reminder.dueAt
                        if (dueAt != null) {
                            val formatted = DateFormat.getDateTimeInstance().format(Date(dueAt))
                            Text("Due: $formatted", style = MaterialTheme.typography.bodySmall)
                        }
                        OutlinedButton(onClick = { viewModel.resolve(reminder.id) }) { Text("Mark resolved") }
                    }
                }
            }
        }
    }
}
