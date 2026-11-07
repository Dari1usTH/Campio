package campaign

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/tibi/hackathon/backend/internal/ai"
	"github.com/tibi/hackathon/backend/internal/analysis"
	"github.com/tibi/hackathon/backend/internal/market"
)

const (
	maxPromptChars  = 4000
	maxAnswerChars  = 1000
	MaxImages       = 5
	MaxImageBytes   = 8 << 20
	maxIntakeRounds = 3
)

// ErrNotWaiting is returned when answers are posted to a campaign that asked nothing.
var ErrNotWaiting = fmt.Errorf("%w: the campaign is not waiting for answers", ErrInvalid)

// ImageFile is an image attached to the seller's prompt.
type ImageFile struct {
	Name string
	Mime string
	R    io.Reader
}

// AnswerInput answers one pending question.
type AnswerInput struct {
	QuestionID string `json:"question_id"`
	Value      string `json:"value"`
	Skip       bool   `json:"skip"`
}

// AnswerRequest answers the pending questions; Message adds free-form context.
type AnswerRequest struct {
	Answers []AnswerInput `json:"answers"`
	Message string        `json:"message"`
}

func validatePrompt(prompt string, images []ImageFile) error {
	var errs []string
	if prompt == "" && len(images) == 0 {
		errs = append(errs, "prompt is required (describe the product; images are optional)")
	}
	if len([]rune(prompt)) > maxPromptChars {
		errs = append(errs, fmt.Sprintf("prompt too long (max %d chars)", maxPromptChars))
	}
	if len(images) > MaxImages {
		errs = append(errs, fmt.Sprintf("at most %d images", MaxImages))
	}
	for _, im := range images {
		if !strings.HasPrefix(im.Mime, "image/") {
			errs = append(errs, fmt.Sprintf("%s is not an image", im.Name))
		}
	}
	if len(errs) > 0 {
		return invalid("%s", strings.Join(errs, "; "))
	}
	return nil
}

// imageURLs loads the prompt images as data URLs for the vision model.
func (s *Service) imageURLs(ctx context.Context, ids []uuid.UUID) []string {
	out := []string{}
	for _, id := range ids {
		a, err := s.Store.GetAsset(ctx, id)
		if err != nil {
			continue // deleted meanwhile
		}
		b, err := os.ReadFile(s.Media.Path(a.FilePath))
		if err != nil || len(b) > MaxImageBytes {
			slog.Warn("intake image skipped", "asset", id, "err", err)
			continue
		}
		out = append(out, "data:"+a.Mime+";base64,"+base64.StdEncoding.EncodeToString(b))
	}
	return out
}

// intakeHistory turns the answers into Q/A pairs for the AI.
func intakeHistory(answers []Answer) []ai.IntakeQA {
	out := []ai.IntakeQA{}
	for _, a := range answers {
		v := a.Value
		if a.Skipped {
			v = "(a sărit peste întrebare)"
		}
		out = append(out, ai.IntakeQA{Question: a.Question, Answer: v})
	}
	return out
}

// lastAnswer returns the most recent answer for a field.
func lastAnswer(answers []Answer, field string) (Answer, bool) {
	for i := len(answers) - 1; i >= 0; i-- {
		if answers[i].Field == field {
			return answers[i], true
		}
	}
	return Answer{}, false
}

// answeredAmount returns the amount the seller typed for a numeric field, if parseable.
func answeredAmount(answers []Answer, field string) (float64, bool) {
	a, ok := lastAnswer(answers, field)
	if !ok || a.Skipped {
		return 0, false
	}
	return analysis.ParseAmount(a.Value)
}

func answeredText(answers []Answer, field string) string {
	a, ok := lastAnswer(answers, field)
	if !ok || a.Skipped {
		return ""
	}
	return strings.TrimSpace(a.Value)
}

func skipped(answers []Answer, field string) bool {
	a, ok := lastAnswer(answers, field)
	return ok && a.Skipped
}

// applyIntake merges the AI's reading into the input. The seller's own answers
// win over the AI for names and amounts; amounts are parsed by code.
func applyIntake(k *Kit, r ai.IntakeResult) {
	in, ans := &k.Input, k.Intake.Answers
	in.ProductName = firstNonEmpty(answeredText(ans, ai.FieldProductName), r.ProductName, in.ProductName)
	in.Keyword = firstNonEmpty(answeredText(ans, ai.FieldKeyword), r.Keyword, in.Keyword, in.ProductName)
	in.BrandName = firstNonEmpty(answeredText(ans, ai.FieldBrand), r.BrandName, in.BrandName)
	in.KeywordEN = firstNonEmpty(r.KeywordEN, in.KeywordEN)
	if subs := market.CleanSubreddits(r.Subreddits); len(subs) > 0 {
		in.Subreddits = subs
	}
	in.ProductDescription = firstNonEmpty(r.ProductDescription, in.ProductDescription)
	if v, ok := answeredAmount(ans, ai.FieldSalePrice); ok && v > 0 {
		in.SalePrice = v
	} else if r.SalePrice > 0 {
		in.SalePrice = analysis.Round2(r.SalePrice)
	}
	if v, ok := answeredAmount(ans, ai.FieldAdBudget); ok {
		in.AdBudgetRON = v
	} else if r.AdBudgetRON > 0 {
		in.AdBudgetRON = analysis.Round2(r.AdBudgetRON)
	}
}

