package analysis

import (
	"math"
	"regexp"
	"strconv"
	"strings"
)

// DefaultAdBudgetRON is used when the seller skips the budget question.
const DefaultAdBudgetRON = 1000

// BudgetOptionsRON are the quick answers offered for the budget question.
var BudgetOptionsRON = []float64{500, 1000, 2000, 5000}

// PriceOptions returns quick answers for the price question: market P25, median
// and P75, rounded to whole lei, without duplicates.
func PriceOptions(m MarketStats) []float64 {
	out := []float64{}
	seen := map[float64]bool{}
	for _, v := range []float64{m.PriceP25, m.PriceMedian, m.PriceP75} {
		r := math.Round(v)
		if r > 0 && !seen[r] {
			seen[r] = true
			out = append(out, r)
		}
	}
	return out
}

var amountRe = regexp.MustCompile(`\d[\d\s.,]*`)

// ParseAmount extracts the first amount from free text written by a seller:
// "79", "79,90 lei", "1.500", "1 500 lei", "2k", "3 mii", "în jur de 80".
// It returns ok=false when the text has no number.
func ParseAmount(s string) (float64, bool) {
	s = strings.ToLower(strings.TrimSpace(s))
	loc := amountRe.FindStringIndex(s)
	if loc == nil {
		return 0, false
	}
	num := strings.TrimRight(s[loc[0]:loc[1]], " .,")
	rest := strings.TrimSpace(s[loc[0]+len(num):])
	num = strings.Join(strings.Fields(num), "")

	lastDot, lastComma := strings.LastIndex(num, "."), strings.LastIndex(num, ",")
	switch {
	case lastDot >= 0 && lastComma >= 0: // both: the last one is the decimal separator
		dec := max(lastDot, lastComma)
		num = strings.NewReplacer(".", "", ",", "").Replace(num[:dec]) + "." + num[dec+1:]
	case lastDot >= 0 || lastComma >= 0:
		sep := "."
		if lastComma >= 0 {
			sep = ","
		}
		groups := strings.Split(num, sep)
		thousands := len(groups) > 2 || len(groups[len(groups)-1]) == 3
		if thousands {
			num = strings.Join(groups, "")
		} else {
			num = strings.Join(groups, ".")
		}
	}
	v, err := strconv.ParseFloat(num, 64)
	if err != nil {
		return 0, false
	}
	if strings.HasPrefix(rest, "k") || strings.HasPrefix(rest, "mii") || strings.HasPrefix(rest, "mie") {
		v *= 1000
	}
	return Round2(v), true
}
