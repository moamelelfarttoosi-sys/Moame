package com.moame.app.data.db

import androidx.room.TypeConverter
import com.moame.core.model.ApplicationStatus
import com.moame.core.model.EmailCategory
import com.moame.core.model.JobSource
import com.moame.core.model.ReminderType
import com.moame.core.model.Urgency
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val json = Json { ignoreUnknownKeys = true }

class Converters {
    @TypeConverter
    fun fromJobSource(value: JobSource): String = value.name

    @TypeConverter
    fun toJobSource(value: String): JobSource = JobSource.valueOf(value)

    @TypeConverter
    fun fromApplicationStatus(value: ApplicationStatus): String = value.name

    @TypeConverter
    fun toApplicationStatus(value: String): ApplicationStatus = ApplicationStatus.valueOf(value)

    @TypeConverter
    fun fromEmailCategory(value: EmailCategory): String = value.name

    @TypeConverter
    fun toEmailCategory(value: String): EmailCategory = EmailCategory.valueOf(value)

    @TypeConverter
    fun fromReminderType(value: ReminderType): String = value.name

    @TypeConverter
    fun toReminderType(value: String): ReminderType = ReminderType.valueOf(value)

    @TypeConverter
    fun fromUrgency(value: Urgency): String = value.name

    @TypeConverter
    fun toUrgency(value: String): Urgency = Urgency.valueOf(value)

    @TypeConverter
    fun fromStringList(value: List<String>): String = json.encodeToString(value)

    @TypeConverter
    fun toStringList(value: String): List<String> =
        if (value.isBlank()) emptyList() else json.decodeFromString(value)
}
