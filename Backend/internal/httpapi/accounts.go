package httpapi

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/mail"
	"net/smtp"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

const cookieName = "campio_session"

type user struct {
	ID               uuid.UUID `json:"id"`
	Email            string    `json:"email"`
	Name             string    `json:"name"`
	BusinessName     string    `json:"businessName"`
	Language         string    `json:"language"`
	TwoFactorEnabled bool      `json:"twoFactorEnabled"`
	Verified         bool      `json:"verified"`
	Hash             string    `json:"-"`
	Method           string    `json:"-"`
	Secret           string    `json:"-"`
	IsTest           bool      `json:"-"`
}

const userCols = "id,email,name,business_name,language,two_factor_enabled,verified,password_hash,two_factor_method,totp_secret,is_test"

func scanUser(row pgx.Row) (u user, err error) {
	err = row.Scan(&u.ID, &u.Email, &u.Name, &u.BusinessName, &u.Language, &u.TwoFactorEnabled, &u.Verified, &u.Hash, &u.Method, &u.Secret, &u.IsTest)
	return
}
func (s *Server) userByEmail(ctx context.Context, email string) (user, error) {
	return scanUser(s.Store.Pool.QueryRow(ctx, "SELECT "+userCols+" FROM users WHERE email=$1", strings.ToLower(strings.TrimSpace(email))))
}
func currentUser(c *gin.Context) user { return c.MustGet("user").(user) }
func randomToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
func hashToken(v string) string { h := sha256.Sum256([]byte(v)); return hex.EncodeToString(h[:]) }
func validLanguage(v string) string {
	if v == "ro" {
		return "ro"
	}
	return "en"
}
func (s *Server) fixedOTP(u user) bool {
	return u.IsTest && (s.Cfg.AppEnv != "production" || s.Cfg.AllowTestOTP)
}
func (s *Server) cryptSecret(v string, decode bool) (string, error) {
	key := sha256.Sum256([]byte(s.Cfg.SessionSecret))
	block, _ := aes.NewCipher(key[:])
	gcm, _ := cipher.NewGCM(block)
	if decode {
		b, err := base64.RawURLEncoding.DecodeString(v)
		if err != nil || len(b) < gcm.NonceSize() {
			return "", fmt.Errorf("invalid secret")
		}
		out, err := gcm.Open(nil, b[:gcm.NonceSize()], b[gcm.NonceSize():], nil)
		return string(out), err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(gcm.Seal(nonce, nonce, []byte(v), nil)), nil
}
func validTOTP(secret, code string, now time.Time) bool {
	if len(code) != 6 {
		return false
	}
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(secret)
	if err != nil {
		return false
	}
	for offset := -1; offset <= 1; offset++ {
		var counter [8]byte
		binary.BigEndian.PutUint64(counter[:], uint64(now.Unix()/30+int64(offset)))
		mac := hmac.New(sha1.New, key)
		mac.Write(counter[:])
		h := mac.Sum(nil)
		i := h[len(h)-1] & 15
		n := (binary.BigEndian.Uint32(h[i:i+4]) & 0x7fffffff) % 1000000
		if subtle.ConstantTimeCompare([]byte(fmt.Sprintf("%06d", n)), []byte(code)) == 1 {
			return true
		}
	}
	return false
}

func (s *Server) authenticate(c *gin.Context) {
	token, err := c.Cookie(cookieName)
	if err != nil {
		fail(c, 401, "session_expired", "authentication required")
		return
	}
	u, err := scanUser(s.Store.Pool.QueryRow(c.Request.Context(), "SELECT "+strings.ReplaceAll(userCols, ",", ",u.")+" FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()", hashToken(token)))
	if err != nil {
		fail(c, 401, "session_expired", "session expired")
		return
	}
	c.Set("user", u)
	c.Next()
}
func (s *Server) session(c *gin.Context, u user) error {
	token := randomToken()
	_, err := s.Store.Pool.Exec(c.Request.Context(), "INSERT INTO sessions(token_hash,user_id,expires_at,device) VALUES($1,$2,$3,$4)", hashToken(token), u.ID, time.Now().Add(7*24*time.Hour), c.Request.UserAgent())
	if err != nil {
		return err
	}
	http.SetCookie(c.Writer, &http.Cookie{Name: cookieName, Value: token, Path: "/", HttpOnly: true, Secure: s.Cfg.AppEnv == "production", SameSite: http.SameSiteLaxMode, MaxAge: 7 * 24 * 3600})
	return nil
}
func sessionJSON(u user) gin.H { return gin.H{"token": "", "user": u} }
func (s *Server) csrf(c *gin.Context) {
	if c.Request.Method == "GET" || c.Request.Method == "HEAD" || c.Request.Method == "OPTIONS" {
		c.Next()
		return
	}
	origin := c.GetHeader("Origin")
	if origin == "" {
		if ref := c.GetHeader("Referer"); ref != "" {
			u, _ := url.Parse(ref)
			origin = u.Scheme + "://" + u.Host
		}
	}
	if origin != "" {
		ok := origin == strings.TrimRight(s.Cfg.AppURL, "/")
		for _, allowed := range s.Cfg.CORSOrigins {
			if allowed == origin {
				ok = true
			}
		}
		if !ok {
			fail(c, 403, "csrf_failed", "origin not allowed")
			return
		}
	} else if c.GetHeader("Sec-Fetch-Site") == "cross-site" {
		fail(c, 403, "csrf_failed", "origin required")
		return
	}
	c.Next()
}

type limitEntry struct {
	Count int
	Until time.Time
}

func rateLimit(max int, period time.Duration) gin.HandlerFunc {
	var mu sync.Mutex
	entries := map[string]limitEntry{}
	return func(c *gin.Context) {
		mu.Lock()
		now := time.Now()
		key := c.ClientIP()
		e := entries[key]
		if now.After(e.Until) {
			e = limitEntry{Until: now.Add(period)}
		}
		e.Count++
		entries[key] = e
		if len(entries) > 10000 {
			for k, v := range entries {
				if now.After(v.Until) {
					delete(entries, k)
				}
			}
		}
		mu.Unlock()
		if e.Count > max {
			c.Header("Retry-After", fmt.Sprint(int(time.Until(e.Until).Seconds())+1))
			fail(c, 429, "rate_limited", "try again later")
			return
		}
		c.Next()
	}
}

func (s *Server) sendMail(ctx context.Context, u user, kind, value string) error {
	subject, body := "Your Campio verification code", "Your verification code is "+value+". It expires in 10 minutes."
	if u.Language == "ro" {
		subject = "Codul tău de verificare Campio"
		body = "Codul tău de verificare este " + value + ". Expiră în 10 minute."
	}
	if kind == "reset" {
		subject = "Reset your Campio password"
		body = "Reset your password using this link (valid for 30 minutes): " + value
		if u.Language == "ro" {
			subject = "Resetează parola Campio"
			body = "Resetează parola folosind acest link (valabil 30 de minute): " + value
		}
	}
	message := []byte("From: " + s.Cfg.SMTPFrom + "\r\nTo: " + u.Email + "\r\nSubject: " + subject + "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" + body + "\r\n")
	if s.Cfg.SMTPHost == "" {
		if s.Cfg.AppEnv == "production" {
			return fmt.Errorf("SMTP is required in production")
		}
		if err := os.MkdirAll(s.Cfg.MailDir, 0700); err != nil {
			return err
		}
		name := filepath.Join(s.Cfg.MailDir, fmt.Sprintf("%d-%s.eml", time.Now().UnixNano(), kind))
		if err := os.WriteFile(name, message, 0600); err != nil {
			return err
		}
		slog.Info("development mail saved", "file", name)
		return nil
	}
	var auth smtp.Auth
	if s.Cfg.SMTPUser != "" {
		auth = smtp.PlainAuth("", s.Cfg.SMTPUser, s.Cfg.SMTPPassword, s.Cfg.SMTPHost)
	}
	from, err := mail.ParseAddress(s.Cfg.SMTPFrom)
	if err != nil {
		return err
	}
	return smtp.SendMail(net.JoinHostPort(s.Cfg.SMTPHost, s.Cfg.SMTPPort), auth, from.Address, []string{u.Email}, message)
}
func otpCode() string {
	var b [4]byte
	_, err := rand.Read(b[:])
	if err != nil {
		panic(err)
	}
	return fmt.Sprintf("%06d", binary.BigEndian.Uint32(b[:])%1000000)
}
func (s *Server) challenge(c *gin.Context, u user) {
	id := uuid.New()
	code := otpCode()
	method := u.Method
	if method == "" || !u.Verified {
		method = "email"
	}
	if s.fixedOTP(u) {
		code = s.Cfg.TestUserOTP
	}
	_, err := s.Store.Pool.Exec(c.Request.Context(), "INSERT INTO auth_challenges(id,user_id,code_hash,method,expires_at) VALUES($1,$2,$3,$4,$5)", id, u.ID, hashToken(code), method, time.Now().Add(10*time.Minute))
	if err != nil {
		failErr(c, err)
		return
	}
	if method == "email" {
		if err = s.sendMail(c.Request.Context(), u, "verification", code); err != nil {
			fail(c, 503, "email_unavailable", "email delivery unavailable")
			return
		}
	}
	c.JSON(200, gin.H{"id": id, "email": u.Email, "method": method, "firstSetup": !u.Verified})
}
func (s *Server) signup(c *gin.Context) {
	var req struct{ Email, Password, Language string }
	if c.ShouldBindJSON(&req) != nil {
		fail(c, 400, "invalid_request", "invalid body")
		return
	}
	address, err := mail.ParseAddress(strings.TrimSpace(req.Email))
	if err != nil || !strings.EqualFold(address.Address, strings.TrimSpace(req.Email)) || len(req.Password) < 12 || len(req.Password) > 72 {
		fail(c, 400, "invalid_request", "valid email and 12-72 character password required")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		failErr(c, err)
		return
	}
	email := strings.ToLower(address.Address)
	u := user{ID: uuid.New(), Email: email, Name: strings.Split(email, "@")[0], Language: validLanguage(req.Language), TwoFactorEnabled: true, Method: "email"}
	_, err = s.Store.Pool.Exec(c.Request.Context(), "INSERT INTO users(id,email,name,password_hash,language) VALUES($1,$2,$3,$4,$5) ON CONFLICT(email) DO NOTHING", u.ID, u.Email, u.Name, string(hash), u.Language)
	if err != nil {
		failErr(c, err)
		return
	}
	saved, err := s.userByEmail(c.Request.Context(), email)
	if err != nil {
		failErr(c, err)
		return
	}
	if saved.ID != u.ID {
		fail(c, 409, "email_taken", "email already registered")
		return
	}
	s.challenge(c, u)
}
func (s *Server) login(c *gin.Context) {
	var req struct{ Email, Password string }
	if c.ShouldBindJSON(&req) != nil {
		fail(c, 400, "invalid_request", "invalid body")
		return
	}
	u, err := s.userByEmail(c.Request.Context(), req.Email)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(u.Hash), []byte(req.Password)) != nil {
		fail(c, 401, "invalid_credentials", "invalid credentials")
		return
	}
	s.challenge(c, u)
}
func (s *Server) getChallenge(c *gin.Context) {
	var email, method string
	var verified bool
	err := s.Store.Pool.QueryRow(c.Request.Context(), "SELECT u.email,a.method,u.verified FROM auth_challenges a JOIN users u ON u.id=a.user_id WHERE a.id=$1 AND a.expires_at>now() AND a.attempts<5", c.Query("id")).Scan(&email, &method, &verified)
	if err != nil {
		fail(c, 410, "challenge_expired", "challenge expired")
		return
	}
	c.JSON(200, gin.H{"id": c.Query("id"), "email": email, "method": method, "firstSetup": !verified})
}
func (s *Server) setMethod(c *gin.Context) {
	var req struct{ ID, Method string }
	if c.ShouldBindJSON(&req) != nil {
		fail(c, 400, "invalid_request", "invalid body")
		return
	}
	var userID uuid.UUID
	err := s.Store.Pool.QueryRow(c.Request.Context(), "SELECT user_id FROM auth_challenges WHERE id=$1 AND expires_at>now() AND attempts<5", req.ID).Scan(&userID)
	if err != nil {
		fail(c, 410, "challenge_expired", "expired")
		return
	}
	u, err := scanUser(s.Store.Pool.QueryRow(c.Request.Context(), "SELECT "+userCols+" FROM users WHERE id=$1", userID))
	if err != nil {
		failErr(c, err)
		return
	}
	if req.Method != u.Method || (!u.Verified && req.Method == "app") {
		fail(c, 400, "email_verification_required", "use the registered verification method")
		return
	}
	c.JSON(200, gin.H{"id": req.ID, "email": u.Email, "method": u.Method, "firstSetup": !u.Verified})
}
func (s *Server) resend(c *gin.Context) {
	var req struct{ ID string }
	if c.ShouldBindJSON(&req) != nil {
		fail(c, 400, "invalid_request", "invalid body")
		return
	}
	var userID uuid.UUID
	err := s.Store.Pool.QueryRow(c.Request.Context(), "SELECT user_id FROM auth_challenges WHERE id=$1 AND expires_at>now() AND method='email' AND attempts<5", req.ID).Scan(&userID)
	if err != nil {
		fail(c, 410, "challenge_expired", "expired")
		return
	}
	u, err := scanUser(s.Store.Pool.QueryRow(c.Request.Context(), "SELECT "+userCols+" FROM users WHERE id=$1", userID))
	if err != nil {
		failErr(c, err)
		return
	}
	code := otpCode()
	if s.fixedOTP(u) {
		code = s.Cfg.TestUserOTP
	}
	_, err = s.Store.Pool.Exec(c.Request.Context(), "UPDATE auth_challenges SET code_hash=$2 WHERE id=$1", req.ID, hashToken(code))
	if err != nil {
		failErr(c, err)
		return
	}
	if err = s.sendMail(c.Request.Context(), u, "verification", code); err != nil {
		fail(c, 503, "email_unavailable", "delivery unavailable")
		return
	}
	c.Status(204)
}
func (s *Server) verify(c *gin.Context) {
	var req struct{ ID, Code string }
	if c.ShouldBindJSON(&req) != nil {
		fail(c, 400, "invalid_request", "invalid body")
		return
	}
	tx, err := s.Store.Pool.Begin(c.Request.Context())
	if err != nil {
		failErr(c, err)
		return
	}
	defer tx.Rollback(c.Request.Context())
	var userID uuid.UUID
	var codeHash, method string
	err = tx.QueryRow(c.Request.Context(), "UPDATE auth_challenges SET attempts=attempts+1 WHERE id=$1 AND expires_at>now() AND attempts<5 RETURNING user_id,code_hash,method", req.ID).Scan(&userID, &codeHash, &method)
	if err != nil {
		fail(c, 410, "challenge_expired", "expired")
		return
	}
	u, err := scanUser(tx.QueryRow(c.Request.Context(), "SELECT "+userCols+" FROM users WHERE id=$1", userID))
	if err != nil {
		failErr(c, err)
		return
	}
	valid := subtle.ConstantTimeCompare([]byte(hashToken(req.Code)), []byte(codeHash)) == 1
	if method == "app" {
		secret, _ := s.cryptSecret(u.Secret, true)
		valid = validTOTP(secret, req.Code, time.Now())
	}
	if s.fixedOTP(u) && subtle.ConstantTimeCompare([]byte(req.Code), []byte(s.Cfg.TestUserOTP)) == 1 {
		valid = true
	}
	if !valid {
		_ = tx.Commit(c.Request.Context())
		fail(c, 401, "invalid_otp", "invalid code")
		return
	}
	_, err = tx.Exec(c.Request.Context(), "DELETE FROM auth_challenges WHERE id=$1", req.ID)
	if err == nil {
		_, err = tx.Exec(c.Request.Context(), "UPDATE users SET verified=true WHERE id=$1", u.ID)
	}
	if err == nil {
		err = tx.Commit(c.Request.Context())
	}
	if err != nil {
		failErr(c, err)
		return
	}
	u.Verified = true
	if err = s.session(c, u); err != nil {
		failErr(c, err)
		return
	}
	c.JSON(200, gin.H{"session": sessionJSON(u)})
}
func (s *Server) me(c *gin.Context) { c.JSON(200, sessionJSON(currentUser(c))) }
func (s *Server) logout(c *gin.Context) {
	token, _ := c.Cookie(cookieName)
	_, _ = s.Store.Pool.Exec(c.Request.Context(), "DELETE FROM sessions WHERE token_hash=$1", hashToken(token))
	http.SetCookie(c.Writer, &http.Cookie{Name: cookieName, Value: "", Path: "/", HttpOnly: true, Secure: s.Cfg.AppEnv == "production", SameSite: http.SameSiteLaxMode, MaxAge: -1})
	c.Status(204)
}
func (s *Server) refresh(c *gin.Context) {
	u := currentUser(c)
	token, _ := c.Cookie(cookieName)
	if err := s.session(c, u); err != nil {
		failErr(c, err)
		return
	}
	_, _ = s.Store.Pool.Exec(c.Request.Context(), "DELETE FROM sessions WHERE token_hash=$1", hashToken(token))
	c.JSON(200, sessionJSON(u))
}
func (s *Server) forgot(c *gin.Context) {
	var req struct{ Email string }
	if c.ShouldBindJSON(&req) != nil {
		fail(c, 400, "invalid_request", "invalid body")
		return
	}
	u, err := s.userByEmail(c.Request.Context(), req.Email)
	if err == nil {
		token := randomToken()
		_, err = s.Store.Pool.Exec(c.Request.Context(), "INSERT INTO reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,$3)", hashToken(token), u.ID, time.Now().Add(30*time.Minute))
		if err == nil {
			err = s.sendMail(c.Request.Context(), u, "reset", strings.TrimRight(s.Cfg.AppURL, "/")+"/reset-password?token="+token)
		}
		if err != nil {
			slog.Error("reset mail failed", "err", err)
		}
	}
	c.Status(204)
}
func (s *Server) validateReset(c *gin.Context) {
	var expires time.Time
	err := s.Store.Pool.QueryRow(c.Request.Context(), "SELECT expires_at FROM reset_tokens WHERE token_hash=$1", hashToken(c.Query("token"))).Scan(&expires)
	state := "valid"
	if err != nil {
		state = "invalid"
	} else if time.Now().After(expires) {
		state = "expired"
	}
	c.JSON(200, state)
}
func (s *Server) reset(c *gin.Context) {
	var req struct{ Token, Password string }
	if c.ShouldBindJSON(&req) != nil || len(req.Password) < 12 || len(req.Password) > 72 {
		fail(c, 400, "invalid_request", "12-72 character password required")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		failErr(c, err)
		return
	}
	tx, err := s.Store.Pool.Begin(c.Request.Context())
	if err != nil {
		failErr(c, err)
		return
	}
	defer tx.Rollback(c.Request.Context())
	var id uuid.UUID
	err = tx.QueryRow(c.Request.Context(), "DELETE FROM reset_tokens WHERE token_hash=$1 AND expires_at>now() RETURNING user_id", hashToken(req.Token)).Scan(&id)
	if err != nil {
		fail(c, 410, "reset_expired", "reset expired")
		return
	}
	_, err = tx.Exec(c.Request.Context(), "UPDATE users SET password_hash=$2 WHERE id=$1", id, string(hash))
	if err == nil {
		_, err = tx.Exec(c.Request.Context(), "DELETE FROM sessions WHERE user_id=$1", id)
	}
	if err == nil {
		_, err = tx.Exec(c.Request.Context(), "DELETE FROM reset_tokens WHERE user_id=$1", id)
	}
	if err == nil {
		err = tx.Commit(c.Request.Context())
	}
	if err != nil {
		failErr(c, err)
		return
	}
	c.Status(204)
}
func (s *Server) setupTOTP(c *gin.Context) {
	u := currentUser(c)
	if u.Method == "app" {
		fail(c, 409, "already_enabled", "already enabled")
		return
	}
	raw := make([]byte, 20)
	_, _ = rand.Read(raw)
	secret := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(raw)
	enc, err := s.cryptSecret(secret, false)
	if err != nil {
		failErr(c, err)
		return
	}
	_, err = s.Store.Pool.Exec(c.Request.Context(), "UPDATE users SET totp_secret=$2 WHERE id=$1", u.ID, enc)
	if err != nil {
		failErr(c, err)
		return
	}
	c.JSON(200, gin.H{"secret": secret, "otpauthUrl": "otpauth://totp/Campio:" + url.PathEscape(u.Email) + "?secret=" + secret + "&issuer=Campio"})
}
func (s *Server) enableTOTP(c *gin.Context) {
	u := currentUser(c)
	var req struct{ Code string }
	if c.ShouldBindJSON(&req) != nil {
		fail(c, 400, "invalid_request", "invalid body")
		return
	}
	secret, _ := s.cryptSecret(u.Secret, true)
	if !validTOTP(secret, req.Code, time.Now()) {
		fail(c, 401, "invalid_otp", "invalid code")
		return
	}
	_, err := s.Store.Pool.Exec(c.Request.Context(), "UPDATE users SET two_factor_method='app',two_factor_enabled=true WHERE id=$1", u.ID)
	if err != nil {
		failErr(c, err)
		return
	}
	c.Status(204)
}

