package com.moame.app.data.repository

import com.moame.app.data.db.ProfileDao
import com.moame.app.data.db.ProfileEntity
import com.moame.app.profile.SeedProfile
import com.moame.core.model.Profile
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProfileRepository @Inject constructor(private val profileDao: ProfileDao) {

    private val json = Json { ignoreUnknownKeys = true }

    fun observeProfile(): Flow<Profile> = profileDao.observe().map { entity ->
        entity?.let { json.decodeFromString<Profile>(it.profileJson) } ?: SeedProfile.default
    }

    suspend fun getProfile(): Profile {
        val entity = profileDao.get() ?: return SeedProfile.default
        return json.decodeFromString(entity.profileJson)
    }

    suspend fun saveProfile(profile: Profile, nowMillis: Long) {
        profileDao.upsert(
            ProfileEntity(
                profileJson = json.encodeToString(profile),
                updatedAt = nowMillis,
            ),
        )
    }

    suspend fun ensureSeeded(nowMillis: Long) {
        if (profileDao.get() == null) {
            saveProfile(SeedProfile.default, nowMillis)
        }
    }
}
