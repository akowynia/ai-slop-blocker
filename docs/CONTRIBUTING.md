# Instrukcja dla Testerów i Kontrybutorów

Dziękujemy za chęć pomocy w testowaniu i rozwijaniu wtyczki **AI Slop Blocker**! Twój wkład w wyłapywanie błędów (zarówno fałszywych blokad, jak i pomijanych treści AI) bezpośrednio przekłada się na skuteczność narzędzia.

Poniższy przewodnik wyjaśnia, jak skutecznie diagnozować działanie wtyczki i zgłaszać napotkane problemy.

---

## 1. Instalacja Wersji Deweloperskiej

Aby testować najnowsze zmiany bezpośrednio z kodu źródłowego:
1. Pobierz lub sklonuj repozytorium na swój dysk.
2. Zbuduj wtyczkę lokalnie (jeśli wymaga kompilacji, np. uruchamiając `npm run build` lub korzystając z wersji spakowanej w katalogu `dist`).
3. Otwórz przeglądarkę Google Chrome i przejdź pod adres `chrome://extensions/`.
4. Włącz **Tryb dewelopera** (Developer mode) w prawym górnym rogu ekranu.
5. Kliknij przycisk **Załaduj rozpakowane** (Load unpacked) i wskaż folder `dist` (lub główny folder wtyczki, zależnie od konfiguracji).

---

## 2. Tryb Diagnostyczny (Debug Mode)

Tryb debugowania aktywuje dodatkowe logowanie diagnostyczne w konsoli deweloperskiej przeglądarki oraz pozwala na precyzyjne śledzenie procesu analizy każdego elementu tekstowego.

### Jak włączyć tryb debugowania?

Istnieją dwie metody aktywacji trybu debug:

#### Metoda A: Poprzez Ustawienia Wtyczki (Zalecana)
1. Kliknij ikonę wtyczki na pasku narzędzi.
2. Przejdź do **Opcji** (Options) lub panelu ustawień w popupie.
3. Zaznacz przełącznik **Tryb debugowania** (Debug Mode).

#### Metoda B: Przez Konsolę Deweloperską (Szybki skrót)
1. Otwórz Narzędzia deweloperskie w przeglądarce (klawisz **F12** lub kliknij prawym przyciskiem myszy i wybierz **Zbadaj**).
2. Przejdź do zakładki **Konsola** (Console).
3. Wpisz i zatwierdź następujące polecenie, aby włączyć debugowanie:
   ```javascript
   window.postMessage({ type: 'ASB_TOGGLE_DEBUG', enabled: true }, '*');
   ```
   *(Aby wyłączyć, zmień wartość `enabled` na `false`).*

### Tester Heurystyki (Piaskownica)

Po włączeniu trybu debugowania, w popupie wtyczki pojawi się trzecia zakładka o nazwie **Tester Heurystyki**. Umożliwia ona deweloperom i testerom bezpieczne badanie działania algorytmu bez wpływu na wyświetlane na stronach posty:
* **Wklejanie tekstu**: Pozwala wkleić dowolną treść posta w pole tekstowe i przeanalizować ją przyciskiem "Testuj heurystykę".
* **Wynik i wskaźnik procentowy (Score)**: Wyświetla końcowy rezultat ("🚨 SLOP / BLOKUJ" lub "✅ BEZPIECZNY") oraz wyliczony wynik punktowy.
* **Metryki lingwistyczne**:
  * *Licznik Emoji* – pokazuje liczbę i gęstość procentową emotikonów.
  * *Formatowanie Unicode* – wykrywa, czy autor użył sztucznych krojów znaków (np. bold/italic z generatorów), co dodaje +40 pkt kary.
  * *Name-dropping* – identyfikuje nienaturalne nagromadzenie wielu nazwisk lub tytułów obok siebie (+35 pkt kary).
* **Lista wykrytych fraz**: Wyświetla etykiety ze zidentyfikowanymi słowami kluczowymi ze słownika, które przyczyniły się do podwyższenia wyniku kary.

---

## 3. Co i Gdzie Badać? (Diagnostyka DOM)

Podczas testowania warto badać strukturę dokumentu, aby upewnić się, czy wtyczka prawidłowo przypisuje stany do elementów. Zwróć uwagę na następujące atrybuty HTML:

| Atrybut / Klasa | Opis działania |
| :--- | :--- |
| `data-slop-analyzed="true"` | Oznacza, że dany kontener tekstowy został już przeanalizowany przez wtyczkę. |
| `data-asb-blocked="true"` | Atrybut nadawany elementom, które zostały zidentyfikowane jako slop AI i są aktualnie zablokowane. |
| `data-slop-revealed="true"` | Nadawany elementowi po kliknięciu przycisku "Pokaż treść" – tymczasowo wyłącza blokadę dla tego konkretnego elementu. |
| `.asb-blocked-container` | Klasa CSS nakładana na zablokowany kontener, odpowiedzialna za rozmycie tła lub jego ukrycie. |
| `asb-whitelist-badge` | Własny znacznik HTML (zielona tarcza), który pojawia się na postach autorów znajdujących się na białej liście. |

