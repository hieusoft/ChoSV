package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hieusoft/auth-service/internal/service"
)

type AuthHandler struct {
	svc *service.AuthService
}

func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	user, tokens, err := h.svc.Register(req.Email, req.Password, req.FullName)
	if err != nil {
		code := "INTERNAL_ERROR"
		status := http.StatusInternalServerError
		switch err.Error() {
		case "EMAIL_ALREADY_EXISTS":
			code = "EMAIL_ALREADY_EXISTS"; status = http.StatusConflict
		}
		c.JSON(status, gin.H{"success": false, "error": gin.H{"code": code, "message": err.Error()}})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": toAuthResponse(user, tokens)})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	user, tokens, err := h.svc.Login(req.Email, req.Password)
	if err != nil {
		code := "INTERNAL_ERROR"
		status := http.StatusInternalServerError
		switch err.Error() {
		case "INVALID_CREDENTIALS": code = "INVALID_CREDENTIALS"; status = http.StatusUnauthorized
		case "USER_BANNED": code = "USER_BANNED"; status = http.StatusForbidden
		case "USER_INACTIVE": code = "USER_INACTIVE"; status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"success": false, "error": gin.H{"code": code, "message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": toAuthResponse(user, tokens)})
}

func (h *AuthHandler) GetMe(c *gin.Context) {
	userID := c.GetHeader("X-User-Id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "Missing user identity"}})
		return
	}

	user, err := h.svc.GetMe(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": gin.H{"code": "USER_NOT_FOUND", "message": "User not found"}})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"user": UserBrief{
				ID: user.ID, Email: user.Email, Role: user.Role,
				Status: user.Status, EmailVerified: user.EmailVerified,
			},
		},
	})
}

func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	// TODO: validate refresh_token_hash from sessions table
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"message": "Refresh OK — implement session validation"}})
}

func toAuthResponse(user interface{}, tokens interface{}) AuthResponse {
	u := user.(interface{ GetID() string; GetEmail() string; GetRole() string; GetStatus() string; IsEmailVerified() bool })
	t := tokens.(interface{ GetAccessToken() string; GetRefreshToken() string })
	return AuthResponse{
		User:  UserBrief{ID: u.GetID(), Email: u.GetEmail(), Role: u.GetRole(), Status: u.GetStatus(), EmailVerified: u.IsEmailVerified()},
		Tokens: TokenBrief{AccessToken: t.GetAccessToken(), RefreshToken: t.GetRefreshToken()},
	}
}
