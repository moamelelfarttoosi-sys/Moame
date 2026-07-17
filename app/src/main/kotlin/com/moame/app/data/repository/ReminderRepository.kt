package com.moame.app.data.repository

import com.moame.app.data.db.ReminderDao
import com.moame.app.data.db.ReminderEntity
import com.moame.core.model.Reminder
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReminderRepository @Inject constructor(private val dao: ReminderDao) {

    fun observeActive(): Flow<List<Reminder>> = dao.observeActive().map { list -> list.map { it.toModel() } }

    suspend fun upsert(reminder: Reminder) = dao.upsert(reminder.toEntity())

    suspend fun resolve(id: String) = dao.resolve(id)
}

private fun ReminderEntity.toModel(): Reminder = Reminder(
    id = id,
    type = type,
    title = title,
    reason = reason,
    urgency = urgency,
    recommendedAction = recommendedAction,
    dueAt = dueAt,
    createdAt = createdAt,
    isResolved = isResolved,
    relatedEntityId = relatedEntityId,
)

private fun Reminder.toEntity(): ReminderEntity = ReminderEntity(
    id = id,
    type = type,
    title = title,
    reason = reason,
    urgency = urgency,
    recommendedAction = recommendedAction,
    dueAt = dueAt,
    createdAt = createdAt,
    isResolved = isResolved,
    relatedEntityId = relatedEntityId,
)
