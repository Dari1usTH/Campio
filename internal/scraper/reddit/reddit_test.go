package reddit

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSearch(t *testing.T) {
	var calls []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sub := r.URL.Query().Get("subreddit")
		calls = append(calls, r.URL.Path+" "+sub)
		switch {
		case sub == "huge":
			w.WriteHeader(http.StatusUnprocessableEntity)
			_, _ = w.Write([]byte(`{"data":null,"error":"Timeout. Maybe slow down a bit"}`))
		case sub == "limited":
			w.WriteHeader(http.StatusTooManyRequests)
		case r.URL.Path == "/api/posts/search":
			if r.URL.Query().Get("query") != "laptop stand" {
				t.Errorf("query not passed: %v", r.URL.Query())
			}
			_, _ = w.Write([]byte(`{"data":[
				{"id":"p1","subreddit":"laptops","title":"Stand vs cooler &amp; hub","selftext":"[removed]","score":5,"num_comments":3,"created_utc":1793628204},
				{"id":"p1","subreddit":"laptops","title":"duplicate","created_utc":1793628204}]}`))
		default:
			_, _ = w.Write([]byte(`{"data":[
				{"id":"c1","subreddit":"laptops","body":"My cheap stand wobbles every time I type, would not buy again.","score":2,"created_utc":1794009132.0,"link_id":"t3_p1"},
				{"id":"c2","subreddit":"laptops","body":"+1","score":1,"created_utc":1794009132,"link_id":"t3_p1"}]}`))
		}
	}))
	defer srv.Close()
	c := New()
	c.BaseURL, c.RequestDelay = srv.URL, time.Millisecond

	res, err := c.Search(context.Background(), "laptop stand", []string{"huge", "laptops", "limited", "never"})
	if err != nil {
		t.Fatal(err)
	}
	// huge: 1 call (timeout skips its comments); laptops: 2; limited: 1 then stop.
	if res.Requests != 4 || len(calls) != 4 || !res.RateLimited || len(res.TimedOut) != 1 || res.TimedOut[0] != "huge" {
		t.Fatalf("unexpected flow: %+v calls=%v", res, calls)
	}
	if len(res.Discussions) != 2 {
		t.Fatalf("want post + long comment, got %+v", res.Discussions)
	}
	p, cm := res.Discussions[0], res.Discussions[1]
	if p.Kind != "post" || p.Title != "Stand vs cooler & hub" || p.Text != "" || p.Date != "2026-11-02" || p.URL != "https://www.reddit.com/r/laptops/comments/p1/" {
		t.Fatalf("post wrong: %+v", p)
	}
	if cm.Kind != "comment" || cm.URL != "https://www.reddit.com/r/laptops/comments/p1/_/c1/" || cm.Date != "2026-11-06" {
		t.Fatalf("comment wrong: %+v", cm)
	}
}
