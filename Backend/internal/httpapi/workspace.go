package httpapi

import (
	"encoding/json"
	"log/slog"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/tibi/hackathon/backend/internal/ai"
	"github.com/tibi/hackathon/backend/internal/campaign"
)

func (s *Server) ownership(c *gin.Context) {
	u := currentUser(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		fail(c, 400, "invalid_request", "id must be UUID")
		return
	}
	var owner uuid.UUID
	switch {
	case strings.HasPrefix(c.FullPath(), "/api/assets/"):
		err = s.Store.Pool.QueryRow(c.Request.Context(), "SELECT c.user_id FROM assets a JOIN campaigns c ON c.id=a.campaign_id WHERE a.id=$1", id).Scan(&owner)
	case strings.HasPrefix(c.FullPath(), "/api/edits/"):
		err = s.Store.Pool.QueryRow(c.Request.Context(), "SELECT c.user_id FROM edits e JOIN campaigns c ON c.id=e.campaign_id WHERE e.id=$1", id).Scan(&owner)
	default:
		err = s.Store.Pool.QueryRow(c.Request.Context(), "SELECT user_id FROM campaigns WHERE id=$1", id).Scan(&owner)
	}
	if err != nil || owner != u.ID {
		fail(c, 404, "not_found", "resource not found")
		return
	}
	c.Next()
}
func (s *Server) profile(c *gin.Context) {
	u := currentUser(c)
	if c.Request.Method == "PATCH" {
		var req struct {
			Name         *string `json:"name"`
			BusinessName *string `json:"businessName"`
			Language     *string `json:"language"`
		}
		if c.ShouldBindJSON(&req) != nil {
			fail(c, 400, "invalid_request", "invalid body")
			return
		}
		if req.Name != nil {
			u.Name = strings.TrimSpace(*req.Name)
		}
		if req.BusinessName != nil {
			u.BusinessName = strings.TrimSpace(*req.BusinessName)
		}
		if req.Language != nil {
			u.Language = validLanguage(*req.Language)
		}
		if len(u.Name) > 120 || len(u.BusinessName) > 160 {
			fail(c, 400, "invalid_request", "name too long")
			return
		}
		_, err := s.Store.Pool.Exec(c.Request.Context(), "UPDATE users SET name=$2,business_name=$3,language=$4 WHERE id=$1", u.ID, u.Name, u.BusinessName, u.Language)
		if err != nil {
			failErr(c, err)
			return
		}
	}
	c.JSON(200, u)
}
func mergeJSON(base, patch map[string]any) map[string]any {
	if base == nil {
		base = map[string]any{}
	}
	for k, v := range patch {
		if child, ok := v.(map[string]any); ok {
			old, _ := base[k].(map[string]any)
			base[k] = mergeJSON(old, child)
		} else {
			base[k] = v
		}
	}
	return base
}
func (s *Server) settings(c *gin.Context) {
	u := currentUser(c)
	var raw []byte
	err := s.Store.Pool.QueryRow(c.Request.Context(), "SELECT settings FROM users WHERE id=$1", u.ID).Scan(&raw)
	if err != nil {
		failErr(c, err)
		return
	}
	base := map[string]any{"profile": map[string]any{"name": u.Name, "businessName": u.BusinessName, "email": u.Email}, "security": map[string]any{"twoFactorEnabled": true, "sessions": []any{}}, "integrations": map[string]any{"meta_ads": "soon", "google_ads": "soon", "tiktok_ads": "soon", "mailchimp": "soon", "shopify": "soon"}, "notifications": map[string]any{"resultsReminder": true, "weeklyDigest": true, "productNews": false}, "language": u.Language, "brandKit": map[string]any{"colors": []string{"#14213D", "#F4EDE0", "#FF6B5B"}, "tone": "warm"}}
	saved := map[string]any{}
	_ = json.Unmarshal(raw, &saved)
	base = mergeJSON(base, saved)
	if c.Request.Method == "PATCH" {
		var patch map[string]any
		if c.ShouldBindJSON(&patch) != nil {
			fail(c, 400, "invalid_request", "invalid body")
			return
		}
		for k := range patch {
			if k != "profile" && k != "language" && k != "brandKit" && k != "notifications" {
				delete(patch, k)
			}
		}
		base = mergeJSON(base, patch)
		if lang, ok := patch["language"].(string); ok {
			u.Language = validLanguage(lang)
		}
		if p, ok := patch["profile"].(map[string]any); ok {
			if v, ok := p["name"].(string); ok {
				u.Name = v
			}
			if v, ok := p["businessName"].(string); ok {
				u.BusinessName = v
			}
		}
		if len(u.Name) > 120 || len(u.BusinessName) > 160 {
			fail(c, 400, "invalid_request", "name too long")
			return
		}
		b, _ := json.Marshal(base)
		_, err = s.Store.Pool.Exec(c.Request.Context(), "UPDATE users SET settings=$2,name=$3,business_name=$4,language=$5 WHERE id=$1", u.ID, b, u.Name, u.BusinessName, u.Language)
		if err != nil {
			failErr(c, err)
			return
		}
	}
	token, _ := c.Cookie(cookieName)
	rows, err := s.Store.Pool.Query(c.Request.Context(), "SELECT token_hash,device,created_at FROM sessions WHERE user_id=$1 AND expires_at>now() ORDER BY created_at DESC", u.ID)
	if err != nil {
		failErr(c, err)
		return
	}
	defer rows.Close()
	sessions := []gin.H{}
	for rows.Next() {
		var h, device string
		var created time.Time
		if rows.Scan(&h, &device, &created) == nil {
			sessions = append(sessions, gin.H{"id": h[:16], "device": device, "location": "", "lastActive": created.Format(time.RFC3339), "current": h == hashToken(token)})
		}
	}
	base["security"] = gin.H{"twoFactorEnabled": true, "sessions": sessions}
	base["language"] = u.Language
	base["profile"] = gin.H{"name": u.Name, "businessName": u.BusinessName, "email": u.Email}
	base["integrations"] = gin.H{"meta_ads": "soon", "google_ads": "soon", "tiktok_ads": "soon", "mailchimp": "soon", "shopify": "soon"}
	c.JSON(200, base)
}
func (s *Server) changePassword(c *gin.Context) {
	u := currentUser(c)
	var req struct{ Current, Next string }
	if c.ShouldBindJSON(&req) != nil || len(req.Next) < 12 || len(req.Next) > 72 {
		fail(c, 400, "invalid_request", "12-72 character password required")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(u.Hash), []byte(req.Current)) != nil {
		fail(c, 401, "invalid_password", "current password incorrect")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Next), 12)
	if err != nil {
		failErr(c, err)
		return
	}
	_, err = s.Store.Pool.Exec(c.Request.Context(), "UPDATE users SET password_hash=$2 WHERE id=$1", u.ID, string(hash))
	if err != nil {
		failErr(c, err)
		return
	}
	token, _ := c.Cookie(cookieName)
	_, _ = s.Store.Pool.Exec(c.Request.Context(), "DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2", u.ID, hashToken(token))
	c.Status(204)
}
func (s *Server) deleteAccount(c *gin.Context) {
	u := currentUser(c)
	_, err := s.Store.Pool.Exec(c.Request.Context(), "DELETE FROM users WHERE id=$1", u.ID)
	if err != nil {
		failErr(c, err)
		return
	}
	s.logout(c)
}
func (s *Server) notifications(c *gin.Context) {
	u := currentUser(c)
	rows, err := s.Store.Pool.Query(c.Request.Context(), "SELECT id,title,body,href,read,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC", u.ID)
	if err != nil {
		failErr(c, err)
		return
	}
	defer rows.Close()
	items := []gin.H{}
	for rows.Next() {
		var id uuid.UUID
		var title, body, href string
		var read bool
		var created time.Time
		if err = rows.Scan(&id, &title, &body, &href, &read, &created); err != nil {
			failErr(c, err)
			return
		}
		items = append(items, gin.H{"id": id, "title": title, "body": body, "href": href, "read": read, "createdAt": created.Format(time.RFC3339)})
	}
	c.JSON(200, items)
}
func (s *Server) readNotifications(c *gin.Context) {
	_, err := s.Store.Pool.Exec(c.Request.Context(), "UPDATE notifications SET read=true WHERE user_id=$1", currentUser(c).ID)
	if err != nil {
		failErr(c, err)
		return
	}
	c.Status(204)
}
func (s *Server) onboarding(c *gin.Context) {
	u := currentUser(c)
	var data []byte
	if c.Request.Method == "PATCH" {
		var req struct {
			Completed []string `json:"completed"`
			Activity  []string `json:"activity"`
		}
		if c.ShouldBindJSON(&req) != nil || len(req.Completed) > 100 || len(req.Activity) > 5000 {
			fail(c, 400, "invalid_request", "invalid body")
			return
		}
		if req.Completed == nil {
			req.Completed = []string{}
		}
		if req.Activity == nil {
			req.Activity = []string{}
		}
		data, _ = json.Marshal(req)
		_, err := s.Store.Pool.Exec(c.Request.Context(), "UPDATE users SET onboarding=$2 WHERE id=$1", u.ID, data)
		if err != nil {
			failErr(c, err)
			return
		}
	} else {
		if err := s.Store.Pool.QueryRow(c.Request.Context(), "SELECT onboarding FROM users WHERE id=$1", u.ID).Scan(&data); err != nil {
			failErr(c, err)
			return
		}
	}
	c.Data(200, "application/json", data)
}
func (s *Server) patchUIData(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	var patch map[string]any
	if c.ShouldBindJSON(&patch) != nil {
		fail(c, 400, "invalid_request", "invalid body")
		return
	}
	for k := range patch {
		switch k {
		case "status", "resolvedWarnings", "completedActions":
		default:
			delete(patch, k)
		}
	}
	if v, ok := patch["status"]; ok && v != "launched" && v != "ready" {
		fail(c, 400, "invalid_request", "invalid status")
		return
	}
	b, _ := json.Marshal(patch)
	_, err := s.Store.Pool.Exec(c.Request.Context(), "UPDATE campaigns SET ui_data=ui_data||$2,updated_at=now() WHERE id=$1", id, b)
	if err != nil {
		failErr(c, err)
		return
	}
	s.getCampaign(c)
}