// budgetKnown is true when a budget was given (an explicit 0 counts).
func budgetKnown(k *Kit) bool {
	if k.Input.AdBudgetRON > 0 {
		return true
	}
	_, ok := answeredAmount(k.Intake.Answers, ai.FieldAdBudget)
	return ok
}

func fieldKnown(k *Kit, field string) bool {
	switch field {
	case ai.FieldProductName:
		return k.Input.ProductName != ""
	case ai.FieldKeyword:
		return k.Input.Keyword != ""
	case ai.FieldSalePrice:
		return k.Input.SalePrice > 0
	case ai.FieldAdBudget:
		return budgetKnown(k)
	}
	return false
}

var essentialFields = []string{ai.FieldProductName, ai.FieldKeyword, ai.FieldSalePrice, ai.FieldAdBudget}

var defaultQuestionText = map[string]string{
	ai.FieldProductName: "Ce produs vrei să vinzi? Descrie-l pe scurt.",
	ai.FieldKeyword:     "Ce ar scrie un client în căutarea eMAG ca să găsească produsul tău?",
	ai.FieldSalePrice:   "La ce preț (lei, cu TVA) vrei să vinzi produsul?",
	ai.FieldAdBudget:    "Cât vrei să cheltui pe reclame plătite în primele 4 săptămâni (lei)?",
}

// buildQuestions decides what to ask. Essential fields (product, keyword, price,
// budget) are asked until known or skipped; the AI's optional questions
// (details, positioning) are only asked in the first round, so the seller is
// not nagged. ms may be nil before market data is available.
func buildQuestions(k *Kit, aiQs []ai.IntakeQuestion, ms *analysis.MarketStats) []Question {
	ans := k.Intake.Answers
	byField := map[string]string{}
	var optional []ai.IntakeQuestion
	for _, q := range aiQs {
		q.Text = strings.TrimSpace(q.Text)
		if q.Text == "" {
			continue
		}
		switch q.Field {
		case ai.FieldProductName, ai.FieldKeyword, ai.FieldSalePrice, ai.FieldAdBudget:
			if _, dup := byField[q.Field]; !dup {
				byField[q.Field] = q.Text
			}
		default:
			if _, ok := lastAnswer(ans, q.Field); ok && q.Field != ai.FieldOther {
				continue
			}
			optional = append(optional, q)
		}
	}

	var out []Question
	add := func(field, text string) {
		q := Question{ID: fmt.Sprintf("q%d_%d", k.Intake.Round+1, len(out)+1), Field: field, Text: text, Kind: "text", Options: []QuestionOption{}}
		switch field {
		case ai.FieldProductName, ai.FieldKeyword:
			q.Required = true
		case ai.FieldSalePrice:
			q.Kind, q.Unit = "number", "lei"
			if ms != nil && ms.PriceMedian > 0 {
				q.Hint = fmt.Sprintf("Pe eMAG, prețul median al produselor similare este %s lei (jumătate din oferte între %s și %s lei). Dacă sari peste, folosim prețul median.",
					money(ms.PriceMedian), money(ms.PriceP25), money(ms.PriceP75))
				for _, v := range analysis.PriceOptions(*ms) {
					label := money(v) + " lei"
					if v == math.Round(ms.PriceMedian) {
						label += " (median eMAG)"
					}
					q.Options = append(q.Options, QuestionOption{Label: label, Value: money(v)})
				}
			} else {
				q.Hint = "Dacă sari peste, folosim prețul median de pe eMAG."
			}
		case ai.FieldAdBudget:
			q.Kind, q.Unit = "number", "lei"
			q.Hint = fmt.Sprintf("Bugetul total pentru reclame pe 4 săptămâni. Dacă sari peste, planificăm cu %s lei.", money(analysis.DefaultAdBudgetRON))
			for _, v := range analysis.BudgetOptionsRON {
				q.Options = append(q.Options, QuestionOption{Label: money(v) + " lei", Value: money(v)})
			}
		}
		out = append(out, q)
	}
	for _, f := range essentialFields {
		if fieldKnown(k, f) || skipped(ans, f) {
			continue
		}
		add(f, firstNonEmpty(byField[f], defaultQuestionText[f]))
	}
	if k.Intake.Round == 0 {
		for _, q := range optional {
			if len(out) >= 5 {
				break
			}
			add(q.Field, q.Text)
		}
	}
	return out
}

