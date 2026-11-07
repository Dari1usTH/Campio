// Command seed creates the opt-in test account and demo content. Safe to repeat.
package main

import (
	"context"
	"github.com/tibi/hackathon/backend/internal/config"
	"github.com/tibi/hackathon/backend/internal/db"
	"github.com/tibi/hackathon/backend/internal/httpapi"
	"github.com/tibi/hackathon/backend/internal/media"
	"log"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()
	store, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()
	if err = store.Migrate(ctx); err != nil {
		log.Fatal(err)
	}
	server := &httpapi.Server{Cfg: cfg, Store: store, Media: &media.Store{Root: cfg.MediaDir}}
	if err = server.SeedTestUser(ctx); err != nil {
		log.Fatal(err)
	}
}
