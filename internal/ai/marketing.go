package ai

import (
	"context"
	"sort"

	"github.com/tibi/hackathon/backend/internal/analysis"
	"github.com/tibi/hackathon/backend/internal/model"
)

// ---------- Step 1: strategy (complaints, personas, positioning) ----------

// Complaint is a recurring problem found in competitor reviews.
type Complaint struct {
	Theme       string   `json:"theme"`
	Mentions    int      `json:"mentions"`
	Severity    string   `json:"severity"` // low | medium | high
	Quotes      []string `json:"quotes"`
	Opportunity string   `json:"opportunity"`
	Source      string   `json:"source"` // emag_reviews | reddit | both
}

// Persona is a target buyer.
type Persona struct {
	ID             string   `json:"id"` // p1, p2, p3
	Name           string   `json:"name"`
	AgeRange       string   `json:"age_range"`
	Occupation     string   `json:"occupation"`
	Description    string   `json:"description"`
	Motivations    []string `json:"motivations"`
	PainPoints     []string `json:"pain_points"`
	Channels       []string `json:"channels"` // where they spend time online
	BuyingTriggers []string `json:"buying_triggers"`
	Objections     []string `json:"objections"`
	MessageHook    string   `json:"message_hook"`
}

// PositioningMessage turns a competitor complaint into our message.
type PositioningMessage struct {
	ComplaintTheme string `json:"complaint_theme"`
	Message        string `json:"message"`
	ProofClaim     string `json:"proof_claim"` // e.g. "baterie testată 8 ore"
}

// Positioning is the core of the brand story.
type Positioning struct {
	Statement   string               `json:"statement"`
	MainMessage string               `json:"main_message"`
	Tone        string               `json:"tone"`
	ProofPoints []string             `json:"proof_points"`
	Messages    []PositioningMessage `json:"messages"`
}

// Strategy is the output of step 1.
type Strategy struct {
	Summary     string      `json:"summary"`
	Complaints  []Complaint `json:"complaints"`
	Personas    []Persona   `json:"personas"`
	Positioning Positioning `json:"positioning"`
}

var onlineChannels = []string{"facebook", "instagram", "tiktok", "youtube", "google_search", "emag", "forums", "pinterest"}

const strategySystem = `Ești strateg de marketing pentru vânzători mici de pe eMAG.ro. Primești produsul vânzătorului și date reale despre piață: concurenți eMAG, prețuri, recenzii ale clienților, tendința Google Trends și, când sunt disponibile, date din afara eMAG: produse similare de pe Amazon ("amazon_competitors"), discuții de pe Reddit ("reddit_discussions") și produse noi lansate pe BetaList ("new_launches"). Statisticile lor calculate sunt în "web_stats".
Sarcini:
1. Extrage nemulțumirile recurente DOAR din recenziile eMAG primite și din discuțiile Reddit primite (citatele trebuie să fie fragmente reale, în limba originală; "mentions" = câte recenzii/discuții din liste o menționează). "source" = "emag_reviews", "reddit" sau "both", după unde apare. Max 6.
2. Definește 2-3 persona (id "p1", "p2", "p3"): cine cumpără, ce îi motivează, unde stă online (din lista de canale permise), ce îi declanșează cumpărarea, ce obiecții are, și un "message_hook" de o frază. Discuțiile Reddit arată cum vorbesc și ce caută cumpărătorii reali: folosește-le pentru motivații, obiecții și declanșatori.
3. Poziționare: transformă nemulțumirile în mesaje. Ex.: dacă toți se plâng de baterie → "baterie testată 8 ore". "proof_claim" trebuie să fie o promisiune verificabilă, dar NU inventa specificații tehnice pe care vânzătorul nu le-a dat: formulează-le ca sugestie de verificat (ex.: "dacă bateria ține 8 ore, spune exact asta").
Amazon arată cum se poziționează produsul pe piața internațională (titluri, prețuri, ratinguri); BetaList arată idei noi din jurul produsului. Folosește-le doar ca inspirație pentru diferențiere, nu ca date despre piața din România.
Scrie în română, concis. Nu inventa cifre de piață: folosește doar cifrele din JSON.`

