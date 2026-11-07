package ai

import "testing"

func TestParseVideoPricing(t *testing.T) {
	per, img := parseVideoPricing(map[string]string{
		"cents_per_image_input": "1", "cents_per_video_output_second_480p": "2", "cents_per_video_output_second_720p": "3",
	})
	if per["480p"] != 0.02 || per["720p"] != 0.03 || img != 0.01 {
		t.Fatalf("grok: %v %v", per, img)
	}
	per, _ = parseVideoPricing(map[string]string{
		"duration_seconds_with_audio": "0.08", "duration_seconds_without_audio": "0.05",
		"duration_seconds_with_audio_720p": "0.05", "duration_seconds_without_audio_720p": "0.03",
	})
	if per["default"] != 0.05 || per["720p"] != 0.03 {
		t.Fatalf("veo lite: %v", per)
	}
	per, _ = parseVideoPricing(map[string]string{"video_tokens": "0.0000035"})
	if len(per) != 0 {
		t.Fatalf("token pricing should be ignored: %v", per)
	}
	m := VideoModel{PricePerSecondUSD: map[string]float64{"480p": 0.02}, ImageInputUSD: 0.01, SupportedDurations: []int{1, 5, 10}}
	if c, ok := m.EstimateUSD(5, "480p", true); !ok || c < 0.1099 || c > 0.1101 {
		t.Fatalf("estimate %v %v", c, ok)
	}
	if m.ClosestDuration(4) != 5 || m.ClosestDuration(8) != 10 {
		t.Fatal("closest duration")
	}
}
