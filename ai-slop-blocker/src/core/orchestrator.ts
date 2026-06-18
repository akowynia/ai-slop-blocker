import type { ASBModule } from '../types/module';
import { postsModule } from '../modules/posts';
import { pagesModule } from '../modules/pages';
import { getSettings, saveSettings } from '../utils/storage';
import type { PluginSettings } from '../utils/settings';
import { getCustomRules, getRemoteRules } from '../utils/storage';
import { setRules, BANNED_CONFIGS } from '../utils/analyzer';
import type { BannedPatternConfig } from '../utils/analyzer';

export class ModuleOrchestrator {
  private static instance: ModuleOrchestrator | null = null;
  
  private modules: ASBModule[] = [postsModule, pagesModule];
  private isPluginEnabled = true;
  private isCurrentPageExcluded = false;
  private isDebugMode = false;
  
  private lastUrl = typeof location !== 'undefined' ? location.href : '';
  private urlCheckInterval: ReturnType<typeof setInterval> | null = null;
  private historyIntercepted = false;
  private observer: MutationObserver | null = null;

  private constructor() {}

  public static getInstance(): ModuleOrchestrator {
    if (!ModuleOrchestrator.instance) {
      ModuleOrchestrator.instance = new ModuleOrchestrator();
    }
    return ModuleOrchestrator.instance;
  }

  public async loadAndCombineRules(): Promise<void> {
    try {
      console.log('[AI Slop Blocker - Orchestrator] Ładowanie i łączenie reguł...');

      // 1. Pobranie reguł wbudowanych
      const builtInRules = BANNED_CONFIGS;

      // 2. Pobranie reguł zdalnych ze storage.local
      const remoteRulesRaw = await getRemoteRules();
      const remoteRules: BannedPatternConfig[] = [];
      for (const r of remoteRulesRaw) {
        try {
          remoteRules.push({
            phrase: r.phrase,
            pattern: new RegExp(r.pattern, r.flags || 'i'),
            weight: r.weight
          });
        } catch (e) {
          console.error(`[AI Slop Blocker - Orchestrator] Błąd kompilacji regex dla reguły zdalnej: ${r.phrase}`, e);
        }
      }

      // 3. Pobranie reguł własnych ze storage.sync
      const customRulesString = await getCustomRules();
      let customRulesRaw: any[] = [];
      try {
        customRulesRaw = JSON.parse(customRulesString || '[]');
      } catch (parseErr) {
        console.error('[AI Slop Blocker - Orchestrator] Błąd parsowania JSON dla customRules:', parseErr);
      }
      
      const customRules: BannedPatternConfig[] = [];
      for (const r of customRulesRaw) {
        try {
          customRules.push({
            phrase: r.phrase,
            pattern: new RegExp(r.pattern, r.flags || 'i'),
            weight: r.weight
          });
        } catch (e) {
          console.error(`[AI Slop Blocker - Orchestrator] Błąd kompilacji regex dla reguły własnej: ${r.phrase}`, e);
        }
      }

      // 4. Łączenie reguł (priorytet: własne > zdalne > wbudowane)
      const combinedMap = new Map<string, BannedPatternConfig>();

      // Najniższy priorytet: wbudowane
      for (const r of builtInRules) {
        combinedMap.set(r.phrase.toLowerCase(), r);
      }

      // Średni priorytet: zdalne
      for (const r of remoteRules) {
        combinedMap.set(r.phrase.toLowerCase(), r);
      }

      // Najwyższy priorytet: własne
      for (const r of customRules) {
        combinedMap.set(r.phrase.toLowerCase(), r);
      }

      const finalRules = Array.from(combinedMap.values());
      
      // Aktualizacja aktywnych reguł w analizatorze
      setRules(finalRules);
      
      console.log(`[AI Slop Blocker - Orchestrator] Pomyślnie połączono reguły. Łącznie aktywnych reguł: ${finalRules.length} (wbudowane: ${builtInRules.length}, zdalne: ${remoteRules.length}, własne: ${customRules.length})`);
    } catch (err) {
      console.error('[AI Slop Blocker - Orchestrator] Krytyczny błąd podczas ładowania i łączenia reguł:', err);
    }
  }

