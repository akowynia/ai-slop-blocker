import { ModuleOrchestrator } from '../core/orchestrator';

console.log('[AI Slop Blocker] Skrypt zawartości zainicjalizowany (wersja modułowa).');
ModuleOrchestrator.getInstance().start().catch((err) => {
  console.error('[AI Slop Blocker] Błąd krytyczny podczas uruchamiania orkiestratora:', err);
});
