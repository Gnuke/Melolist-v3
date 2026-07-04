# syntax=docker/dockerfile:1

# --- build stage: JDK 21 (Java 21 LTS 기준) ---
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# 의존성 캐시 레이어 (소스 변경과 분리)
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies > /dev/null 2>&1 || true

COPY src ./src
RUN ./gradlew --no-daemon clean bootJar

# --- runtime stage: JRE 21 ---
FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
