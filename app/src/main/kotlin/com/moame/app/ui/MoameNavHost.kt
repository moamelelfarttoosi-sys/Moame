package com.moame.app.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.moame.app.ui.applications.ApplicationsScreen
import com.moame.app.ui.dashboard.DashboardScreen
import com.moame.app.ui.emails.EmailsScreen
import com.moame.app.ui.reminders.RemindersScreen
import com.moame.app.ui.settings.SettingsScreen

private sealed class Destination(val route: String, val label: String) {
    data object Dashboard : Destination("dashboard", "Dashboard")
    data object Applications : Destination("applications", "Applications")
    data object Emails : Destination("emails", "Emails")
    data object Reminders : Destination("reminders", "Reminders")
    data object Settings : Destination("settings", "Settings")
}

private val bottomNavDestinations = listOf(
    Destination.Dashboard, Destination.Applications, Destination.Emails, Destination.Reminders, Destination.Settings,
)

@Composable
fun MoameNavHost() {
    val navController = rememberNavController()

    Scaffold(
        bottomBar = {
            NavigationBar {
                val backStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = backStackEntry?.destination

                bottomNavDestinations.forEach { destination ->
                    val selected = currentDestination?.hierarchy?.any { it.route == destination.route } == true
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            navController.navigate(destination.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(iconFor(destination), contentDescription = destination.label) },
                        label = { Text(destination.label) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Destination.Dashboard.route,
            modifier = androidx.compose.ui.Modifier.padding(padding),
        ) {
            composable(Destination.Dashboard.route) { DashboardScreen() }
            composable(Destination.Applications.route) { ApplicationsScreen() }
            composable(Destination.Emails.route) { EmailsScreen() }
            composable(Destination.Reminders.route) { RemindersScreen() }
            composable(Destination.Settings.route) { SettingsScreen() }
        }
    }
}

private fun iconFor(destination: Destination) = when (destination) {
    Destination.Dashboard -> Icons.Filled.Home
    Destination.Applications -> Icons.Filled.DateRange
    Destination.Emails -> Icons.Filled.Email
    Destination.Reminders -> Icons.Filled.Notifications
    Destination.Settings -> Icons.Filled.Settings
}
