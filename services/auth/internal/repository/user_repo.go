package repository

import (
	"database/sql"
	"time"

	"github.com/hieusoft/auth-service/internal/model"
)

type UserRepo struct {
	db *sql.DB
}

func NewUserRepo(db *sql.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) FindByEmail(email string) (*model.User, error) {
	u := &model.User{}
	err := r.db.QueryRow(
		`SELECT id, email, password_hash, role, status, email_verified, last_login_at, created_at, updated_at
		 FROM users WHERE email = $1 AND deleted_at IS NULL`, email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.Status, &u.EmailVerified, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *UserRepo) FindByID(id string) (*model.User, error) {
	u := &model.User{}
	err := r.db.QueryRow(
		`SELECT id, email, password_hash, role, status, email_verified, last_login_at, created_at, updated_at
		 FROM users WHERE id = $1 AND deleted_at IS NULL`, id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.Status, &u.EmailVerified, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *UserRepo) Create(email, passwordHash, role string) (*model.User, error) {
	u := &model.User{}
	err := r.db.QueryRow(
		`INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)
		 RETURNING id, email, password_hash, role, status, email_verified, created_at, updated_at`,
		email, passwordHash, role,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.Status, &u.EmailVerified, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *UserRepo) EmailExists(email string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND deleted_at IS NULL)`, email).Scan(&exists)
	return exists, err
}

func (r *UserRepo) UpdateLastLogin(userID string) error {
	_, err := r.db.Exec(`UPDATE users SET last_login_at = $1, updated_at = $1 WHERE id = $2`, time.Now(), userID)
	return err
}
