# ── Build Stage ────────────────────────────────────────────────
FROM maven:3.9.6-eclipse-temurin-17 AS builder

WORKDIR /app
COPY pom.xml .
# Download dependencies first (layer cache)
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests -B

# ── Runtime Stage ───────────────────────────────────────────────
FROM eclipse-temurin:17-jre-jammy

WORKDIR /app

# Removed non-root user for volume permission compatibility

COPY --from=builder /app/target/*.jar app.jar

EXPOSE 9090
ENTRYPOINT ["java", "-jar", "app.jar"]
