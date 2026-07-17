package com.moame.app.data.repository

import com.moame.app.data.db.ActionLogDao
import com.moame.app.data.db.ActionLogEntity
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ActionLogRepository @Inject constructor(private val dao: ActionLogDao) {
    fun observeRecent(limit: Int = 50): Flow<List<ActionLogEntity>> = dao.observeRecent(limit)
}
