# Instrukcja dla Programistów - Dodawanie Nowego Modułu

Niniejszy przewodnik opisuje krok po kroku, jak stworzyć, zaimplementować oraz zarejestrować nowy moduł detekcji treści (np. komentarzy, reklam czy specyficznych sekcji) w strukturze wtyczki **AI Slop Blocker**.

---

## Krok 1: Utworzenie pliku modułu

Wszystkie moduły wtyczki znajdują się w katalogu `src/modules/`. 

Utwórz nowy plik TypeScript w tym folderze. Nazwij go zgodnie z przeznaczeniem modułu (używając zapisu camelCase), na przykład:
* `src/modules/commentsDetector.ts`

---

## Krok 2: Implementacja interfejsu `ASBModule`

Twój moduł musi importować i implementować interfejs `ASBModule` zdefiniowany w [src/types/module.ts](../ai-slop-blocker/src/types/module.ts).

Poniżej znajduje się kompletny, szablonowy szkielet nowego modułu z komentarzami objaśniającymi poszczególne metody cyklu życia:

```typescript
import type { ASBModule } from '../types/module';
import type { PluginSettings } from '../utils/settings';
import { getSettings } from '../utils/storage';

// Zmienne przechowujące lokalny stan modułu (jeśli są potrzebne)
let isModuleEnabled = false;
let currentSettings: PluginSettings | null = null;

export const myNewModule: ASBModule = {
  // 1. Unikalny identyfikator modułu (używany m.in. do logowania)
  id: 'my-new-module',

  // 2. Czytelna nazwa modułu wyświetlana w konsoli/opcjach
  name: 'Detektor Nowego Typu Treści',

  // 3. Opcjonalny opis przeznaczenia
  description: 'Analizuje i blokuje specyficzne elementy wygenerowane przez AI na stronach.',

  // 4. Metoda sprawdzająca, czy moduł jest aktywny w ustawieniach
  isEnabled: () => {
    // Zazwyczaj pobiera wartość z globalnych ustawień lub dedykowanego przełącznika
    return isModuleEnabled;
  },

  // 5. Opcjonalna metoda inicjalizacyjna (uruchamiana raz przy starcie wtyczki)
  init: async () => {
    const settings = await getSettings();
    currentSettings = settings;
    // Przykład: włączenie modułu na podstawie globalnych ustawień wtyczki
    isModuleEnabled = settings.enabled ?? true;
    
    console.log('[AI Slop Blocker - MyModule] Zainicjalizowano pomyślnie.');
  },

  // 6. Główna metoda analizująca węzły DOM.
  // Wywoływana przez centralny MutationObserver dla każdego nowego/zmienionego elementu.
  analyze: (node: Element) => {
    // Zapobiegaj analizie pustych lub niepodłączonych węzłów
    if (!node || !node.isConnected) return;

    // Przykładowa logika: poszukiwanie kontenera tekstu
    const paragraphs = node.querySelectorAll('p');
    paragraphs.forEach((p) => {
      const text = (p.textContent || '').trim();
      
      // Wywołanie analizatora tekstowego
      // (Możesz zaimportować `analyzeText` z '../utils/analyzer')
      if (text.includes('sztuczna inteligencja')) {
        // Logika blokowania elementu (np. nałożenie klasy CSS lub nakładki)
        p.style.filter = 'blur(4px)';
        p.setAttribute('data-asb-blocked', 'true');
      }
    });
  },

  // 7. Opcjonalna reakcja na zmianę adresu URL (przydatne przy Single Page Applications)
  onUrlChange: async (url: string) => {
    console.log(`[AI Slop Blocker - MyModule] Wykryto zmianę strony: ${url}`);
    // Np. wyczyszczenie cache'u elementów lub ponowne przeskanowanie strony
  },

  // 8. Opcjonalna reakcja na modyfikację ustawień przez użytkownika
  onSettingsChange: (newSettings: PluginSettings) => {
    currentSettings = newSettings;
    isModuleEnabled = newSettings.enabled ?? true;
    
    console.log('[AI Slop Blocker - MyModule] Zaktualizowano ustawienia.');
  }
};
```

---

## Krok 3: Rejestracja modułu w orkiestratorze

Aby Twój moduł zaczął działać i otrzymywał powiadomienia o zmianach w DOM oraz cyklu życia, musisz zarejestrować go w pliku [src/core/orchestrator.ts](../ai-slop-blocker/src/core/orchestrator.ts).

Otwórz plik `src/core/orchestrator.ts` i wykonaj dwie modyfikacje:

1. **Zaimportuj swój moduł** na początku pliku:
   ```typescript
   import { myNewModule } from '../modules/myNewModuleFile';
   ```

2. **Dodaj zaimportowany moduł do tablicy `modules`** wewnątrz definicji klasy `ModuleOrchestrator`:
   ```diff
   export class ModuleOrchestrator {
     private static instance: ModuleOrchestrator | null = null;
     
   -  private modules: ASBModule[] = [postsModule, pagesModule];
   +  private modules: ASBModule[] = [postsModule, pagesModule, myNewModule];
     private isPluginEnabled = true;
   ```

Po tych krokach orkiestrator automatycznie włączy Twój moduł do cyklu życia wtyczki i zacznie przekazywać mu elementy do analizy za pomocą metody `analyze`.

---

## Krok 4: Testowanie i Dobre Praktyki

Podczas pisania modułów stosuj się do następujących reguł wydajnościowych:

> [!IMPORTANT]
> **Zasada 1: Nie blokuj głównego wątku**  
> Metoda `analyze` jest wywoływana bardzo często (przy każdej zmianie w DOM). Unikaj w niej operacji synchronicznych o złożoności obliczeniowej większej niż minimalna niezbędna. Jeśli musisz wykonać cięższe operacje na drzewie DOM, zastosuj kolejkowanie elementów oraz ich przetwarzanie w paczkach (batching) przy użyciu `requestAnimationFrame` lub krótkich opóźnień (`setTimeout`), tak jak zrobiono to w module `posts.ts`.

> [!WARNING]
> **Zasada 2: Obsługuj zmiany stanu (Recykling DOM)**  
> Współczesne frameworki (np. React) często ponownie wykorzystują te same elementy DOM dla nowych danych (np. przy przewijaniu listy). Upewnij się, że Twój moduł potrafi wykryć zmianę zawartości tekstowej elementu i zresetować stan blokady (np. usunąć atrybut `data-asb-blocked` i nakładkę), jeśli nowy tekst nie jest "slopem".

> [!TIP]
> **Zasada 3: Filtruj elementy wejściowe**  
> W metodzie `analyze` jako pierwszy krok dodaj filtrowanie ignorujące elementy systemowe wtyczki (np. własne nakładki blokujące, plakietki) oraz formularze logowania lub paski zgód na pliki cookies. Analizowanie ich spowalnia przeglądarkę i może powodować błędy wizualne. Użyj do tego gotowej funkcji pomocniczej `shouldSkipElement(el)`.