func (s *Server) googleStart(c *gin.Context) {
	if s.Cfg.GoogleClientID == "" || s.Cfg.GoogleClientSecret == "" {
		fail(c, 503, "oauth_unavailable", "Google login not configured")
		return
	}
	state := randomToken()
	http.SetCookie(c.Writer, &http.Cookie{Name: "campio_oauth_state", Value: state, Path: "/api/auth/google", MaxAge: 600, HttpOnly: true, Secure: s.Cfg.AppEnv == "production", SameSite: http.SameSiteLaxMode})
	q := url.Values{"client_id": {s.Cfg.GoogleClientID}, "redirect_uri": {strings.TrimRight(s.Cfg.APIURL, "/") + "/api/auth/google/callback"}, "response_type": {"code"}, "scope": {"openid email profile"}, "state": {state}}
	c.JSON(200, gin.H{"url": "https://accounts.google.com/o/oauth2/v2/auth?" + q.Encode()})
}
func (s *Server) googleCallback(c *gin.Context) {
	state, err := c.Cookie("campio_oauth_state")
	if err != nil || state == "" || subtle.ConstantTimeCompare([]byte(state), []byte(c.Query("state"))) != 1 {
		fail(c, 400, "oauth_failed", "invalid OAuth state")
		return
	}
	http.SetCookie(c.Writer, &http.Cookie{Name: "campio_oauth_state", Value: "", Path: "/api/auth/google", MaxAge: -1, HttpOnly: true, Secure: s.Cfg.AppEnv == "production", SameSite: http.SameSiteLaxMode})
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.PostForm("https://oauth2.googleapis.com/token", url.Values{"code": {c.Query("code")}, "client_id": {s.Cfg.GoogleClientID}, "client_secret": {s.Cfg.GoogleClientSecret}, "redirect_uri": {strings.TrimRight(s.Cfg.APIURL, "/") + "/api/auth/google/callback"}, "grant_type": {"authorization_code"}})
	if err != nil {
		fail(c, 502, "oauth_failed", "token exchange failed")
		return
	}
	defer resp.Body.Close()
	var token struct {
		AccessToken string `json:"access_token"`
	}
	if json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&token) != nil || resp.StatusCode != 200 || token.AccessToken == "" {
		fail(c, 401, "oauth_failed", "Google token rejected")
		return
	}
	req, _ := http.NewRequestWithContext(c.Request.Context(), "GET", "https://openidconnect.googleapis.com/v1/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	info, err := client.Do(req)
	if err != nil {
		fail(c, 502, "oauth_failed", "profile unavailable")
		return
	}
	defer info.Body.Close()
	var profile struct {
		Email         string
		EmailVerified bool `json:"email_verified"`
		Name          string
	}
	if json.NewDecoder(io.LimitReader(info.Body, 1<<20)).Decode(&profile) != nil || !profile.EmailVerified || profile.Email == "" {
		fail(c, 401, "oauth_failed", "verified Google email required")
		return
	}
	u, err := s.userByEmail(c.Request.Context(), profile.Email)
	if err != nil {
		u = user{ID: uuid.New(), Email: strings.ToLower(profile.Email), Name: profile.Name, Language: "en", Verified: true, TwoFactorEnabled: true, Method: "email"}
		_, err = s.Store.Pool.Exec(c.Request.Context(), "INSERT INTO users(id,email,name,verified) VALUES($1,$2,$3,true)", u.ID, u.Email, u.Name)
		if err != nil {
			failErr(c, err)
			return
		}
	}
	id := uuid.New()
	code := otpCode()
	_, err = s.Store.Pool.Exec(c.Request.Context(), "INSERT INTO auth_challenges(id,user_id,code_hash,method,expires_at) VALUES($1,$2,$3,$4,$5)", id, u.ID, hashToken(code), u.Method, time.Now().Add(10*time.Minute))
	if err != nil {
		failErr(c, err)
		return
	}
	if u.Method == "email" {
		if err = s.sendMail(c.Request.Context(), u, "verification", code); err != nil {
			fail(c, 503, "email_unavailable", "delivery failed")
			return
		}
	}
	c.Redirect(302, strings.TrimRight(s.Cfg.AppURL, "/")+"/verify-2fa?challenge="+id.String())
}

