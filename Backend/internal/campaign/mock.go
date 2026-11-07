package campaign

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/tibi/hackathon/backend/internal/ai"
	"time"
)

// DemoKit is explicitly canned content for offline demonstrations, never a claim of live research.
func DemoKit(in Input) Kit {
	if in.Language != "ro" {
		in.Language = "en"
	}
	ro := in.Language == "ro"
	tr := func(en, roText string) string {
		if ro {
			return roText
		}
		return en
	}
	if in.ProductName == "" {
		in.ProductName = tr("Soy candle", "Lumânare din soia")
	}
	if in.SalePrice <= 0 {
		in.SalePrice = 89
	}
	if in.AdBudgetRON <= 0 {
		in.AdBudgetRON = 800
	}
	name := in.ProductName
	p1 := ai.Persona{ID: "p1", Name: tr("Mindful home lovers", "Iubitori ai casei"), AgeRange: "25–40", Occupation: tr("Creative professionals", "Profesioniști creativi"), Description: tr("People creating a calm space after a busy day.", "Oameni care își creează un spațiu calm după o zi aglomerată."), Motivations: []string{tr("A small daily ritual", "Un mic ritual zilnic"), tr("Thoughtful design", "Design atent")}, PainPoints: []string{tr("Unclear ingredients", "Ingrediente neclare")}, Channels: []string{"instagram", "pinterest"}, BuyingTriggers: []string{tr("Clear product details", "Detalii clare despre produs")}, Objections: []string{tr("Check the ingredients before ordering", "Verifică ingredientele înainte de comandă")}, MessageHook: tr("Make room for a quieter evening.", "Fă loc unei seri mai liniștite.")}
	p2 := ai.Persona{ID: "p2", Name: tr("Thoughtful gift buyers", "Cumpărători de cadouri"), AgeRange: "28–50", Occupation: tr("Busy gift shoppers", "Cumpărători ocupați"), Description: tr("Buyers looking for a personal gift with an easy ordering experience.", "Cumpărători care caută un cadou personal și o comandă simplă."), Motivations: []string{tr("Give something personal", "Un cadou personal")}, PainPoints: []string{tr("Uncertain delivery dates", "Termene de livrare neclare")}, Channels: []string{"facebook", "instagram"}, BuyingTriggers: []string{tr("Delivery information and packaging photos", "Livrare clară și poze cu ambalajul")}, Objections: []string{tr("Will it arrive on time?", "Ajunge la timp?")}, MessageHook: tr("A small gesture, chosen with care.", "Un gest mic, ales cu grijă.")}
	headline := tr("Your evening deserves a little calm", "Seara ta merită puțină liniște")
	text := tr("Meet "+name+". A thoughtful addition to your everyday ritual. See the materials, delivery details and full product story before you order.", "Descoperă "+name+". Un detaliu ales cu grijă pentru ritualul tău zilnic. Vezi materialele, livrarea și povestea produsului înainte de comandă.")
	strategy := ai.Strategy{Summary: tr("Demo strategy: focus on the product experience and transparent buying details. These are simulated audiences, not customer research.", "Strategie demo: pune accent pe experiența produsului și pe detaliile clare ale comenzii. Publicul este simulat, nu cercetare reală."), Complaints: []ai.Complaint{}, Personas: []ai.Persona{p1, p2}, Positioning: ai.Positioning{Statement: tr(name+" brings thoughtful design to a simple daily ritual.", name+" aduce design atent într-un ritual simplu de zi cu zi."), MainMessage: headline, Tone: tr("Warm and clear", "Cald și clar"), ProofPoints: []string{tr("Verify materials and delivery before publishing", "Verifică materialele și livrarea înainte de publicare")}, Messages: []ai.PositioningMessage{}}}
	content := ai.Content{Listing: ai.Listing{Titles: []string{name + " · " + headline, name + " · " + tr("A thoughtful gift", "Un cadou ales cu grijă"), name}, Description: text, Bullets: []string{tr("See the exact product specifications", "Vezi specificațiile exacte ale produsului"), tr("Check delivery availability", "Verifică disponibilitatea livrării")}, SearchKeywords: []string{name}}, Ads: []ai.Ad{{ID: "ad1", PersonaID: "p1", Channel: "meta", Angle: tr("Everyday ritual", "Ritual zilnic"), Headline: headline, PrimaryText: text, CTA: tr("Discover more", "Descoperă")}, {ID: "ad2", PersonaID: "p2", Channel: "meta", Angle: tr("Thoughtful gift", "Cadou personal"), Headline: tr("A small gesture, chosen with care", "Un gest mic, ales cu grijă"), PrimaryText: text, CTA: tr("View the product", "Vezi produsul")}, {ID: "ad3", PersonaID: "p1", Channel: "tiktok", Angle: tr("Behind the product", "Povestea produsului"), Headline: tr("Small details. Your own moment.", "Detalii mici. Momentul tău."), PrimaryText: text, CTA: tr("Find your favourite", "Alege preferatul")}}, SocialPosts: []ai.SocialPost{{Channel: "instagram", Format: "post", Text: text, Hashtags: []string{"#Campio", "#MadeWithCare"}}, {Channel: "tiktok", Format: "reel", Text: headline, Hashtags: []string{"#SmallBusiness"}}}, ImageIdeas: []ai.ImageIdea{{Title: tr("Warm product detail", "Detaliu cald de produs"), Description: tr("Show the real product in natural light.", "Arată produsul real în lumină naturală."), GenerationPrompt: "Product detail in warm natural window light, cream background, no text"}}, VideoConcepts: []ai.VideoConcept{{ID: "v1", Title: tr("Your evening ritual", "Ritualul tău de seară"), PersonaID: "p1", Hook: headline, Shots: []ai.Shot{{Description: tr("Show the product in a quiet setting", "Arată produsul într-un cadru liniștit"), VideoPrompt: "Slow close-up of product in warm evening light, no text", DurationS: 8, Caption: headline}, {Description: tr("Close-up of the product details", "Detaliu cu materialele produsului"), VideoPrompt: "Macro product material detail, slow camera movement, no text", DurationS: 8, Caption: tr("Chosen with care", "Ales cu grijă")}}, EndCardLines: []string{fmt.Sprintf("%.0f RON", in.SalePrice), name, tr("Discover more", "Descoperă")}, MusicMood: tr("Calm acoustic", "Acustic calm")}}, PosterConcepts: []ai.PosterConcept{{ID: "poster1", Title: tr("Evening ritual poster", "Afiș ritual de seară"), PersonaID: "p1", ImagePrompt: "The product on a light oak table in warm evening window light, soft shadows, cream background, generous empty space at the top for text", Headline: headline, Subline: tr("Chosen with care, made to last", "Ales cu grijă, făcut să dureze"), CTA: tr("Order now", "Comandă acum")}, {ID: "poster2", Title: tr("Gift poster", "Afiș cadou"), PersonaID: "p2", ImagePrompt: "The product next to a small wrapped gift box and a sprig of eucalyptus, top-down flat lay on linen, soft daylight, empty space at the bottom for text", Headline: tr("A small gesture", "Un gest mic"), Subline: tr("The gift that feels personal", "Cadoul care se simte personal"), CTA: tr("Pick yours", "Alege-l")}}}
	plan := ai.Plan{Channels: []ai.ChannelChoice{{Channel: "meta", SharePct: 70, Rationale: tr("Reach both audiences with visual storytelling.", "Ajunge la ambele segmente prin povești vizuale."), Formats: []string{"reel", "carousel"}}, {Channel: "tiktok", SharePct: 30, Rationale: tr("Test short demonstrations before scaling.", "Testează demonstrații scurte înainte să crești bugetul."), Formats: []string{"reel"}}}, KPIs: []string{tr("Track orders, click-through rate and cost per order. Forecasts use assumed benchmarks.", "Urmărește comenzile, rata de click și costul pe comandă. Estimările folosesc benchmark-uri presupuse.")}, ABTests: []ai.ABTestIdea{{ID: "ab1", Name: tr("Ritual or gift?", "Ritual sau cadou?"), Hypothesis: tr("Compare the ritual and gift messages with equal spend.", "Compară mesajele de ritual și cadou cu bugete egale."), Channel: "meta", Metric: "ctr", VariantA: headline, VariantB: content.Ads[1].Headline, DecisionRule: tr("Keep the clearer message after sufficient traffic.", "Păstrează mesajul mai clar după trafic suficient.")}}}
	for week := 1; week <= 4; week++ {
		plan.Calendar = append(plan.Calendar, ai.CalendarWeek{Week: week, Theme: tr("Test, learn and improve", "Testează, învață și îmbunătățește"), Goal: tr("Publish and measure a focused experiment.", "Publică și măsoară un experiment clar."), Actions: []ai.CalendarAction{{Day: tr("Monday", "Luni"), Channel: "meta", Action: tr("Publish one ad and record its results.", "Publică o reclamă și notează rezultatele."), ContentRefs: []string{"ad1"}}}})
	}
	built := BuildPlan(in, plan)
	return Kit{Input: in, Strategy: &strategy, Content: &content, Plan: &built, AIModel: "MOCK_AI (canned demo)", Status: StatusCompleted, Step: StepDone, Intake: IntakeBlock{Questions: []Question{}, Answers: []Answer{}, Assumptions: []string{tr("Offline demo: audiences and copy are canned examples; forecast numbers use assumed benchmarks.", "Demo offline: publicul și textele sunt exemple predefinite; estimările folosesc benchmark-uri presupuse.")}}}
}
func (s *Service) runMock(k Kit) {
	ctx := context.Background()
	demo := DemoKit(k.Input)
	for _, step := range pipeline {
		time.Sleep(120 * time.Millisecond)
		k.Step = step
		k.setStep(step, StatusCompleted, 120*time.Millisecond)
		switch step {
		case StepStrategy:
			k.Strategy = demo.Strategy
		case StepContent:
			k.Content = demo.Content
		case StepPlan:
			k.Plan = demo.Plan
		}
		k.Input = demo.Input
		k.Intake = demo.Intake
		k.AIModel = demo.AIModel
		if step == StepPlan {
			k.Status = StatusCompleted
			k.Step = StepDone
		}
		b, _ := json.Marshal(k)
		_ = s.Store.UpdateCampaignProgress(ctx, k.ID, k.Status, k.Step, "", b, 0, 0)
	}
	_ = s.Store.SetCampaignProduct(ctx, k.ID, k.Input.ProductName)
}
