package ai

import "testing"

func TestNormalizeVideoConcepts(t *testing.T) {
	vs := []VideoConcept{{ID: "v1", Shots: []Shot{{DurationS: 4, Caption: " a "}, {DurationS: 15}, {DurationS: 9}}}, {ID: "v2", Shots: []Shot{{DurationS: 9}}}}
	normalizeVideoConcepts(vs)
	if len(vs[0].Shots) != 2 || len(vs[1].Shots) != 1 {
		t.Fatalf("shots not capped: %d, %d", len(vs[0].Shots), len(vs[1].Shots))
	}
	if vs[0].Shots[0].DurationS != 8 || vs[0].Shots[1].DurationS != 10 || vs[1].Shots[0].DurationS != 9 {
		t.Fatalf("durations not clamped: %+v %+v", vs[0].Shots, vs[1].Shots)
	}
	if vs[0].Shots[0].Caption != "a" {
		t.Fatalf("caption not trimmed: %q", vs[0].Shots[0].Caption)
	}
}
