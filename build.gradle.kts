// Intentionally no root-level "apply false" plugin block.
//
// The :app module (Android/Hilt/KSP) declares its own plugins directly and is
// only configured when a task under :app is requested. This keeps `gradle
// :core:test` fully independent of the Android Gradle Plugin, which requires
// Google's Maven repo (dl.google.com) and the Android SDK — neither available
// in every environment (e.g. this repo's CI sandbox has no Android SDK).
// Building/running :app requires Android Studio with the Android SDK
// installed; see README.md.
