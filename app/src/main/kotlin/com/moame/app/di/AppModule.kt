package com.moame.app.di

import android.content.Context
import androidx.room.Room
import com.moame.app.data.db.ActionLogDao
import com.moame.app.data.db.EmailDao
import com.moame.app.data.db.JobApplicationDao
import com.moame.app.data.db.MoameDatabase
import com.moame.app.data.db.ProfileDao
import com.moame.app.data.db.ReminderDao
import com.moame.app.jobsource.JobSourceAggregator
import com.moame.core.email.EmailClassifier
import com.moame.core.matching.JobMatcher
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): MoameDatabase =
        Room.databaseBuilder(context, MoameDatabase::class.java, MoameDatabase.DATABASE_NAME)
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    fun provideProfileDao(db: MoameDatabase): ProfileDao = db.profileDao()

    @Provides
    fun provideJobApplicationDao(db: MoameDatabase): JobApplicationDao = db.jobApplicationDao()

    @Provides
    fun provideEmailDao(db: MoameDatabase): EmailDao = db.emailDao()

    @Provides
    fun provideReminderDao(db: MoameDatabase): ReminderDao = db.reminderDao()

    @Provides
    fun provideActionLogDao(db: MoameDatabase): ActionLogDao = db.actionLogDao()

    @Provides
    @Singleton
    fun provideHttpClient(): HttpClient = HttpClient(Android) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
    }

    @Provides
    @Singleton
    fun provideJobMatcher(): JobMatcher = JobMatcher()

    @Provides
    @Singleton
    fun provideEmailClassifier(): EmailClassifier = EmailClassifier()

    @Provides
    @Singleton
    fun provideJobSourceAggregator(httpClient: HttpClient): JobSourceAggregator = JobSourceAggregator(httpClient)
}
