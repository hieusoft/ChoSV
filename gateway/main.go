package main

import (
	"log"

	"github.com/hieusoft/gateway/config"
	"github.com/hieusoft/gateway/router"
)

func main() {
	cfg := config.Load()
	r := router.Setup(cfg)

	log.Printf("Gateway starting on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start gateway: %v", err)
	}
}
