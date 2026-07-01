package model

import "time"

type User struct {
	ID             string     `json:"id"`
	Email          string     `json:"email"`
	PasswordHash   string     `json:"-"`
	Role           string     `json:"role"`
	Status         string     `json:"status"`
	EmailVerified  bool       `json:"email_verified"`
	LastLoginAt    *time.Time `json:"last_login_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type Session struct {
	ID                 string    `json:"id"`
	UserID             string    `json:"user_id"`
	RefreshTokenHash   string    `json:"-"`
	DeviceName         string    `json:"device_name,omitempty"`
	ExpiresAt          time.Time `json:"expires_at"`
	CreatedAt          time.Time `json:"created_at"`
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}
