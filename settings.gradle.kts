pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        // Зеркало Maven Central первым: repo.maven.apache.org отдаёт 429
        // (Too Many Requests) под нагрузкой и валит сборку.
        maven("https://repo.huaweicloud.com/repository/maven")
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        maven("https://repo.huaweicloud.com/repository/maven")
        mavenCentral()
    }
}

rootProject.name = "Trackaer"
include(":app")
