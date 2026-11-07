package ai

import (
	"context"
	"strings"
)

// ---------- Step 0: intake (prompt + images → product brief + questions) ----------

// Intake fields the AI can ask about.
const (
	FieldProductName = "product_name"
	FieldKeyword     = "keyword"
	FieldSalePrice   = "sale_price"
	FieldAdBudget    = "ad_budget_ron"
	FieldDescription = "product_description"
	FieldBrand       = "brand_name"
	FieldOther       = "other"
)

// IntakeFields lists every field a question can target.
var IntakeFields = []string{FieldProductName, FieldKeyword, FieldSalePrice, FieldAdBudget, FieldDescription, FieldBrand, FieldOther}

// IntakeQuestion is a question the AI wants to ask the seller.
type IntakeQuestion struct {
	Field string `json:"field"`
	Text  string `json:"text"`
}

// IntakeQA is one answered (or skipped) question, given back to the AI.
type IntakeQA struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

// IntakeResult is what the AI understood from the seller's prompt, images and answers.
// Unknown values are "" / 0: the AI never estimates price or budget.
type IntakeResult struct {
	ProductName        string           `json:"product_name"`
	Keyword            string           `json:"keyword"`
	ProductDescription string           `json:"product_description"`
	BrandName          string           `json:"brand_name"`
	SalePrice          float64          `json:"sale_price"`
	AdBudgetRON        float64          `json:"ad_budget_ron"`
	Questions          []IntakeQuestion `json:"questions"`
}

const intakeSystem = `Ești asistentul de lansare pentru vânzători mici de pe eMAG.ro. Vânzătorul îți scrie liber ce vrea să vândă și poate atașa poze cu produsul. Din mesaj, poze și răspunsurile anterioare, completezi fișa produsului:
- "product_name": numele scurt și clar al produsului, în română (ex. "Suport laptop reglabil din aluminiu"). "" dacă nu se înțelege ce produs este.
- "keyword": termenul de căutare pe eMAG, 2-3 cuvinte, fără diacritice, așa cum ar căuta un client (ex. "suport laptop"). Dacă produsul se potrivește cu unul din "known_keywords", folosește exact acel termen.
- "product_description": specificațiile și beneficiile spuse de vânzător plus ce se vede clar în poze (material, culoare, formă, accesorii). NU inventa specificații care nu apar în text sau în poze.
- "brand_name": doar dacă e spus sau se vede clar pe produs; altfel "".
- "sale_price": prețul de vânzare în lei cu TVA, DOAR dacă vânzătorul l-a spus; altfel 0. Nu estima niciodată.
- "ad_budget_ron": bugetul total de reclame plătite pentru o campanie de 4 săptămâni, în lei, DOAR dacă l-a spus (dacă e lunar, e același lucru; dacă e săptămânal, înmulțește cu 4); altfel 0. Nu estima niciodată.
- "questions": întrebările de care ai nevoie ca să faci un kit de marketing bun, max 4, scurte, prietenoase, în română, la persoana a II-a. Pune câte o întrebare pentru fiecare informație lipsă importantă: ce produs este (product_name), prețul (sale_price), bugetul de reclame (ad_budget_ron). Poți întreba și despre un detaliu care chiar ar schimba mesajul de marketing (ex. ce îl face diferit de concurență, pentru cine e) cu field "product_description" sau "other". Nu întreba ce ți s-a spus deja sau ce se vede în poze. Dacă ai tot ce îți trebuie, "questions" = [].
Răspunsurile vânzătorului la întrebări au prioritate față de mesajul inițial.`

func intakeSchema() map[string]any {
	return sObj(map[string]any{
		"product_name": sStr(), "keyword": sStr(), "product_description": sStr(), "brand_name": sStr(),
		"sale_price": sNum(), "ad_budget_ron": sNum(),
		"questions": sArr(sObj(map[string]any{"field": sEnum(IntakeFields...), "text": sStr()})),
	})
}

// Intake reads the seller's free-text prompt, product images (https or data URLs)
// and previous answers, and returns the product brief plus questions for missing info.
func (c *Client) Intake(ctx context.Context, prompt string, images []string, history []IntakeQA, knownKeywords []string) (IntakeResult, Usage, error) {
	payload := map[string]any{"seller_message": prompt, "images_attached": len(images), "known_keywords": knownKeywords}
	if len(history) > 0 {
		payload["answers"] = history
	}
	parts := []ContentPart{TextPart("Date (JSON):\n" + mustJSON(payload))}
	for _, img := range images {
		parts = append(parts, ImagePart(img))
	}
	req := Request{
		Messages:    []Message{{Role: "system", Content: intakeSystem}, {Role: "user", Parts: parts}},
		Temperature: 0.2,
		MaxTokens:   3000,
		ResponseFormat: map[string]any{
			"type":        "json_schema",
			"json_schema": map[string]any{"name": "intake", "strict": true, "schema": intakeSchema()},
		},
	}
	var r IntakeResult
	u, err := c.complete(ctx, "intake", req, &r)
	if err != nil {
		return r, u, err
	}
	r.ProductName = strings.TrimSpace(r.ProductName)
	r.Keyword = strings.TrimSpace(r.Keyword)
	r.ProductDescription = strings.TrimSpace(r.ProductDescription)
	r.BrandName = strings.TrimSpace(r.BrandName)
	if r.SalePrice < 0 {
		r.SalePrice = 0
	}
	if r.AdBudgetRON < 0 {
		r.AdBudgetRON = 0
	}
	if r.Questions == nil {
		r.Questions = []IntakeQuestion{}
	}
	return r, u, nil
}
