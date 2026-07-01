package service

import (
	"errors"
	"log"

	"github.com/hieusoft/auth-service/internal/jwt"
	"github.com/hieusoft/auth-service/internal/model"
	"github.com/hieusoft/auth-service/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	userRepo  *repository.UserRepo
	config    *AuthConfig
	publisher EventPublisher
}

type AuthConfig struct {
	JWTSecret    string
	JWTExpiry    string
	JWTRefresh   string
}

type EventPublisher interface {
	PublishUserRegistered(userID, email, fullName string)
}

func NewAuthService(userRepo *repository.UserRepo, cfg *AuthConfig, pub EventPublisher) *AuthService {
	return &AuthService{userRepo: userRepo, config: cfg, publisher: pub}
}

func (s *AuthService) Register(email, password, fullName string) (*model.User, *model.TokenPair, error) {
	exists, err := s.userRepo.EmailExists(email)
	if err != nil {
		return nil, nil, err
	}
	if exists {
		return nil, nil, errors.New("EMAIL_ALREADY_EXISTS")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, nil, err
	}

	user, err := s.userRepo.Create(email, string(hash), "user")
	if err != nil {
		return nil, nil, err
	}

	tokens, err := s.generateTokens(user)
	if err != nil {
		return nil, nil, err
	}

	// Publish event (async, best-effort)
	go func() {
		s.publisher.PublishUserRegistered(user.ID, user.Email, fullName)
	}()

	return user, tokens, nil
}

func (s *AuthService) Login(email, password string) (*model.User, *model.TokenPair, error) {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		return nil, nil, errors.New("INVALID_CREDENTIALS")
	}
	if user.Status == "banned" {
		return nil, nil, errors.New("USER_BANNED")
	}
	if user.Status == "inactive" {
		return nil, nil, errors.New("USER_INACTIVE")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, nil, errors.New("INVALID_CREDENTIALS")
	}

	tokens, err := s.generateTokens(user)
	if err != nil {
		return nil, nil, err
	}

	_ = s.userRepo.UpdateLastLogin(user.ID)
	return user, tokens, nil
}

func (s *AuthService) GetMe(userID string) (*model.User, error) {
	return s.userRepo.FindByID(userID)
}

func (s *AuthService) generateTokens(user *model.User) (*model.TokenPair, error) {
	accessToken, err := jwt.GenerateAccessToken(user.ID, user.Role, s.config.JWTSecret, s.config.JWTExpiry)
	if err != nil {
		return nil, err
	}
	refreshToken, _, err := jwt.GenerateRefreshToken()
	if err != nil {
		return nil, err
	}
	log.Printf("Generated tokens for user %s", user.ID)
	return &model.TokenPair{AccessToken: accessToken, RefreshToken: refreshToken}, nil
}