func strategySchema() map[string]any {
	return sObj(map[string]any{
		"summary": sStr(),
		"complaints": sArr(sObj(map[string]any{
			"theme": sStr(), "mentions": sInt(), "severity": sEnum("low", "medium", "high"),
			"quotes": sArr(sStr()), "opportunity": sStr(), "source": sEnum("emag_reviews", "reddit", "both"),
		})),
		"personas": sArr(sObj(map[string]any{
			"id": sStr(), "name": sStr(), "age_range": sStr(), "occupation": sStr(), "description": sStr(),
			"motivations": sArr(sStr()), "pain_points": sArr(sStr()),
			"channels":        sArr(sEnum(onlineChannels...)),
			"buying_triggers": sArr(sStr()), "objections": sArr(sStr()), "message_hook": sStr(),
		})),
		"positioning": sObj(map[string]any{
			"statement": sStr(), "main_message": sStr(), "tone": sStr(), "proof_points": sArr(sStr()),
			"messages": sArr(sObj(map[string]any{"complaint_theme": sStr(), "message": sStr(), "proof_claim": sStr()})),
		}),
	})
}

// ProductBrief is what the seller tells us about the product.
type ProductBrief struct {
	ProductName        string  `json:"product_name"`
	Keyword            string  `json:"keyword"`
	ProductDescription string  `json:"product_description,omitempty"`
	SalePrice          float64 `json:"sale_price"`
	BrandName          string  `json:"brand_name,omitempty"`
	AdBudgetRON        float64 `json:"ad_budget_ron"`
}

// GenerateStrategy runs step 1.
// web may be empty (older campaigns, or every web source skipped).
func (c *Client) GenerateStrategy(ctx context.Context, p ProductBrief, m analysis.MarketStats, t analysis.TrendStats, snap model.MarketSnapshot, web model.WebSnapshot, ws analysis.WebStats) (Strategy, Usage, error) {
	payload := map[string]any{
		"product": p, "market": m, "trend": t,
		"competitors": topCompetitors(snap.Products, 15),
		"reviews":     selectReviews(snap, 70),
	}
	if len(web.Amazon)+len(web.Discussions)+len(web.Launches) > 0 {
		payload["web_stats"] = ws
		payload["amazon_competitors"] = topAmazon(web.Amazon, 10)
		payload["reddit_discussions"] = selectDiscussions(web.Discussions, 40)
		payload["new_launches"] = relevantLaunches(web.Launches, web.Query, 10)
	}
	var s Strategy
	u, err := c.structured(ctx, "strategy", strategySystem, "Date (JSON):\n"+mustJSON(payload), strategySchema(), 5000, &s)
	if err != nil {
		return s, u, err
	}
	if s.Complaints == nil {
		s.Complaints = []Complaint{}
	}
	for i := range s.Complaints {
		if s.Complaints[i].Source == "" {
			s.Complaints[i].Source = "emag_reviews"
		}
	}
	if s.Personas == nil {
		s.Personas = []Persona{}
	}
	return s, u, nil
}

// ---------- Step 2: content ----------

// Listing is the eMAG product page copy.
type Listing struct {
	Titles         []string `json:"titles"`
	Description    string   `json:"description"`
	Bullets        []string `json:"bullets"`
	SearchKeywords []string `json:"search_keywords"`
}

// Ad is a paid ad variant.
type Ad struct {
	ID          string `json:"id"` // ad1..ad5
	PersonaID   string `json:"persona_id"`
	Channel     string `json:"channel"`
	Angle       string `json:"angle"`
	Headline    string `json:"headline"`
	PrimaryText string `json:"primary_text"`
	CTA         string `json:"cta"`
}

// SocialPost is an organic social media post.
type SocialPost struct {
	Channel  string   `json:"channel"` // facebook | instagram | tiktok
	Format   string   `json:"format"`  // post | reel | story | carousel
	Text     string   `json:"text"`
	Hashtags []string `json:"hashtags"`
}

// ImageIdea is a product photo / creative idea.
type ImageIdea struct {
	Title            string `json:"title"`
	Description      string `json:"description"`
	GenerationPrompt string `json:"generation_prompt"` // English prompt for an image model
}

// Shot is one clip of a short video.
type Shot struct {
	Description string `json:"description"`  // Romanian, for the seller
	VideoPrompt string `json:"video_prompt"` // English prompt for the video model
	DurationS   int    `json:"duration_s"`
	Caption     string `json:"caption"` // on-screen text, Romanian
}

