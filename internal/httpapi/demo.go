package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/tibi/hackathon/backend/internal/campaign"
)

// DemoCase is a preset form input for the live demo. Keywords have seed data,
// so market data works even without network access.
type DemoCase struct {
	ID          string         `json:"id"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Input       campaign.Input `json:"input"`
}

var demoCases = []DemoCase{
	{
		ID:          "suport-laptop",
		Title:       "Suport laptop din aluminiu",
		Description: "Piață mare și fragmentată; clienții concurenței se plâng de instabilitate și plastic fragil — material bun pentru poziționare.",
		Input: campaign.Input{
			ProductName:        "Suport laptop reglabil din aluminiu",
			Keyword:            "suport laptop",
			ProductDescription: "Suport pliabil din aluminiu pentru laptopuri 10-17 inch, 6 trepte de înălțime, bază lată cu silicon antiderapant, cântărește 280 g, vine cu husă de transport.",
			SalePrice:          79,
			AdBudgetRON:        2000,
			BrandName:          "Ergodesk",
		},
	},
	{
		ID:          "husa-iphone-16",
		Title:       "Husă iPhone 16 din silicon",
		Description: "Piață aglomerată, dominată de un vânzător; diferențierea prin mesaj contează mai mult decât prețul.",
		Input: campaign.Input{
			ProductName:        "Husă iPhone 16 din silicon anti-îngălbenire",
			Keyword:            "husa iphone 16",
			ProductDescription: "Husă din silicon tratat anti-îngălbenire, compatibilă MagSafe, margini ridicate pentru cameră, interior din microfibră, 5 culori.",
			SalePrice:          49,
			AdBudgetRON:        1000,
			BrandName:          "Casely",
		},
	},
}

func (s *Server) demoCases(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"items": demoCases})
}
