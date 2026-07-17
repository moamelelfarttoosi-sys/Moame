package com.moame.app.accessibility

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.core.os.bundleOf
import com.moame.core.model.Profile

/**
 * Best-effort form-filler for ATS-hosted application pages we're explicitly
 * allowed to automate: Greenhouse, Lever, and Workday (see
 * JobListing.automationPolicy() in :core). This service refuses to act
 * outside [ALLOWED_HOST_SUFFIXES] - in particular it will NEVER fill or
 * submit anything on linkedin.com or indeed.com, regardless of what content
 * happens to be on screen. Filling is heuristic (matches visible field
 * labels/hints against known ATS field names) and will not work on every
 * form layout; it never taps a final "Submit" control unless the user has
 * explicitly enabled auto-submit in Settings for ATS sources.
 *
 * This service is OFF by default: the user must explicitly enable it in
 * Android's Accessibility settings, and auto-submit is a separate opt-in
 * toggle in the app's Settings screen (SettingsRepository.autoSubmitEnabledForAtsSources).
 */
class AtsAutoFillAccessibilityService : AccessibilityService() {

    private var pendingFillData: FillData? = null

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val root = rootInActiveWindow ?: return
        val currentUrl = findAddressBarUrl(root) ?: return

        if (!isAllowedHost(currentUrl)) {
            // Explicitly out of scope (includes linkedin.com / indeed.com) - do nothing.
            return
        }

        val data = pendingFillData ?: return
        fillKnownFields(root, data)
    }

    override fun onInterrupt() = Unit

    /** Called by the app (e.g. from the Applications screen) before opening the ATS apply URL. */
    fun stageFillData(data: FillData) {
        pendingFillData = data
    }

    private fun fillKnownFields(root: AccessibilityNodeInfo, data: FillData) {
        val fieldMap = mapOf(
            "first name" to data.firstName,
            "last name" to data.lastName,
            "full name" to data.fullName,
            "email" to data.email,
            "phone" to data.phone,
            "location" to data.location,
            "linkedin" to data.linkedInUrl.orEmpty(),
        )

        fieldMap.forEach { (label, value) ->
            if (value.isBlank()) return@forEach
            findEditableNodeByLabel(root, label)?.let { node -> setText(node, value) }
        }
    }

    private fun findEditableNodeByLabel(node: AccessibilityNodeInfo, label: String): AccessibilityNodeInfo? {
        val text = (node.text?.toString().orEmpty() + " " + node.hintText?.toString().orEmpty() +
            " " + node.contentDescription?.toString().orEmpty()).lowercase()

        if (node.isEditable && text.contains(label)) return node
        // The label is often on a sibling/parent text view rather than the input itself in web forms;
        // a production implementation would need a more thorough tree-walk / heuristic here.

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            findEditableNodeByLabel(child, label)?.let { return it }
        }
        return null
    }

    private fun setText(node: AccessibilityNodeInfo, value: String) {
        val arguments = bundleOf(
            AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE to value,
        )
        node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
    }

    private fun findAddressBarUrl(node: AccessibilityNodeInfo): String? {
        // Chrome/Firefox expose the URL bar with a resource id ending in "url_bar".
        if (node.viewIdResourceName?.endsWith("url_bar") == true) {
            return node.text?.toString()
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            findAddressBarUrl(child)?.let { return it }
        }
        return null
    }

    private fun isAllowedHost(url: String): Boolean =
        ALLOWED_HOST_SUFFIXES.any { url.contains(it, ignoreCase = true) } &&
            DISALLOWED_HOST_SUFFIXES.none { url.contains(it, ignoreCase = true) }

    data class FillData(
        val firstName: String,
        val lastName: String,
        val fullName: String,
        val email: String,
        val phone: String,
        val location: String,
        val linkedInUrl: String?,
    )

    companion object {
        val ALLOWED_HOST_SUFFIXES = listOf(
            "greenhouse.io", "boards.greenhouse.io",
            "lever.co", "jobs.lever.co",
            "myworkday.com",
        )

        // Defense-in-depth: even if a URL somehow matched an allowed suffix as a
        // substring of a disallowed domain, explicitly block these outright.
        val DISALLOWED_HOST_SUFFIXES = listOf("linkedin.com", "indeed.com")

        fun fillDataFrom(profile: Profile): FillData {
            val nameParts = profile.fullName.trim().split(Regex("\\s+"), limit = 2)
            return FillData(
                firstName = nameParts.getOrElse(0) { "" },
                lastName = nameParts.getOrElse(1) { "" },
                fullName = profile.fullName,
                email = profile.email,
                phone = profile.phone,
                location = profile.location,
                linkedInUrl = profile.linkedInUrl,
            )
        }
    }
}
