package com.moame.app.data.db

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface ProfileDao {
    @Query("SELECT * FROM profile WHERE id = 'current_profile' LIMIT 1")
    fun observe(): Flow<ProfileEntity?>

    @Query("SELECT * FROM profile WHERE id = 'current_profile' LIMIT 1")
    suspend fun get(): ProfileEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: ProfileEntity)
}

@Dao
interface JobApplicationDao {
    @Query("SELECT * FROM job_applications ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<JobApplicationEntity>>

    @Query("SELECT * FROM job_applications WHERE jobId = :jobId LIMIT 1")
    suspend fun findByJobId(jobId: String): JobApplicationEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: JobApplicationEntity)

    @Update
    suspend fun update(entity: JobApplicationEntity)

    @Query("SELECT COUNT(*) FROM job_applications")
    fun observeCount(): Flow<Int>
}

@Dao
interface EmailDao {
    @Query("SELECT * FROM emails ORDER BY receivedAt DESC")
    fun observeAll(): Flow<List<EmailEntity>>

    @Query("SELECT * FROM emails WHERE decision = 'NEEDS_USER_ATTENTION' AND handledAt IS NULL ORDER BY receivedAt DESC")
    fun observePendingAttention(): Flow<List<EmailEntity>>

    @Query("SELECT * FROM emails WHERE id = :id LIMIT 1")
    suspend fun findById(id: String): EmailEntity?

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIfNew(entity: EmailEntity): Long

    @Update
    suspend fun update(entity: EmailEntity)

    @Query("SELECT COUNT(*) FROM emails WHERE handledAt IS NOT NULL")
    fun observeHandledCount(): Flow<Int>
}

@Dao
interface ReminderDao {
    @Query(
        """
        SELECT * FROM reminders WHERE isResolved = 0
        ORDER BY
          CASE urgency WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END ASC,
          dueAt ASC
        """,
    )
    fun observeActive(): Flow<List<ReminderEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: ReminderEntity)

    @Query("UPDATE reminders SET isResolved = 1 WHERE id = :id")
    suspend fun resolve(id: String)
}

@Dao
interface ActionLogDao {
    @Query("SELECT * FROM action_log ORDER BY timestamp DESC LIMIT :limit")
    fun observeRecent(limit: Int = 50): Flow<List<ActionLogEntity>>

    @Insert
    suspend fun insert(entity: ActionLogEntity)

    @Delete
    suspend fun delete(entity: ActionLogEntity)
}
