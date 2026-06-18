export interface BlockedEvent {
  id: string;             // Unikalne losowe ID zdarzenia (np. UUID)
  timestamp: string;      // Znacznik czasu ISO (np. 2026-06-07T16:42:00Z)
  domain: string;         // Domena główna, na której wykryto slop (np. linkedin.com)
  score: number;          // Wynik heurystyczny (0-100)
  matchedRules: string[]; // Lista dopasowanych reguł/fraz (np. ["[UNICODE]", "game changer"])
  textLength: number;     // Długość tekstu w znakach
  emojiCount: number;     // Liczba emoji w tekście
  emojiDensity: number;   // Gęstość emoji (%)
  isOverridden: boolean;  // Czy użytkownik kliknął "Pokaż treść" (fałszywe trafienie)
}