type channelResult struct {
	ChannelID   string  `json:"channelId"`
	Spent       float64 `json:"spent"`
	Impressions float64 `json:"impressions"`
	Clicks      float64 `json:"clicks"`
	Orders      float64 `json:"orders"`
	Revenue     float64 `json:"revenue"`
}

func (s *Server) results(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	k, _, err := s.Campaigns.Get(c.Request.Context(), id)
	if err != nil {
		failErr(c, err)
		return
	}
	if k.Status != campaign.StatusCompleted {
		fail(c, 409, "not_ready", "campaign is not ready")
		return
	}
	var data []channelResult
	if c.ShouldBindJSON(&data) != nil || len(data) == 0 || len(data) > 30 {
		fail(c, 400, "invalid_request", "results required")
		return
	}
	for _, r := range data {
		for _, n := range []float64{r.Spent, r.Impressions, r.Clicks, r.Orders, r.Revenue} {
			if n < 0 || n > 1e12 || math.IsNaN(n) || math.IsInf(n, 0) {
				fail(c, 400, "invalid_request", "results must be nonnegative finite numbers")
				return
			}
		}
	}
	b, _ := json.Marshal(gin.H{"results": data, "status": "launched"})
	_, err = s.Store.Pool.Exec(c.Request.Context(), "UPDATE campaigns SET ui_data=ui_data||$2,updated_at=now() WHERE id=$1", id, b)
	if err != nil {
		failErr(c, err)
		return
	}
	k.UIData["results"] = data
	c.JSON(200, analyzeResults(k, data))
}
func (s *Server) resultsAnalysis(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	k, _, err := s.Campaigns.Get(c.Request.Context(), id)
	if err != nil {
		failErr(c, err)
		return
	}
	b, _ := json.Marshal(k.UIData["results"])
	var data []channelResult
	_ = json.Unmarshal(b, &data)
	if len(data) == 0 {
		c.JSON(200, nil)
		return
	}
	c.JSON(200, analyzeResults(k, data))
}
func analyzeResults(k campaign.Kit, results []channelResult) gin.H {
	var orders, clicks, impressions, spent float64
	for _, r := range results {
		orders += r.Orders
		clicks += r.Clicks
		impressions += r.Impressions
		spent += r.Spent
	}
	ctr, cpo := 0.0, 0.0
	if impressions > 0 {
		ctr = clicks / impressions * 100
	}
	if orders > 0 {
		cpo = spent / orders
	}
	target := 0.0
	if k.Plan != nil {
		target = k.Plan.Totals.EstOrders
	}
	tr := func(en, ro string) string {
		if k.Input.Language == "ro" {
			return ro
		}
		return en
	}
	series := []gin.H{{"day": "1", "predicted": 0, "actual": 0}, {"day": "28", "predicted": target, "actual": orders}}
	return gin.H{"series": series, "deltas": []gin.H{{"id": "orders", "label": tr("Orders", "Comenzi"), "predicted": target, "actual": orders, "unit": ""}, {"id": "ctr", "label": tr("Click-through rate", "Rată de click"), "predicted": 1.0, "actual": math.Round(ctr*100) / 100, "unit": "%"}, {"id": "cpo", "label": tr("Cost per order", "Cost per comandă"), "predicted": func() float64 {
		if k.Plan != nil {
			return k.Plan.Totals.CPARON
		}
		return 0
	}(), "actual": math.Round(cpo*100) / 100, "unit": "RON"}}, "suggestions": []gin.H{{"id": "s1", "title": tr("Review the strongest channel", "Verifică cel mai bun canal"), "body": tr("Compare cost per order across channels. Test a small budget increase only when orders are consistent; these are calculated suggestions, not AI research or guaranteed outcomes.", "Compară costul pe comandă între canale. Testează o creștere mică doar când comenzile sunt constante; acestea sunt sugestii calculate, nu cercetare AI sau rezultate garantate."), "impact": "mare"}, {"id": "s2", "title": tr("Test one message at a time", "Testează câte un mesaj"), "body": tr("Keep the audience and product fixed, then compare two opening lines over the same period.", "Păstrează publicul și produsul, apoi compară două începuturi de text în aceeași perioadă."), "impact": "mediu"}, {"id": "s3", "title": tr("Check the product page", "Verifică pagina produsului"), "body": tr("If clicks do not become orders, check price, delivery information and checkout before increasing spend.", "Dacă click-urile nu devin comenzi, verifică prețul, livrarea și comanda înainte să crești bugetul."), "impact": "mic"}}}
}

