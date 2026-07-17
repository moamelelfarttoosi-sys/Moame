package com.moame.app.gmail

import android.accounts.Account
import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import com.google.api.client.extensions.android.http.AndroidHttp
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential
import com.google.api.client.json.gson.GsonFactory
import com.google.api.services.gmail.Gmail
import com.google.api.services.gmail.GmailScopes
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Handles Google Sign-In with Gmail scopes and produces an authenticated
 * Gmail API client. The user must set up an OAuth client ID in Google Cloud
 * Console (see README.md) before this works - Moame never bundles a shared
 * client ID/secret.
 */
@Singleton
class GmailAuthManager @Inject constructor(@ApplicationContext private val context: Context) {

    private val signInOptions = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
        .requestEmail()
        .requestScopes(
            Scope(GmailScopes.GMAIL_READONLY),
            Scope(GmailScopes.GMAIL_SEND),
            Scope(GmailScopes.GMAIL_MODIFY),
        )
        .build()

    private val signInClient: GoogleSignInClient = GoogleSignIn.getClient(context, signInOptions)

    fun signInIntent(): Intent = signInClient.signInIntent

    fun currentAccount(): GoogleSignInAccount? = GoogleSignIn.getLastSignedInAccount(context)

    fun signOut() {
        signInClient.signOut()
    }

    /** Builds a Gmail API client authenticated as [account]. Call from a background thread. */
    fun gmailClientFor(account: GoogleSignInAccount): Gmail {
        val credential = GoogleAccountCredential.usingOAuth2(
            context,
            listOf(GmailScopes.GMAIL_READONLY, GmailScopes.GMAIL_SEND, GmailScopes.GMAIL_MODIFY),
        )
        credential.selectedAccount = account.account ?: Account(account.email, "com.google")

        return Gmail.Builder(AndroidHttp.newCompatibleTransport(), GsonFactory.getDefaultInstance(), credential)
            .setApplicationName("Moame")
            .build()
    }
}
