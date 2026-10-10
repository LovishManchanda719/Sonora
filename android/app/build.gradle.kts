plugins {
    id("com.android.application")
}

android {
    namespace = "ai.sonora.speech"
    compileSdk = 36

    defaultConfig {
        applicationId = "ai.sonora.speech"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}
