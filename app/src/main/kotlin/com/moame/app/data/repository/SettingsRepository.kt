package com.moame.app.data.repository

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Holds secrets (Anthropic API key, Gmail OAuth client config) in an
 * EncryptedSharedPreferences file backed by the Android Keystore. Nothing
 * here is ever logged or synced off-device.
 */
@Singleton
class SettingsRepository @Inject constructor(@ApplicationContext context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "moame_secure_settings",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    var anthropicApiKey: String?
        get() = prefs.getString(KEY_ANTHROPIC_API_KEY, null)
        set(value) = prefs.edit().putString(KEY_ANTHROPIC_API_KEY, value).apply()

    var adzunaAppId: String?
        get() = prefs.getString(KEY_ADZUNA_APP_ID, null)
        set(value) = prefs.edit().putString(KEY_ADZUNA_APP_ID, value).apply()

    var adzunaAppKey: String?
        get() = prefs.getString(KEY_ADZUNA_APP_KEY, null)
        set(value) = prefs.edit().putString(KEY_ADZUNA_APP_KEY, value).apply()

    var gmailAccountEmail: String?
        get() = prefs.getString(KEY_GMAIL_ACCOUNT, null)
        set(value) = prefs.edit().putString(KEY_GMAIL_ACCOUNT, value).apply()

    var autoSubmitEnabledForAtsSources: Boolean
        get() = prefs.getBoolean(KEY_AUTO_SUBMIT_ATS, false)
        set(value) = prefs.edit().putBoolean(KEY_AUTO_SUBMIT_ATS, value).apply()

    var syncIntervalMinutes: Int
        get() = prefs.getInt(KEY_SYNC_INTERVAL_MIN, 30)
        set(value) = prefs.edit().putInt(KEY_SYNC_INTERVAL_MIN, value).apply()

    /** Comma-separated Greenhouse board tokens, e.g. "acme,widgetco". */
    var greenhouseBoardTokensCsv: String
        get() = prefs.getString(KEY_GREENHOUSE_TOKENS, "").orEmpty()
        set(value) = prefs.edit().putString(KEY_GREENHOUSE_TOKENS, value).apply()

    /** Comma-separated Lever company slugs, e.g. "acme,widgetco". */
    var leverCompanySlugsCsv: String
        get() = prefs.getString(KEY_LEVER_SLUGS, "").orEmpty()
        set(value) = prefs.edit().putString(KEY_LEVER_SLUGS, value).apply()

    /** Semicolon-separated "tenant|site|hostname" triples for Workday CXS endpoints. */
    var workdayTenantsCsv: String
        get() = prefs.getString(KEY_WORKDAY_TENANTS, "").orEmpty()
        set(value) = prefs.edit().putString(KEY_WORKDAY_TENANTS, value).apply()

    var adzunaEnabled: Boolean
        get() = prefs.getBoolean(KEY_ADZUNA_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_ADZUNA_ENABLED, value).apply()

    var adzunaCountry: String
        get() = prefs.getString(KEY_ADZUNA_COUNTRY, "gb").orEmpty()
        set(value) = prefs.edit().putString(KEY_ADZUNA_COUNTRY, value).apply()

    var adzunaQuery: String
        get() = prefs.getString(KEY_ADZUNA_QUERY, "").orEmpty()
        set(value) = prefs.edit().putString(KEY_ADZUNA_QUERY, value).apply()

    var adzunaLocation: String
        get() = prefs.getString(KEY_ADZUNA_LOCATION, "").orEmpty()
        set(value) = prefs.edit().putString(KEY_ADZUNA_LOCATION, value).apply()

    val isConfigured: Boolean
        get() = !anthropicApiKey.isNullOrBlank()

    private companion object {
        const val KEY_ANTHROPIC_API_KEY = "anthropic_api_key"
        const val KEY_ADZUNA_APP_ID = "adzuna_app_id"
        const val KEY_ADZUNA_APP_KEY = "adzuna_app_key"
        const val KEY_GMAIL_ACCOUNT = "gmail_account_email"
        const val KEY_AUTO_SUBMIT_ATS = "auto_submit_enabled_ats"
        const val KEY_SYNC_INTERVAL_MIN = "sync_interval_minutes"
        const val KEY_GREENHOUSE_TOKENS = "greenhouse_board_tokens_csv"
        const val KEY_LEVER_SLUGS = "lever_company_slugs_csv"
        const val KEY_WORKDAY_TENANTS = "workday_tenants_csv"
        const val KEY_ADZUNA_ENABLED = "adzuna_enabled"
        const val KEY_ADZUNA_COUNTRY = "adzuna_country"
        const val KEY_ADZUNA_QUERY = "adzuna_query"
        const val KEY_ADZUNA_LOCATION = "adzuna_location"
    }
}
