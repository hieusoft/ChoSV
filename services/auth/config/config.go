package config

import "os"

type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	JWTExpiry   string
	JWTRefresh  string
	RabbitMQURL string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("AUTH_PORT", "3001"),
		DatabaseURL: getEnv("AUTH_DATABASE_URL", "postgresql://hieusoft:hieusoft123@localhost:5432/auth_db?sslmode=disable"),
		JWTSecret:   getEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production"),
		JWTExpiry:   getEnv("JWT_ACCESS_EXPIRY", "15m"),
		JWTRefresh:  getEnv("JWT_REFRESH_EXPIRY", "168h"),
		RabbitMQURL: getEnv("RABBITMQ_URL", "amqp://hieusoft:hieusoft123@localhost:5672/"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
