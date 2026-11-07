package amazon

import (
	"errors"
	"strings"
	"testing"
)

// Fixture written from Amazon's standard search card markup (two cards, one sponsored, one without price).
const fixture = `<html><body>
<div data-component-type="s-search-result" data-asin="B0AAA11111">
  <span class="puis-sponsored-label-text">Sponsored</span>
  <img class="s-image" src="https://m.media-amazon.com/images/I/a.jpg">
  <h2 aria-label="Laptop Stand Aluminium"><span>Laptop Stand Aluminium, Adjustable</span></h2>
  <span class="a-icon-alt">4,5 von 5 Sternen</span>
  <a href="/dp/B0AAA11111#customerReviews"><span>(1.234)</span></a>
  <span class="a-price"><span class="a-offscreen">29,99 €</span></span>
  <span class="a-price a-text-price"><span class="a-offscreen">39,99 €</span></span>
</div>
<div data-component-type="s-search-result" data-asin="B0BBB22222">
  <h2><a><span>Foldable Laptop Riser</span></a></h2>
  <span class="a-icon-alt">4.2 out of 5 stars</span>
  <a href="/dp/B0BBB22222#customerReviews" aria-label="2.1K ratings"><span></span></a>
</div>
<div data-component-type="s-search-result" data-asin=""><h2>ad slot</h2></div>
` + "</body></html>"

func TestParse(t *testing.T) {
	ps, err := Parse(fixture+strings.Repeat(" ", 20000), "https://www.amazon.de")
	if err != nil {
		t.Fatal(err)
	}
	if len(ps) != 2 {
		t.Fatalf("want 2 products, got %+v", ps)
	}
	a, b := ps[0], ps[1]
	if a.ID != "B0AAA11111" || a.Title != "Laptop Stand Aluminium, Adjustable" || a.Price != 29.99 || a.Currency != "EUR" ||
		a.Rating != 4.5 || a.ReviewCount != 1234 || !a.Sponsored || a.URL != "https://www.amazon.de/dp/B0AAA11111" || a.Position != 1 {
		t.Fatalf("first product wrong: %+v", a)
	}
	if b.Price != 0 || b.Rating != 4.2 || b.ReviewCount != 2100 || b.Sponsored || b.Position != 2 {
		t.Fatalf("second product wrong: %+v", b)
	}
}

func TestCurrencyFromText(t *testing.T) {
	for in, want := range map[string]string{"RON 125.85": "RON", "29,99 €": "EUR", "$45.00": "USD", "12 lei": "RON", "£3": "GBP", "7": ""} {
		if got := currencyFromText(in); got != want {
			t.Errorf("currencyFromText(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestParseBlocked(t *testing.T) {
	if _, err := Parse(`<html><script src="/akam/13/abc"></script></html>`, "https://www.amazon.de"); !errors.Is(err, ErrBlocked) {
		t.Fatalf("want ErrBlocked, got %v", err)
	}
}

func TestParsePrice(t *testing.T) {
	for in, want := range map[string]float64{"1.299,99 €": 1299.99, "€1,299.99": 1299.99, "$45.00": 45, "12 €": 12, "1.299 €": 1299, "": 0} {
		if got := ParsePrice(in); got != want {
			t.Errorf("ParsePrice(%q) = %v, want %v", in, got, want)
		}
	}
}