// applyDefaults fills skipped price/budget with code-computed defaults and
// records the assumption. Called once market data is known.
func applyDefaults(k *Kit, ms analysis.MarketStats, force bool) {
	ans := k.Intake.Answers
	if k.Input.SalePrice <= 0 && (force || skipped(ans, ai.FieldSalePrice)) && ms.PriceMedian > 0 {
		k.Input.SalePrice = analysis.Round2(ms.PriceMedian)
		k.Intake.Assumptions = append(k.Intake.Assumptions,
			fmt.Sprintf("Preț: am folosit prețul median de pe eMAG, %s lei. Spune-ne prețul real pentru estimări exacte.", money(ms.PriceMedian)))
	}
	if !budgetKnown(k) && (force || skipped(ans, ai.FieldAdBudget)) {
		k.Input.AdBudgetRON = analysis.DefaultAdBudgetRON
		k.Intake.Assumptions = append(k.Intake.Assumptions,
			fmt.Sprintf("Buget: am planificat cu %s lei pe 4 săptămâni. Poți simula alt buget oricând.", money(analysis.DefaultAdBudgetRON)))
	}
}

// Answer records the seller's answers and resumes the pipeline.
func (s *Service) Answer(ctx context.Context, id uuid.UUID, req AnswerRequest) (Kit, error) {
	if !s.AI.Enabled() {
		return Kit{}, ai.ErrNotConfigured
	}
	k, _, err := s.Get(ctx, id)
	if err != nil {
		return Kit{}, err
	}
	if k.Status != StatusNeedsInput {
		return Kit{}, ErrNotWaiting
	}
	given := map[string]AnswerInput{}
	for _, a := range req.Answers {
		a.Value = strings.TrimSpace(a.Value)
		if len([]rune(a.Value)) > maxAnswerChars {
			return Kit{}, invalid("answer to %s too long (max %d chars)", a.QuestionID, maxAnswerChars)
		}
		given[a.QuestionID] = a
	}
	pending := map[string]bool{}
	now := time.Now().UTC()
	var errs []string
	for _, q := range k.Intake.Questions {
		pending[q.ID] = true
		a, ok := given[q.ID]
		skip := !ok || a.Skip || a.Value == ""
		if skip && q.Required {
			errs = append(errs, fmt.Sprintf("%s (%s) is required", q.ID, q.Field))
			continue
		}
		ans := Answer{QuestionID: q.ID, Field: q.Field, Question: q.Text, Round: k.Intake.Round, At: now, Skipped: skip}
		if !skip {
			ans.Value = a.Value
		}
		k.Intake.Answers = append(k.Intake.Answers, ans)
	}
	for qid := range given {
		if !pending[qid] {
			errs = append(errs, "unknown question_id "+qid)
		}
	}
	if msg := strings.TrimSpace(req.Message); msg != "" {
		if len([]rune(msg)) > maxPromptChars {
			errs = append(errs, fmt.Sprintf("message too long (max %d chars)", maxPromptChars))
		}
		k.Intake.Answers = append(k.Intake.Answers, Answer{Field: ai.FieldOther, Question: "Informații suplimentare de la vânzător", Value: msg, Round: k.Intake.Round, At: now})
	}
	if len(errs) > 0 {
		return Kit{}, invalid("%s", strings.Join(errs, "; "))
	}
	k.Intake.Questions = []Question{}
	k.Status, k.Step, k.Error = StatusRunning, StepIntake, ""
	k.setStep(StepIntake, StatusRunning, 0)
	b, _ := json.Marshal(k)
	ok, err := s.Store.ResumeCampaign(ctx, id, b)
	if err != nil {
		return Kit{}, err
	}
	if !ok {
		return Kit{}, ErrNotWaiting // answered concurrently
	}
	s.start(k)
	return k, nil
}

// saveImages stores the prompt images as product_image uploads.
func (s *Service) saveImages(ctx context.Context, id uuid.UUID, images []ImageFile) ([]uuid.UUID, error) {
	ids := make([]uuid.UUID, len(images))
	// Saved last-to-first: the most recent product_image is used as the video first frame,
	// so the first image the seller attached wins.
	for i := len(images) - 1; i >= 0; i-- {
		a, err := s.SaveUpload(ctx, id, RoleProductImage, images[i].Name, images[i].Mime, io.LimitReader(images[i].R, MaxImageBytes+1))
		if err != nil {
			return nil, err
		}
		if a.SizeBytes > MaxImageBytes {
			return nil, invalid("%s is larger than %d MB", images[i].Name, MaxImageBytes>>20)
		}
		ids[i] = a.ID
	}
	return ids, nil
}

// normalize makes sure JSON arrays are never null (also for kits stored before intake existed).
func (k *Kit) normalize() {
	if k.Input.ImageAssetIDs == nil {
		k.Input.ImageAssetIDs = []uuid.UUID{}
	}
	if k.Input.Subreddits == nil {
		k.Input.Subreddits = []string{}
	}
	if k.Intake.Questions == nil {
		k.Intake.Questions = []Question{}
	}
	if k.Intake.Answers == nil {
		k.Intake.Answers = []Answer{}
	}
	if k.Intake.Assumptions == nil {
		k.Intake.Assumptions = []string{}
	}
}

// money formats lei without useless decimals: 79, 79.9, 1000.
func money(v float64) string {
	return strings.TrimSuffix(strings.TrimRight(fmt.Sprintf("%.2f", v), "0"), ".")
}
