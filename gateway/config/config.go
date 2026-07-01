package config

import "os"

type Config struct {
	Port          string
	JWTSecret     string
	PublicRoutes  []string
	ServiceRoutes map[string]string
	WSRoutes      map[string]string
}

func Load() *Config {
	return &Config{
		Port:      getEnv("GATEWAY_PORT", "8080"),
		JWTSecret: getEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production"),

		// Routes không cần JWT
		PublicRoutes: []string{
			"/api/auth/register",
			"/api/auth/login",
			"/api/auth/refresh-token",
			"/api/products",
			"/api/search",
			"/api/categories",
			"/health",
		},

		// Route -> upstream service URL
		ServiceRoutes: map[string]string{
			"/api/auth/":          getEnv("AUTH_SERVICE_URL", "http://localhost:3001"),
			"/api/users/":         getEnv("USER_SERVICE_URL", "http://localhost:3002"),
			"/api/products/":      getEnv("PRODUCT_SERVICE_URL", "http://localhost:3003"),
			"/api/categories/":    getEnv("PRODUCT_SERVICE_URL", "http://localhost:3003"),
			"/api/search/":        getEnv("SEARCH_SERVICE_URL", "http://localhost:3004"),
			"/api/conversations/": getEnv("CHAT_SERVICE_URL", "http://localhost:3005"),
			"/api/notifications/": getEnv("NOTIFICATION_SERVICE_URL", "http://localhost:3006"),
			"/api/ai/":            getEnv("AI_SERVICE_URL", "http://localhost:3007"),
			"/api/reports/":       getEnv("MODERATION_SERVICE_URL", "http://localhost:3008"),
			"/api/admin/":         getEnv("ADMIN_SERVICE_URL", "http://localhost:3009"),
			"/api/uploads/":       getEnv("PRODUCT_SERVICE_URL", "http://localhost:3003"),
		},

		WSRoutes: map[string]string{
			"/ws": getEnv("CHAT_SERVICE_URL", "http://localhost:3005"),
		},
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