func (s *Server) parseProduct(c *gin.Context) {
	var req struct{ Text, Language string }
	if c.ShouldBindJSON(&req) != nil || len(strings.TrimSpace(req.Text)) < 5 || len(req.Text) > 4000 {
		fail(c, 400, "invalid_request", "describe the product (5-4000 characters)")
		return
	}
	var r ai.IntakeResult
	var err error
	if !s.Cfg.MockAI {
		var usage ai.Usage
		r, usage, err = s.AI.Intake(c.Request.Context(), req.Text+ai.LanguageInstruction(validLanguage(req.Language)), nil, nil, nil)
		if cerr := s.Store.ChargeUser(c.Request.Context(), currentUser(c).ID, usage.Cost, "Product description parsing"); cerr != nil {
			slog.Error("charge wizard parse", "err", cerr)
		}
		if err != nil {
			failErr(c, err)
			return
		}
	} else {
		r = mockParse(req.Text, req.Language)
	}
	price := any(nil)
	if r.SalePrice > 0 {
		price = r.SalePrice
	}
	fields := []string{"name", "shortDescription"}
	missing := []string{}
	if r.ProductName == "" {
		missing = append(missing, "name")
	}
	if price == nil {
		missing = append(missing, "price")
	} else {
		fields = append(fields, "price")
	}
	c.JSON(http.StatusOK, gin.H{"product": gin.H{"name": r.ProductName, "category": "", "price": price, "currency": "RON", "shortDescription": r.ProductDescription, "strengths": []string{}, "audience": "", "country": "RO"}, "aiFields": fields, "missing": missing})
}

var pricePattern = regexp.MustCompile(`(?i)(\d+(?:[.,]\d{1,2})?)\s*(?:ron|lei|leu)\b`)

func mockParse(text, language string) ai.IntakeResult {
	name := strings.TrimSpace(strings.Split(strings.Split(text, "\n")[0], ".")[0])
	if len([]rune(name)) > 65 {
		name = string([]rune(name)[:65])
	}
	lower := strings.ToLower(text)
	if strings.Contains(lower, "candle") || strings.Contains(lower, "lumân") || strings.Contains(lower, "luman") {
		name = "Soy candle"
		if language == "ro" {
			name = "Lumânare din soia"
		}
	}
	price := 0.0
	if m := pricePattern.FindStringSubmatch(text); len(m) > 1 {
		price, _ = strconv.ParseFloat(strings.ReplaceAll(m[1], ",", "."), 64)
	}
	return ai.IntakeResult{ProductName: name, ProductDescription: text, SalePrice: price, Questions: []ai.IntakeQuestion{}}
}
