package main

import (
	"database/sql"
	"log"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"

	"github.com/hieusoft/auth-service/config"
	"github.com/hieusoft/auth-service/internal/handler"
	"github.com/hieusoft/auth-service/internal/publisher"
	"github.com/hieusoft/auth-service/internal/repository"
	"github.com/hieusoft/auth-service/internal/service"
)

func main() {
	cfg := config.Load()

	// Database
	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Connected to auth_db")

	// RabbitMQ (best-effort, service vẫn chạy nếu RabbitMQ chưa sẵn sàng)
	var pub service.EventPublisher
	rmq, err := publisher.NewRabbitMQ(cfg.RabbitMQURL)
	if err != nil {
		log.Printf("WARNING: RabbitMQ not available: %v — events disabled", err)
	} else {
		defer rmq.Close()
		pub = rmq
		log.Println("Connected to RabbitMQ")
	}

	// Layers
	userRepo := repository.NewUserRepo(db)
	authSvc := service.NewAuthService(userRepo, &service.AuthConfig{
		JWTSecret:  cfg.JWTSecret,
		JWTExpiry:  cfg.JWTExpiry,
		JWTRefresh: cfg.JWTRefresh,
	}, pub)
	authHandler := handler.NewAuthHandler(authSvc)

	// Router
	r := gin.Default()
	api := r.Group("/api/auth")
	{
		api.POST("/register", authHandler.Register)
		api.POST("/login", authHandler.Login)
		api.GET("/me", authHandler.GetMe)
		api.POST("/refresh-token", authHandler.RefreshToken)
		api.POST("/logout", func(c *gin.Context) {
			c.JSON(200, gin.H{"success": true, "data": gin.H{"message": "Logged out"}})
		})
	}

	// Health
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "auth"})
	})

	log.Printf("Auth Service starting on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start: %v", err)
	}
}