### Przykład Logów w Konsoli

Po włączeniu trybu debugowania, w konsoli deweloperskiej (F12 -> Console) zaczną pojawiać się szczegółowe informacje z analizatora:

```text
[AI Slop Blocker - Orchestrator] Wykryto zmianę URL: https://example.com -> https://example.com/feed
[AI Slop Blocker - Posts] DIAG clean: <p class="feed-text"> len=240 score=45 text="Z dumą ogłaszamy uruchomienie naszego rewolucyjnego..."
[AI Slop Blocker - Posts] Zablokowano 1 nowych elementów. (score: 45, matching: "z dumą ogłaszamy")
```

---

## 4. Zgłaszanie Błędów przez Google Forms

Jeśli wtyczka zachowa się nieprawidłowo, zgłoś to za pomocą naszego dedykowanego formularza Google Forms.

> [!IMPORTANT]
> **Bezpośrednie linki do zgłoszeń:**  
> * **[Formularz Zgłaszania Błędów Detekcji / Heurystyki (Google Forms)](https://docs.google.com/forms/d/e/1FAIpQLSd5oBcQ3UEzO4GCCo4lynSBKpIT1kMiJPzOzAeluXHByPZFGw/viewform)** (dla pomyłek detekcji typu False Positive / False Negative)
> * **[Formularz Zgłaszania Błędów Technicznych / Bug Report (Google Forms)](https://docs.google.com/forms/d/e/1FAIpQLSfvre6YNYjxYNt5jFiLeRNh5Kv8KywyElaoIkS2bdOkchTRPw/viewform)** (dla błędów w działaniu wtyczki, błędów wizualnych nakładek, popupu)

### Co należy przygotować przed wypełnieniem formularza?

Abyśmy mogli szybko namierzyć przyczynę problemu, przygotuj:
1. **Adres URL strony**, na której wystąpił błąd (np. `https://socialportal.example.com/feed/`).
2. **Dokładny tekst elementu**, który wywołał błąd. Skopiuj go w całości.
3. **Zrzut ekranu (Screenshot)** przedstawiający problem wizualny.
4. **Logi diagnostyczne** z konsoli (jeśli miałeś włączony tryb debugowania).

### Typy zgłoszeń (Kluczowe pojęcia)

W formularzu zostaniesz poproszony o określenie typu błędu:

* **False Positive (Fałszywe Trafienie)**: Wtyczka zablokowała wartościowy post napisany przez człowieka.
* **False Negative (Niewykryty Slop)**: Na stronie wyświetla się ewidentny tekst wygenerowany przez AI (np. z emotikonami, frazami typu *„W dzisiejszym dynamicznym świecie...”*), a wtyczka go nie zablokowała.
* **Błąd Wizualny (UI Bug)**: Nakładka blokująca rozjechała się na stronie, przycisk „Odsłoń” nie działa lub biała lista nie oznacza poprawnie autorów.

---

## 5. Szablon Zgłoszenia (Przykład)

Oto wzór idealnego zgłoszenia, który pozwala programistom naprawić błąd w kilka minut:

> **URL strony:** `https://socialportal.example.com/feed/`  
> **Typ błędu:** `False Positive`  
> **Skopiowany tekst elementu:**  
> *"Z dumą ogłaszam, że moja córka ukończyła szkołę podstawową z wyróżnieniem! To był dla nas rok ciężkiej pracy, ale było warto."*  
> **Logi z konsoli (tryb debug):**  
> `[AI Slop Blocker - Posts] DIAG clean: <span class="break-words"> len=135 score=15 text="Z dumą ogłaszam..."`  
> **Opis:**  
> *Wtyczka zablokowała osobisty post o sukcesie szkolnym córki, ponieważ zawierał frazę „Z dumą ogłaszam”, która ma wysoką wagę w domyślnych regułach.*

---

## 💡 Masz pomysł na ulepszenie?

Nie musisz być programistą, aby mieć realny wpływ na rozwój wtyczki! Jeśli zauważysz nową kategorię postów generowanych przez AI (np. specyficzny styl pisania ofert pracy, powtarzalne szablony reklamowe) lub masz pomysł na nową funkcjonalność:
* **Otwórz Issue** w naszym repozytorium, opisując swój pomysł.
* **Napisz bezpośrednio w formularzu zgłoszeniowym** (Google Forms) – chętnie analizujemy wszystkie sugestie i wdrażamy nowe kategorie do zdalnej bazy reguł.
