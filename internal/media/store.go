// Package media stores generated and uploaded files on local disk.
package media

import (
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"strings"
)

// Store keeps files under Root/<campaign>/<file>.
type Store struct {
	Root string
}

// Path returns the absolute path for a campaign-relative file name.
func (s *Store) Path(rel string) string {
	return filepath.Join(s.Root, filepath.Clean("/"+rel))
}

// Rel builds a campaign-relative path.
func Rel(campaignID, name string) string {
	return filepath.Join(campaignID, filepath.Base(name))
}

// Create opens a new file for writing (creating directories).
func (s *Store) Create(rel string) (*os.File, error) {
	p := s.Path(rel)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return nil, err
	}
	return os.Create(p)
}

// Write stores data at rel.
func (s *Store) Write(rel string, data []byte) error {
	f, err := s.Create(rel)
	if err != nil {
		return err
	}
	if _, err := f.Write(data); err != nil {
		f.Close()
		return err
	}
	return f.Close()
}

// Save copies r to rel and returns the byte count.
func (s *Store) Save(rel string, r io.Reader, limit int64) (int64, error) {
	f, err := s.Create(rel)
	if err != nil {
		return 0, err
	}
	n, err := io.Copy(f, io.LimitReader(r, limit+1))
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err == nil && n > limit {
		os.Remove(s.Path(rel))
		return n, fmt.Errorf("file larger than %d MB", limit>>20)
	}
	return n, err
}

// RemoveCampaign deletes all files of a campaign.
func (s *Store) RemoveCampaign(campaignID string) error {
	return os.RemoveAll(s.Path(campaignID))
}

// MimeOf guesses a MIME type from a file name.
func MimeOf(name string) string {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".mp4":
		return "video/mp4"
	case ".mp3":
		return "audio/mpeg"
	case ".m4a":
		return "audio/mp4"
	case ".wav":
		return "audio/wav"
	}
	if t := mime.TypeByExtension(ext); t != "" {
		return t
	}
	return "application/octet-stream"
}