// VideoConcept is a short-form video (reel/TikTok) made of shots.
type VideoConcept struct {
	ID           string   `json:"id"` // v1..v3
	Title        string   `json:"title"`
	PersonaID    string   `json:"persona_id"`
	Hook         string   `json:"hook"`
	Shots        []Shot   `json:"shots"`
	EndCardLines []string `json:"end_card_lines"`
	MusicMood    string   `json:"music_mood"`
}

// Content is the output of step 2.
type Content struct {
	Listing       Listing        `json:"listing"`
	Ads           []Ad           `json:"ads"`
	SocialPosts   []SocialPost   `json:"social_posts"`
	ImageIdeas    []ImageIdea    `json:"image_ideas"`
	VideoConcepts []VideoConcept `json:"video_concepts"`
}

const contentSystem = `Ești copywriter de performanță pentru e-commerce în România. Primești produsul, strategia (persona, poziționare, nemulțumirile concurenței) și date de piață.
Generează:
- listing eMAG: 3 variante de titlu (max 150 caractere, cuvântul cheie la început), descriere (3-5 paragrafe scurte), 5 bullet points, cuvinte cheie de căutare;
- 3-5 reclame (id "ad1".."ad5"), fiecare pentru o persona (persona_id) și un canal plătit, cu unghiul de mesaj (din poziționare), titlu, text, CTA;
- 3-6 postări social media organice;
- 3-4 idei de imagini (generation_prompt în engleză, pentru un model text-to-image, fără text în imagine);
- 2 concepte video scurte 9:16 (id "v1","v2"), fiecare cu 2-3 shot-uri de 3-6 secunde. "video_prompt" în ENGLEZĂ, vizual și concret (subiect, acțiune, cadru, lumină, mișcare de cameră), fără text/litere/logo-uri în imagine, fără persoane celebre și fără branduri ale altora. "caption" = textul scurt (max 8 cuvinte) pus peste clip, în română. "end_card_lines": prima linie = prețul (ex. "79 lei"), apoi numele produsului, apoi CTA.
Reguli: română naturală, fără clișee; nu inventa specificații tehnice care nu apar în descrierea produsului; folosește prețul exact primit.`

func contentSchema() map[string]any {
	return sObj(map[string]any{
		"listing": sObj(map[string]any{
			"titles": sArr(sStr()), "description": sStr(), "bullets": sArr(sStr()), "search_keywords": sArr(sStr()),
		}),
		"ads": sArr(sObj(map[string]any{
			"id": sStr(), "persona_id": sStr(), "channel": sEnum(analysis.Channels...), "angle": sStr(),
			"headline": sStr(), "primary_text": sStr(), "cta": sStr(),
		})),
		"social_posts": sArr(sObj(map[string]any{
			"channel": sEnum("facebook", "instagram", "tiktok"), "format": sEnum("post", "reel", "story", "carousel"),
			"text": sStr(), "hashtags": sArr(sStr()),
		})),
		"image_ideas": sArr(sObj(map[string]any{"title": sStr(), "description": sStr(), "generation_prompt": sStr()})),
		"video_concepts": sArr(sObj(map[string]any{
			"id": sStr(), "title": sStr(), "persona_id": sStr(), "hook": sStr(),
			"shots": sArr(sObj(map[string]any{
				"description": sStr(), "video_prompt": sStr(), "duration_s": sInt(), "caption": sStr(),
			})),
			"end_card_lines": sArr(sStr()), "music_mood": sStr(),
		})),
	})
}

// GenerateContent runs step 2.
func (c *Client) GenerateContent(ctx context.Context, p ProductBrief, s Strategy, m analysis.MarketStats) (Content, Usage, error) {
	payload := map[string]any{
		"product": p, "strategy": s,
		"market": map[string]any{"price_median": m.PriceMedian, "price_p25": m.PriceP25, "price_p75": m.PriceP75, "avg_rating": m.AvgRating, "competitor_count": m.CompetitorCount},
	}
	var ct Content
	u, err := c.structured(ctx, "content", contentSystem, "Date (JSON):\n"+mustJSON(payload), contentSchema(), 7000, &ct)
	if err != nil {
		return ct, u, err
	}
	if ct.Ads == nil {
		ct.Ads = []Ad{}
	}
	if ct.SocialPosts == nil {
		ct.SocialPosts = []SocialPost{}
	}
	if ct.ImageIdeas == nil {
		ct.ImageIdeas = []ImageIdea{}
	}
	if ct.VideoConcepts == nil {
		ct.VideoConcepts = []VideoConcept{}
	}
	return ct, u, nil
}

