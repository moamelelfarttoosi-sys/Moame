package com.moame.app.data.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters

@Database(
    entities = [
        ProfileEntity::class,
        JobApplicationEntity::class,
        EmailEntity::class,
        ReminderEntity::class,
        ActionLogEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
@TypeConverters(Converters::class)
abstract class MoameDatabase : RoomDatabase() {
    abstract fun profileDao(): ProfileDao
    abstract fun jobApplicationDao(): JobApplicationDao
    abstract fun emailDao(): EmailDao
    abstract fun reminderDao(): ReminderDao
    abstract fun actionLogDao(): ActionLogDao

    companion object {
        const val DATABASE_NAME = "moame.db"
    }
}
