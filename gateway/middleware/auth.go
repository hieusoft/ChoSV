package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware(jwtSecret string, publicRoutes []string) gin.HandlerFunc {
	publicSet := make(map[string]bool)
	for _, r := range publicRoutes {
		publicSet[r] = true
	}

	return func(c *gin.Context) {
		path := c.Request.URL.Path

		// Check public routes (prefix match)
		for prefix := range publicSet {
			if strings.HasPrefix(path, prefix) || path == prefix {
				c.Next()
				return
			}
		}
		// Also allow public GET for product detail, user profile, reviews
		if c.Request.Method == "GET" {
			if strings.HasPrefix(path, "/api/products/") ||
				strings.HasPrefix(path, "/api/users/") ||
				strings.HasPrefix(path, "/api/search") {
				c.Next()
				return
			}
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "Missing authorization header"}})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "Invalid authorization format"}})
			c.Abort()
			return
		}

		token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "TOKEN_INVALID", "message": "Invalid or expired token"}})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "TOKEN_INVALID", "message": "Invalid token claims"}})
			c.Abort()
			return
		}

		// Pass user info to upstream via headers
		c.Set("user_id", claims["sub"])
		c.Set("user_role", claims["role"])
		c.Header("X-User-Id", claims["sub"].(string))
		if role, ok := claims["role"].(string); ok {
			c.Header("X-User-Role", role)
		}

		c.Next()
	}
}