// ---------- Step 3: campaign plan + A/B tests ----------

// ChannelChoice is the AI's channel split proposal (percentages normalised by code).
type ChannelChoice struct {
	Channel   string   `json:"channel"`
	SharePct  float64  `json:"share_pct"`
	Rationale string   `json:"rationale"`
	Formats   []string `json:"formats"`
}

// CalendarAction is one planned action.
type CalendarAction struct {
	Day         string   `json:"day"` // e.g. "Luni"
	Channel     string   `json:"channel"`
	Action      string   `json:"action"`
	ContentRefs []string `json:"content_refs"` // ad / video ids
}

// CalendarWeek is one week of the 4-week plan.
type CalendarWeek struct {
	Week    int              `json:"week"`
	Theme   string           `json:"theme"`
	Goal    string           `json:"goal"`
	Actions []CalendarAction `json:"actions"`
}

// ABTestIdea is a test proposed by the AI (sized later by code).
type ABTestIdea struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Hypothesis   string `json:"hypothesis"`
	Channel      string `json:"channel"`
	Metric       string `json:"metric"` // ctr | cvr
	VariantA     string `json:"variant_a"`
	VariantB     string `json:"variant_b"`
	DecisionRule string `json:"decision_rule"`
}

// Plan is the output of step 3.
type Plan struct {
	Channels []ChannelChoice `json:"channels"`
	Calendar []CalendarWeek  `json:"calendar"`
	ABTests  []ABTestIdea    `json:"ab_tests"`
	KPIs     []string        `json:"kpis"`
}

const planSystem = `Ești media planner pentru un vânzător mic de pe eMAG.ro. Primești produsul, bugetul total de reclame pe 4 săptămâni, strategia, conținutul generat (reclame cu id, concepte video cu id) și benchmark-urile canalelor.
Generează:
- "channels": împărțirea bugetului pe canalele plătite (procente; codul le normalizează și calculează lei, afișări, click-uri, comenzi). Alege 2-4 canale potrivite persona-urilor. Explică pe scurt alegerea și formatele.
- "calendar": exact 4 săptămâni (week 1..4), fiecare cu temă, obiectiv și 3-6 acțiuni concrete (zi, canal, acțiune, content_refs = id-uri de reclame "adN" sau video "vN" din conținut). Săptămâna 1 = lansare + teste, săptămâna 2 = test A/B, 3 = scalează câștigătorul, 4 = retargeting + recenzii.
- "ab_tests": 2-3 teste A/B de mesaj (ex.: "mesajul A (baterie) vs mesajul B (lumină caldă)"), cu ipoteză, canal, metrică ("ctr" pentru mesaje/creative, "cvr" pentru pagina produsului/preț), cele două variante și regula de decizie. NU calcula dimensiunea eșantionului — o face codul.
- "kpis": 3-5 indicatori de urmărit.
NU inventa cifre de performanță; scrie în română.`

func planSchema() map[string]any {
	return sObj(map[string]any{
		"channels": sArr(sObj(map[string]any{
			"channel": sEnum(analysis.Channels...), "share_pct": sNum(), "rationale": sStr(), "formats": sArr(sStr()),
		})),
		"calendar": sArr(sObj(map[string]any{
			"week": sInt(), "theme": sStr(), "goal": sStr(),
			"actions": sArr(sObj(map[string]any{
				"day": sStr(), "channel": sStr(), "action": sStr(), "content_refs": sArr(sStr()),
			})),
		})),
		"ab_tests": sArr(sObj(map[string]any{
			"id": sStr(), "name": sStr(), "hypothesis": sStr(), "channel": sEnum(analysis.Channels...),
			"metric": sEnum(analysis.MetricCTR, analysis.MetricCVR), "variant_a": sStr(), "variant_b": sStr(), "decision_rule": sStr(),
		})),
		"kpis": sArr(sStr()),
	})
}