  public async start(): Promise<void> {
    if (typeof document === 'undefined') return;

    const init = async () => {
      if (!document.body) {
        setTimeout(init, 50);
        return;
      }

      console.log('[AI Slop Blocker - Orchestrator] Uruchamianie orkiestratora...');

      // 0. Ładowanie i łączenie reguł
      await this.loadAndCombineRules();

      // 1. Pobranie i ustawienie konfiguracji początkowej
      const settings = await getSettings();
      this.updateLocalSettings(settings);

      // 2. Inicjalizacja wszystkich modułów
      for (const mod of this.modules) {
        try {
          if (mod.init) {
            await mod.init();
          }
        } catch (err) {
          console.error(`[AI Slop Blocker - Orchestrator] Błąd inicjalizacji modułu ${mod.id}:`, err);
        }
      }

      // 3. Konfiguracja nasłuchu na zmiany URL (detekcja SPA)
      this.interceptHistoryNavigation();
      window.addEventListener('hashchange', () => this.checkUrlChange());
      this.urlCheckInterval = setInterval(() => this.checkUrlChange(), 300);

      // 4. Konfiguracja nasłuchu na zmiany konfiguracji w storage
      this.setupSettingsListeners();

      // 5. Uruchomienie głównego MutationObservera
      this.startObserver();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => init());
    } else {
      await init();
    }
  }

  private startObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      if (!this.isPluginEnabled || this.isCurrentPageExcluded) return;
      if (!this.isContextValid()) {
        if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
        }
        return;
      }

      // Sprawdzamy URL na wszelki wypadek
      this.checkUrlChange();

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.analyzeNodeInModules(node as Element);
            } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
              this.analyzeNodeInModules(node.parentElement);
            }
          });
        } else if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement;
          if (parent) {
            this.analyzeNodeInModules(parent);
          }
        } else if (mutation.type === 'attributes') {
          const target = mutation.target as Element;
          if (target.nodeType === Node.ELEMENT_NODE) {
            // Jeśli atrybuty uległy zmianie (np. React zresetował klasy)
            this.analyzeNodeInModules(target);
          }
        }
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'data-asb-blocked', 'data-slop-revealed']
    });

    console.log('[AI Slop Blocker - Orchestrator] Centralny MutationObserver zainicjalizowany.');
  }

  private analyzeNodeInModules(node: Element) {
    this.modules.forEach((mod) => {
      if (mod.isEnabled()) {
        try {
          mod.analyze(node);
        } catch (err) {
          console.error(`[AI Slop Blocker - Orchestrator] Błąd w module ${mod.id} podczas analizy węzła:`, err);
        }
      }
    });
  }

  private updateLocalSettings(settings: PluginSettings) {
    this.isPluginEnabled = settings.enabled ?? true;
    this.isCurrentPageExcluded = this.checkPageExclusion(settings);
    this.isDebugMode = settings.debugMode ?? false;
  }

  private checkPageExclusion(settings: PluginSettings): boolean {
    if (settings.whitelistDomains && settings.whitelistDomains.length > 0) {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
      for (const allowed of settings.whitelistDomains) {
        const allowedLower = allowed.toLowerCase().trim();
        if (allowedLower && currentHost.includes(allowedLower)) {
          return true;
        }
      }
    }
    return false;
  }

  private isContextValid(): boolean {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        return true;
      }
      return !!chrome.runtime.getManifest();
    } catch (e) {
      return false;
    }
  }

  private interceptHistoryNavigation() {
    if (this.historyIntercepted) return;
    this.historyIntercepted = true;

    // Odbieramy wiadomości od spaDetector.ts uruchomionego w MAIN world
    window.addEventListener('asb-spa-navigation', (e: Event) => {
      const customEvent = e as CustomEvent;
      this.onSpaNavigation(customEvent.detail || 'historyChange');
    });

    window.addEventListener('popstate', () => this.onSpaNavigation('popstate'));
  }

  private onSpaNavigation(source: string) {
    setTimeout(() => {
      this.checkUrlChange(`nawigacja SPA (${source})`);
    }, 50);
  }

  private checkUrlChange(reason?: string) {
    if (!this.isPluginEnabled) return;
    if (!this.isContextValid()) {
      if (this.urlCheckInterval) {
        clearInterval(this.urlCheckInterval);
        this.urlCheckInterval = null;
      }
      return;
    }

    if (typeof location === 'undefined') return;
    const currentUrl = location.href;
    if (currentUrl !== this.lastUrl) {
      console.log(`[AI Slop Blocker - Orchestrator] Wykryto zmianę URL${reason ? ` [${reason}]` : ''}: ${this.lastUrl} -> ${currentUrl}`);
      this.lastUrl = currentUrl;

      getSettings().then((settings) => {
        this.updateLocalSettings(settings);
        
        // Powiadomienie modułów o zmianie URL
        this.modules.forEach((mod) => {
          if (mod.onUrlChange) {
            try {
              mod.onUrlChange(currentUrl);
            } catch (err) {
              console.error(`[AI Slop Blocker - Orchestrator] Błąd onUrlChange w module ${mod.id}:`, err);
            }
          }
        });
      });
    }
  }

  private setupSettingsListeners() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.slopSettings) {
          const newSettings = changes.slopSettings.newValue;
          if (newSettings) {
            this.handleSettingsChange(newSettings);
          }
        }

        // Nasłuchiwanie zmian reguł (customRules w local, remoteRules w local)
        if ((namespace === 'local' && (changes.customRules || changes.remoteRules))) {
          this.loadAndCombineRules().then(() => {
            getSettings().then((settings) => {
              this.handleSettingsChange(settings);
            });
          });
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'slopSettings') {
          try {
            const newSettings = JSON.parse(e.newValue || '{}');
            if (newSettings) {
              this.handleSettingsChange(newSettings);
            }
          } catch (err) {}
        }
      });

      // Obsługa ręcznego wyzwolenia debugowania (komunikacja window.postMessage z MAIN world)
      window.addEventListener('message', async (e) => {
        if (e.source !== window || !e.data) return;
        if (e.data.type === 'ASB_TOGGLE_DEBUG') {
          const enable = e.data.enabled ?? false;
          const settings = await getSettings();
          settings.debugMode = enable;
          await saveSettings(settings);
          this.handleSettingsChange(settings);
        }
      });
    }
  }

  private handleSettingsChange(newSettings: PluginSettings) {
    this.updateLocalSettings(newSettings);

    // Powiadomienie modułów o zmianie ustawień
    this.modules.forEach((mod) => {
      if (mod.onSettingsChange) {
        try {
          mod.onSettingsChange(newSettings);
        } catch (err) {
          console.error(`[AI Slop Blocker - Orchestrator] Błąd onSettingsChange w module ${mod.id}:`, err);
        }
      }
    });
  }
}
