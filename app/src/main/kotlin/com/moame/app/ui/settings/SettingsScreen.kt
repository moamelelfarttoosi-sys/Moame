package com.moame.app.ui.settings

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.google.android.gms.auth.api.signin.GoogleSignIn

@Composable
fun SettingsScreen(viewModel: SettingsViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    var apiKeyField by remember(state.anthropicApiKey) { mutableStateOf(state.anthropicApiKey) }
    var adzunaIdField by remember(state.adzunaAppId) { mutableStateOf(state.adzunaAppId) }
    var adzunaKeyField by remember(state.adzunaAppKey) { mutableStateOf(state.adzunaAppKey) }
    var greenhouseField by remember(state.greenhouseBoardTokensCsv) { mutableStateOf(state.greenhouseBoardTokensCsv) }
    var leverField by remember(state.leverCompanySlugsCsv) { mutableStateOf(state.leverCompanySlugsCsv) }
    var adzunaEnabledField by remember(state.adzunaEnabled) { mutableStateOf(state.adzunaEnabled) }
    var adzunaQueryField by remember(state.adzunaQuery) { mutableStateOf(state.adzunaQuery) }
    var adzunaLocationField by remember(state.adzunaLocation) { mutableStateOf(state.adzunaLocation) }

    val signInLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        task.result?.email?.let { viewModel.onGmailSignedIn(it) }
    }

    Scaffold(topBar = { TopAppBar(title = { Text("Settings") }) }) { padding ->
        Column(
            modifier = Modifier.padding(padding).fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("Gmail account", style = MaterialTheme.typography.titleMedium)
            if (state.gmailAccountEmail != null) {
                Text("Connected: ${state.gmailAccountEmail}")
                OutlinedButton(onClick = { viewModel.signOutGmail() }) { Text("Disconnect") }
            } else {
                Button(onClick = { signInLauncher.launch(viewModel.gmailAuthManager.signInIntent()) }) {
                    Text("Connect Gmail")
                }
            }

            Text("Anthropic API key (for resume tailoring & email drafting)", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = apiKeyField,
                onValueChange = { apiKeyField = it },
                label = { Text("API key") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth(),
            )
            Button(onClick = { viewModel.saveAnthropicApiKey(apiKeyField) }) { Text("Save API key") }

            Text("Adzuna job search API (optional)", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = adzunaIdField,
                onValueChange = { adzunaIdField = it },
                label = { Text("App ID") },
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = adzunaKeyField,
                onValueChange = { adzunaKeyField = it },
                label = { Text("App key") },
                modifier = Modifier.fillMaxWidth(),
            )
            Button(onClick = { viewModel.saveAdzunaCredentials(adzunaIdField, adzunaKeyField) }) {
                Text("Save Adzuna credentials")
            }

            Text("Job sources (auto-apply eligible)", style = MaterialTheme.typography.titleMedium)
            Text(
                "Board tokens/slugs come from that company's own careers page URL " +
                    "(e.g. boards.greenhouse.io/acme -> token \"acme\"). LinkedIn/Indeed aren't " +
                    "configured here - use the manual-assist flow for those.",
                style = MaterialTheme.typography.bodySmall,
            )
            OutlinedTextField(
                value = greenhouseField,
                onValueChange = { greenhouseField = it },
                label = { Text("Greenhouse board tokens (comma-separated)") },
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = leverField,
                onValueChange = { leverField = it },
                label = { Text("Lever company slugs (comma-separated)") },
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Switch(checked = adzunaEnabledField, onCheckedChange = { adzunaEnabledField = it })
                Text("Search Adzuna")
            }
            OutlinedTextField(
                value = adzunaQueryField,
                onValueChange = { adzunaQueryField = it },
                label = { Text("Adzuna search query (e.g. \"contracts engineer\")") },
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = adzunaLocationField,
                onValueChange = { adzunaLocationField = it },
                label = { Text("Adzuna location (e.g. \"Basra\")") },
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = {
                    viewModel.saveJobSources(greenhouseField, leverField, adzunaEnabledField, adzunaQueryField, adzunaLocationField)
                },
            ) { Text("Save job sources") }

            Text("Auto-apply", style = MaterialTheme.typography.titleMedium)
            Text(
                "When enabled, high-confidence matches on Greenhouse/Lever/Workday/Adzuna are " +
                    "submitted automatically. LinkedIn and Indeed are always manual-assist only, " +
                    "regardless of this setting.",
                style = MaterialTheme.typography.bodySmall,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Switch(checked = state.autoSubmitEnabledForAts, onCheckedChange = { viewModel.setAutoSubmitForAts(it) })
                Text(if (state.autoSubmitEnabledForAts) "Enabled" else "Disabled")
            }

            Text("Background sync interval: ${state.syncIntervalMinutes} min", style = MaterialTheme.typography.titleMedium)
            Text(
                "Android enforces a 15-minute floor on periodic background work; this is not a " +
                    "true real-time/continuous monitor (see README).",
                style = MaterialTheme.typography.bodySmall,
            )
            Slider(
                value = state.syncIntervalMinutes.toFloat(),
                onValueChange = { viewModel.setSyncInterval(context, it.toInt()) },
                valueRange = 15f..120f,
                steps = 6,
            )
        }
    }
}