// GeneratePlan runs step 3.
func (c *Client) GeneratePlan(ctx context.Context, p ProductBrief, s Strategy, ct Content) (Plan, Usage, error) {
	ads := make([]map[string]string, 0, len(ct.Ads))
	for _, a := range ct.Ads {
		ads = append(ads, map[string]string{"id": a.ID, "channel": a.Channel, "persona_id": a.PersonaID, "angle": a.Angle, "headline": a.Headline})
	}
	videos := make([]map[string]string, 0, len(ct.VideoConcepts))
	for _, v := range ct.VideoConcepts {
		videos = append(videos, map[string]string{"id": v.ID, "title": v.Title, "persona_id": v.PersonaID, "hook": v.Hook})
	}
	payload := map[string]any{
		"product": p, "personas": s.Personas, "positioning": s.Positioning,
		"ads": ads, "videos": videos, "channel_benchmarks": analysis.Benchmarks,
	}
	var pl Plan
	u, err := c.structured(ctx, "campaign_plan", planSystem, "Date (JSON):\n"+mustJSON(payload), planSchema(), 5000, &pl)
	if err != nil {
		return pl, u, err
	}
	if pl.Calendar == nil {
		pl.Calendar = []CalendarWeek{}
	}
	if pl.ABTests == nil {
		pl.ABTests = []ABTestIdea{}
	}
	if pl.KPIs == nil {
		pl.KPIs = []string{}
	}
	return pl, u, nil
}

// ---------- helpers ----------

type competitor struct {
	Title   string  `json:"title"`
	Price   float64 `json:"price"`
	Rating  float64 `json:"rating"`
	Reviews int     `json:"reviews"`
	Seller  string  `json:"seller,omitempty"`
}

func topCompetitors(ps []model.Product, n int) []competitor {
	cp := append([]model.Product(nil), ps...)
	sort.SliceStable(cp, func(i, j int) bool { return cp[i].ReviewCount > cp[j].ReviewCount })
	if len(cp) > n {
		cp = cp[:n]
	}
	out := make([]competitor, 0, len(cp))
	for _, p := range cp {
		out = append(out, competitor{Title: truncate(p.Title, 120), Price: p.Price, Rating: p.Rating, Reviews: p.ReviewCount, Seller: p.Seller})
	}
	return out
}

// selectReviews prefers negative reviews (that's where complaints live) but keeps positive ones too.
func selectReviews(snap model.MarketSnapshot, n int) []map[string]any {
	rs := append([]model.Review(nil), snap.Reviews...)
	sort.SliceStable(rs, func(i, j int) bool { return rs[i].Rating < rs[j].Rating })
	if len(rs) > n {
		rs = rs[:n]
	}
	out := make([]map[string]any, 0, len(rs))
	for _, r := range rs {
		out = append(out, map[string]any{"rating": r.Rating, "text": truncate(r.Text, 400)})
	}
	return out
}

func topAmazon(ps []model.WebProduct, n int) []map[string]any {
	cp := append([]model.WebProduct(nil), ps...)
	sort.SliceStable(cp, func(i, j int) bool { return cp[i].ReviewCount > cp[j].ReviewCount })
	out := []map[string]any{}
	for _, p := range cp[:min(n, len(cp))] {
		out = append(out, map[string]any{"title": truncate(p.Title, 120), "price": p.Price, "currency": p.Currency,
			"rating": p.Rating, "reviews": p.ReviewCount, "sponsored": p.Sponsored})
	}
	return out
}

// selectDiscussions keeps the highest-scored Reddit posts and comments.
func selectDiscussions(ds []model.Discussion, n int) []map[string]any {
	cp := append([]model.Discussion(nil), ds...)
	sort.SliceStable(cp, func(i, j int) bool { return cp[i].Score > cp[j].Score })
	out := []map[string]any{}
	for _, d := range cp[:min(n, len(cp))] {
		m := map[string]any{"kind": d.Kind, "subreddit": d.Subreddit, "score": d.Score, "text": truncate(d.Text, 400)}
		if d.Title != "" {
			m["title"] = truncate(d.Title, 200)
		}
		out = append(out, m)
	}
	return out
}

func relevantLaunches(ls []model.Launch, query string, n int) []map[string]any {
	rel := analysis.RelevantLaunches(ls, query)
	out := []map[string]any{}
	for _, l := range rel[:min(n, len(rel))] {
		out = append(out, map[string]any{"name": l.Name, "tagline": l.Tagline})
	}
	return out
}
