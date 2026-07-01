package router

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hieusoft/gateway/config"
	"github.com/hieusoft/gateway/middleware"
	"github.com/hieusoft/gateway/proxy"
)

func Setup(cfg *config.Config) *gin.Engine {
	r := gin.New()

	// Global middleware
	r.Use(middleware.LoggingMiddleware())
	r.Use(middleware.CORSMiddleware())
	r.Use(middleware.RateLimitMiddleware(100)) // 100 req/s

	// JWT auth (trừ public routes)
	r.Use(middleware.AuthMiddleware(cfg.JWTSecret, cfg.PublicRoutes))

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "gateway"})
	})

	// REST routes → reverse proxy
	for prefix, target := range cfg.ServiceRoutes {
		p := prefix // capture
		t := target // capture
		r.Any(p+"*path", func(c *gin.Context) {
			// Strip prefix, keep the rest
			c.Request.URL.Path = "/" + strings.TrimPrefix(c.Request.URL.Path, strings.TrimSuffix(p, "/"))
			proxy.ReverseProxy(t)(c)
		})
	}

	// WebSocket routes
	for wsPath, target := range cfg.WSRoutes {
		r.Any(wsPath, func(c *gin.Context) {
			proxy.ReverseProxy(target)(c)
		})
	}

	return r
}
