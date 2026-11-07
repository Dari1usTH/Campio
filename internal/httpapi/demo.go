package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// DemoCase is a preset prompt for the live demo. The products have seed data,
// so market data works even without network access.
type DemoCase struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Prompt      string `json:"prompt"`
}

var demoCases = []DemoCase{
	{
		ID:          "suport-laptop",
		Title:       "Suport laptop din aluminiu",
		Description: "Prompt complet (preț și buget incluse): kitul se generează fără întrebări. Clienții concurenței se plâng de instabilitate și plastic fragil.",
		Prompt:      "Vreau să lansez pe eMAG un suport de laptop pliabil din aluminiu, marca Ergodesk. Merge pentru laptopuri de 10-17 inch, are 6 trepte de înălțime, bază lată cu silicon antiderapant, cântărește 280 g și vine cu husă de transport. Îl vând cu 79 de lei și am 2000 de lei pentru reclame în prima lună.",
	},
	{
		ID:          "husa-iphone-16",
		Title:       "Husă iPhone 16 din silicon",
		Description: "Prompt scurt, fără preț și buget: AI-ul pune întrebări, cu variante de preț calculate din piață.",
		Prompt:      "Am niște huse de silicon pentru iPhone 16, tratate să nu se îngălbenească, compatibile MagSafe, cu margini ridicate la cameră și interior din microfibră. Le am în 5 culori. Cum le vând pe eMAG?",
	},
}

func (s *Server) demoCases(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"items": demoCases})
}