// Disabling the authenticator returns the account to mandatory email verification.
func (s *Server) disableTOTP(c *gin.Context) {
	u := currentUser(c)
	var req struct{ Code string }
	if c.ShouldBindJSON(&req) != nil {
		fail(c, 400, "invalid_request", "invalid body")
		return
	}
	secret, _ := s.cryptSecret(u.Secret, true)
	if u.Method != "app" || !validTOTP(secret, req.Code, time.Now()) {
		fail(c, 401, "invalid_otp", "invalid code")
		return
	}
	_, err := s.Store.Pool.Exec(c.Request.Context(), "UPDATE users SET two_factor_method='email',totp_secret='' WHERE id=$1", u.ID)
	if err != nil {
		failErr(c, err)
		return
	}
	c.Status(204)
}
func (s *Server) revokeSession(c *gin.Context) {
	u := currentUser(c)
	id := c.Param("id")
	if len(id) != 16 {
		fail(c, 400, "invalid_request", "invalid session")
		return
	}
	token, _ := c.Cookie(cookieName)
	_, err := s.Store.Pool.Exec(c.Request.Context(), "DELETE FROM sessions WHERE user_id=$1 AND left(token_hash,16)=$2 AND token_hash<>$3", u.ID, id, hashToken(token))
	if err != nil {
		failErr(c, err)
		return
	}
	c.Status(204)
}
