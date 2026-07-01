package handler

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	FullName string `json:"full_name" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type AuthResponse struct {
	User   UserBrief  `json:"user"`
	Tokens TokenBrief `json:"tokens"`
}

type UserBrief struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	Role          string `json:"role"`
	Status        string `json:"status"`
	EmailVerified bool   `json:"email_verified"`
}

type TokenBrief struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}
