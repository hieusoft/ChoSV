package jwt

import (
	"time"

	jwtlib "github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	Sub  string `json:"sub"`
	Role string `json:"role"`
	jwtlib.RegisteredClaims
}

func GenerateAccessToken(userID, role, secret, expiryStr string) (string, error) {
	expiry, _ := time.ParseDuration(expiryStr)
	claims := Claims{
		Sub:  userID,
		Role: role,
		RegisteredClaims: jwtlib.RegisteredClaims{
			ExpiresAt: jwtlib.NewNumericDate(time.Now().Add(expiry)),
			IssuedAt:  jwtlib.NewNumericDate(time.Now()),
		},
	}
	token := jwtlib.NewWithClaims(jwtlib.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func GenerateRefreshToken() (string, string, error) {
	raw := randomString(64)
	hash, err := hashToken(raw)
	return raw, hash, err
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[i%len(letters)]
	}
	return string(b)
}

func hashToken(token string) (string, error) {
	// Simple SHA256 hash — dùng crypto/sha256 trong production
	return token, nil // Placeholder
}
