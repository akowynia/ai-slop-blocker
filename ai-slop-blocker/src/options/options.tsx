import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { getSettings, saveSettings, getCustomRules, saveCustomRules, getRemoteRules, getLastSyncTime } from '../utils/storage';
import { fetchRemoteRules } from '../core/remoteRules';
import { BANNED_CONFIGS } from '../utils/analyzer';
import { DEFAULT_SETTINGS } from '../utils/settings';
import type { PluginSettings } from '../utils/settings';
import './options.css';

interface CustomRule {
  phrase: string;
  pattern: string;
  flags?: string;
  weight: number;
}

function OptionsPage() {
  const [settings, setSettings] = useState<PluginSettings | null>(null);
  const [customRulesText, setCustomRulesText] = useState<string>('[]');
  const [remoteRulesCount, setRemoteRulesCount] = useState<number>(0);
  const [lastSync, setLastSync] = useState<string>('');
  
  // Stany wizualnego edytora
  const [visualRules, setVisualRules] = useState<CustomRule[]>([]);
  
  // Stany formularza nowej reguły
  const [newPhrase, setNewPhrase] = useState<string>('');
  const [newPattern, setNewPattern] = useState<string>('');
  const [newFlags, setNewFlags] = useState<string>('i');
  const [newWeight, setNewWeight] = useState<number>(15);
  const [newRuleError, setNewRuleError] = useState<string | null>(null);

  // Stany edycji reguły
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editPhrase, setEditPhrase] = useState<string>('');
  const [editPattern, setEditPattern] = useState<string>('');
  const [editFlags, setEditFlags] = useState<string>('');
  const [editWeight, setEditWeight] = useState<number>(15);
  const [editRuleError, setEditRuleError] = useState<string | null>(null);

  // Stany formularza i akcji
  const [remoteUrl, setRemoteUrl] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSavingCustom, setIsSavingCustom] = useState<boolean>(false);
  const [isSavingUrl, setIsSavingUrl] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  
  // Stan synchronizacji zdalnej
  const [syncLoading, setSyncLoading] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });

  useEffect(() => {
    // Ładowanie ustawień i reguł przy starcie
    getSettings().then((setts) => {
      setSettings(setts);
      setRemoteUrl(setts.remoteRulesUrl || '');
    });

    getCustomRules().then((rules) => {
      setCustomRulesText(rules);
      validateJson(rules, true);
    });

    getRemoteRules().then((rules) => {
      setRemoteRulesCount(rules.length);
    });

    getLastSyncTime().then((time) => {
      setLastSync(time);
    });
  }, []);

  // Walidacja JSON-a reguł
  const validateJson = (text: string, updateVisual: boolean = false): boolean => {
    if (!text.trim()) {
      setValidationError(null);
      if (updateVisual) {
        setVisualRules([]);
      }
      return true;
    }
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setValidationError('Główny element musi być tablicą (np. [ ... ]).');
        return false;
      }

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (!item || typeof item !== 'object') {
          setValidationError(`Element na pozycji ${i} nie jest obiektem.`);
          return false;
        }
        if (typeof item.phrase !== 'string' || !item.phrase.trim()) {
          setValidationError(`Element na pozycji ${i}: brak wymaganej frazy (np. "phrase": "nazwa")`);
          return false;
        }
        if (typeof item.pattern !== 'string' || !item.pattern.trim()) {
          setValidationError(`Element na pozycji ${i} (fraza: "${item.phrase}"): brak lub pusty wzorzec regex ("pattern")`);
          return false;
        }
        if (typeof item.weight !== 'number') {
          setValidationError(`Element na pozycji ${i} (fraza: "${item.phrase}"): waga ("weight") musi być liczbą.`);
          return false;
        }
        try {
          new RegExp(item.pattern, item.flags || 'i');
        } catch (regErr) {
          setValidationError(`Element na pozycji ${i} (fraza: "${item.phrase}"): niepoprawne wyrażenie regularne: ${(regErr as Error).message}`);
          return false;
        }
      }

      setValidationError(null);
      if (updateVisual) {
        setVisualRules(parsed);
      }
      return true;
    } catch (err) {
      setValidationError(`Błąd składni JSON: ${(err as Error).message}`);
      return false;
    }
  };

  const handleCustomRulesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCustomRulesText(text);
    validateJson(text, true);
  };

  // Synchronizacja zmian z edytora wizualnego do JSON-a
  const syncVisualToText = (rules: CustomRule[]) => {
    setVisualRules(rules);
    const jsonStr = JSON.stringify(rules, null, 2);
    setCustomRulesText(jsonStr);
    setValidationError(null);
  };

  // Dodawanie nowej reguły
  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    setNewRuleError(null);

    const phrase = newPhrase.trim();
    const pattern = newPattern.trim();
    const flags = newFlags.trim();
    const weight = Number(newWeight);

    if (!phrase) {
      setNewRuleError('Nazwa frazy nie może być pusta.');
      return;
    }
    if (!pattern) {
      setNewRuleError('Wzorzec regex nie może być pusty.');
      return;
    }
    if (isNaN(weight) || weight < 1 || weight > 100) {
      setNewRuleError('Waga musi być liczbą z zakresu 1-100.');
      return;
    }

    // Walidacja regexa
    try {
      new RegExp(pattern, flags || 'i');
    } catch (err) {
      setNewRuleError(`Niepoprawne wyrażenie regularne: ${(err as Error).message}`);
      return;
    }

    const newRule: CustomRule = {
      phrase,
      pattern,
      weight,
      ...(flags ? { flags } : {})
    };

    const updatedRules = [...visualRules, newRule];
    syncVisualToText(updatedRules);

    // Resetowanie pól
    setNewPhrase('');
    setNewPattern('');
    setNewFlags('i');
    setNewWeight(15);
  };

  // Usuwanie reguły
  const handleDeleteRule = (index: number) => {
    const updatedRules = visualRules.filter((_, idx) => idx !== index);
    syncVisualToText(updatedRules);
    if (editingIndex === index) {
      setEditingIndex(null);
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  // Rozpoczęcie edycji
  const handleStartEdit = (index: number) => {
    const rule = visualRules[index];
    setEditingIndex(index);
    setEditPhrase(rule.phrase);
    setEditPattern(rule.pattern);
    setEditFlags(rule.flags || '');
    setEditWeight(rule.weight);
    setEditRuleError(null);
  };

  // Zapisanie edytowanej reguły
  const handleSaveEdit = (index: number) => {
    setEditRuleError(null);

    const phrase = editPhrase.trim();
    const pattern = editPattern.trim();
    const flags = editFlags.trim();
    const weight = Number(editWeight);

    if (!phrase) {
      setEditRuleError('Nazwa frazy nie może być pusta.');
      return;
    }
    if (!pattern) {
      setEditRuleError('Wzorzec regex nie może być pusty.');
      return;
    }
    if (isNaN(weight) || weight < 1 || weight > 100) {
      setEditRuleError('Waga musi być liczbą z zakresu 1-100.');
      return;
    }

    // Walidacja regexa
    try {
      new RegExp(pattern, flags || 'i');
    } catch (err) {
      setEditRuleError(`Niepoprawne wyrażenie regularne: ${(err as Error).message}`);
      return;
    }

    const updatedRule: CustomRule = {
      phrase,
      pattern,
      weight,
      ...(flags ? { flags } : {})
    };

    const updatedRules = [...visualRules];
    updatedRules[index] = updatedRule;
    syncVisualToText(updatedRules);
    setEditingIndex(null);
  };

  // Anulowanie edycji
  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditRuleError(null);
  };

  const handleSaveCustomRules = async () => {
    if (!validateJson(customRulesText)) return;
    setIsSavingCustom(true);
    setSaveSuccess(false);

    try {
      // Zapisujemy surowy JSON string do storage.sync
      await saveCustomRules(customRulesText);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Wystąpił błąd podczas zapisywania reguł.');
    } finally {
      setIsSavingCustom(false);
    }
  };

  const handleExportCustomRules = () => {
    try {
      const parsed = JSON.parse(customRulesText);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(parsed, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `ai_slop_blocker_rules_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert('Błąd eksportu: Edytor JSON zawiera błędy składniowe. Popraw je przed eksportem.');
    }
  };

  const handleClearCustomRules = async () => {
    if (confirm('Czy na pewno chcesz wyczyścić wszystkie własne reguły filtrowania? Tej operacji nie można cofnąć.')) {
      setCustomRulesText('[]');
      setVisualRules([]);
      setValidationError(null);
      try {
        await saveCustomRules('[]');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (err) {
        console.error(err);
        alert('Wystąpił błąd podczas czyszczenia reguł.');
      }
    }
  };

  const handleResetAllSettings = async () => {
    if (confirm('Czy na pewno chcesz przywrócić całą wtyczkę do ustawień fabrycznych? Spowoduje to wyczyszczenie wszystkich własnych reguł oraz zresetowanie wszystkich ustawień do wartości domyślnych. Tej operacji nie można cofnąć.')) {
      try {
        await saveSettings(DEFAULT_SETTINGS);
        setSettings(DEFAULT_SETTINGS);
        setRemoteUrl(DEFAULT_SETTINGS.remoteRulesUrl || '');

        await saveCustomRules('[]');
        setCustomRulesText('[]');
        setVisualRules([]);
        setValidationError(null);

        alert('Ustawienia fabryczne zostały przywrócone pomyślnie.');
      } catch (err) {
        console.error(err);
        alert('Wystąpił błąd podczas przywracania ustawień.');
      }
    }
  };

  const handleLoadDefaultRulesTemplate = () => {
    if (confirm('Czy chcesz zastąpić obecną treść w edytorze wbudowanymi regułami jako szablonem? Twoje niezapisane zmiany zostaną utracone.')) {
      const templateRules = BANNED_CONFIGS.map(r => {
        const source = r.pattern.source;
        const flags = r.pattern.flags;
        return {
          phrase: r.phrase,
          pattern: source,
          flags: flags || undefined,
          weight: r.weight
        };
      });
      
      const templateString = JSON.stringify(templateRules, null, 2);
      setCustomRulesText(templateString);
      validateJson(templateString, true);
    }
  };

  const handleSaveRemoteUrl = async () => {
    if (!settings) return;
    setIsSavingUrl(true);
    
    const urlTrimmed = remoteUrl.trim();
    if (urlTrimmed && !urlTrimmed.toLowerCase().startsWith('https://')) {
      alert('URL musi rozpoczynać się od protokołu https://');
      setIsSavingUrl(false);
      return;
    }

    try {
      const updatedSettings = {
        ...settings,
        remoteRulesUrl: urlTrimmed
      };
      setSettings(updatedSettings);
      await saveSettings(updatedSettings);
      
      // Powiadomienie użytkownika
      setSyncStatus({ type: 'idle', message: 'Zapisano URL zdalnych zasad.' });
    } catch (err) {
      console.error(err);
      alert('Wystąpił błąd podczas zapisywania URL.');
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handleSyncNow = async () => {
    const urlTrimmed = remoteUrl.trim();
    if (!urlTrimmed) {
      setSyncStatus({ type: 'error', message: 'Wprowadź prawidłowy URL zdalnych zasad, aby przeprowadzić synchronizację.' });
      return;
    }

    setSyncLoading(true);
    setSyncStatus({ type: 'idle', message: '' });

    try {
      const rules = await fetchRemoteRules(urlTrimmed);
      setRemoteRulesCount(rules.length);
      const timeNow = new Date().toISOString();
      setLastSync(timeNow);
      setSyncStatus({ type: 'success', message: `Synchronizacja udana! Pomyślnie załadowano ${rules.length} reguł.` });
    } catch (err) {
      console.error(err);
      setSyncStatus({ type: 'error', message: `Błąd synchronizacji: ${(err as Error).message}` });
    } finally {
      setSyncLoading(false);
    }
  };

  const formatLastSync = (isoStr: string) => {
    if (!isoStr) return 'nigdy';
    try {
      const date = new Date(isoStr);
      return date.toLocaleString('pl-PL');
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-red-500 to-rose-400 bg-clip-text text-transparent leading-none">
              AI Slop Blocker
            </h1>
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Zaawansowany Panel Reguł i Zdalnych Zasad</span>
          </div>
        </div>
        
        <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Status systemu: <strong className="text-emerald-400 font-bold">Aktywny</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Lewy panel - Konfiguracja Zdalna */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -right-12 -bottom-12 w-40 h-40 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-all duration-300" />
            
            <h2 className="text-lg font-bold text-slate-200 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Zdalne reguły (GitHub Raw / HTTPS)
            </h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Zdefiniuj adres URL pliku `.json` zawierającego reguły filtrowania AI Slop. Wtyczka będzie automatycznie pobierać i aktualizować te reguły w tle co 24 godziny.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  URL Zdalnego Pliku JSON (HTTPS)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://raw.githubusercontent.com/user/repo/main/rules.json"
                    value={remoteUrl}
                    onChange={(e) => setRemoteUrl(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:border-red-500/50"
                  />
                  <button
                    onClick={handleSaveRemoteUrl}
                    disabled={isSavingUrl}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 hover:text-white rounded-lg font-bold text-xs transition-colors"
                  >
                    {isSavingUrl ? 'Zapisywanie...' : 'Zapisz URL'}
                  </button>
                </div>
              </div>

              {/* Informacje o synchronizacji */}
              <div className="bg-slate-950/50 border border-slate-850 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Ostatnia synchronizacja:</span>
                  <span className="font-semibold text-slate-300">{formatLastSync(lastSync)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Pobrane reguły zdalne:</span>
                  <span className="font-bold text-red-400">{remoteRulesCount}</span>
                </div>
                
                <button
                  onClick={handleSyncNow}
                  disabled={syncLoading || !remoteUrl}
                  className="w-full mt-2 py-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:opacity-40 text-white rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  {syncLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Pobieranie...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
                      </svg>
                      Synchronizuj teraz
                    </>
                  )}
                </button>
              </div>

              {/* Status operacji */}
              {syncStatus.message && (
                <div className={`p-3 rounded-lg text-xs leading-snug border ${
                  syncStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  syncStatus.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                  'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  {syncStatus.message}
                </div>
              )}
            </div>
          </div>
          
          {/* Szybka pomoc */}
          <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Format Reguły</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Każda reguła reprezentowana jest przez obiekt JSON zawierający pola:
            </p>
            <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li><strong className="text-slate-300">phrase</strong>: Nazwa wyświetlana (np. przy debugowaniu wykrytych postów).</li>
              <li><strong className="text-slate-300">pattern</strong>: Tekstowy zapis wyrażenia regularnego (bez otaczających ukośników `/`).</li>
              <li><strong className="text-slate-300">flags</strong>: Flagi regex (np. `"i"` dla ignorowania wielkości liter, `"g"`). Domyślnie używana jest flaga `"i"`.</li>
              <li><strong className="text-slate-300">weight</strong>: Waga kary punktowej dodawana po dopasowaniu reguły (zalecana: `8` do `25`).</li>
            </ul>
          </div>

          {/* Konserwacja i Narzędzia */}
          <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Konserwacja i Narzędzia
            </h3>
            
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Zarządzaj swoimi danymi, eksportuj reguły własne lub przywróć całą wtyczkę do stanu początkowego.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportCustomRules}
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-800 hover:border-red-500/30 hover:bg-slate-950/40 text-slate-300 hover:text-red-400 text-[11px] font-semibold transition-all duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Eksportuj reguły
              </button>
              
              <button
                type="button"
                onClick={handleClearCustomRules}
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-800 hover:border-red-500/30 hover:bg-slate-950/40 text-slate-300 hover:text-red-400 text-[11px] font-semibold transition-all duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Wyczyść reguły
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetAllSettings}
              className="w-full py-2 bg-red-950/20 hover:bg-red-900/10 border border-red-900/30 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-lg font-bold text-[11px] transition-all duration-200 flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
              </svg>
              Przywróć ustawienia fabryczne
            </button>
          </div>
        </div>

        {/* Prawy panel - Edytor własnych reguł */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Własne reguły filtrowania (Edytor JSON)
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                validationError ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {validationError ? 'JSON Niepoprawny' : 'JSON Poprawny'}
              </span>
            </div>
            
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Zapisz własne, lokalne reguły detekcji slopu. Zostaną one zsynchronizowane pomiędzy Twoimi instancjami Chrome w ramach konta Google.
            </p>

            {/* Zasady edytowania reguł (Wskazówki) */}
            <div className="bg-slate-950/70 border border-slate-850 rounded-xl p-3.5 mb-4 text-[11px] leading-relaxed text-slate-400 space-y-2">
              <h3 className="font-bold text-slate-300 flex items-center gap-1.5 text-xs">
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Zasady tworzenia własnych reguł (Edycja):
              </h3>
              <ul className="list-disc pl-4 space-y-1 text-slate-400">
                <li>Format JSON: Edytor akceptuje tablicę obiektów: <code className="text-red-400 font-mono">{"[ { \"phrase\": \"...\", \"pattern\": \"...\", \"weight\": X } ]"}</code>.</li>
                <li><strong>Wzorce Regex</strong>: Podawaj sam tekst wyrażenia – **bez ukośników** <code className="text-slate-300 font-mono">/</code> na początku i na końcu. Zamiast <code className="text-slate-500">/fraza/i</code> wpisz <code className="text-slate-300 font-mono">"fraza"</code>. Flagi (np. <code className="text-slate-300 font-mono">"i"</code> dla ignorowania wielkości liter) określ w polu <code className="text-slate-300 font-mono">"flags"</code>.</li>
                <li><strong>Waga kary</strong>: Liczba punktów (np. 15-25) dodawana przy wykryciu. Osiągnięcie progu czułości blokuje post.</li>
                <li><strong>Priorytet</strong>: Własne reguły mają najwyższy priorytet i nadpisują reguły wbudowane oraz zdalne o identycznej nazwie <code className="text-slate-300 font-mono">"phrase"</code>.</li>
              </ul>
              
              <div className="mt-3 pt-3 border-t border-slate-900/50">
                <strong className="text-slate-300 block mb-2">Praktyczne przykłady (JSON):</strong>
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-1">1. Blokowanie prostej frazy (np. sztuczny zwrot LLM):</span>
                    <pre className="bg-slate-950 p-2 rounded font-mono text-[10px] text-slate-300 overflow-x-auto border border-slate-800">
{`{
  "phrase": "Zanurzmy się",
  "pattern": "zanurzmy się",
  "weight": 25
}`}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-1">2. Obsługa polskich odmian (np. "sztuczna inteligencja", "sztucznej inteligencji", "sztuczną inteligencję"):</span>
                    <pre className="bg-slate-950 p-2 rounded font-mono text-[10px] text-slate-300 overflow-x-auto border border-slate-800">
{`{
  "phrase": "Sztuczna inteligencja",
  "pattern": "sztuczn(a|ej|ą) inteligencj(a|i|ę|ą)",
  "weight": 15
}`}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-1">3. Kilka fraz w jednej regule (połączone znakiem potoku | jako alternatywa):</span>
                    <pre className="bg-slate-950 p-2 rounded font-mono text-[10px] text-slate-300 overflow-x-auto border border-slate-800">
{`{
  "phrase": "Frazy klucze LLM",
  "pattern": "w dzisiejszych czasach|kluczowym aspektem|warto zauważyć",
  "weight": 20
}`}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-900/50">
                <details className="group border border-slate-800 rounded-xl bg-slate-950/40 overflow-hidden">
                  <summary className="flex items-center justify-between p-3 text-xs font-bold text-slate-300 cursor-pointer hover:bg-slate-900/30 select-none">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                      </svg>
                      Generowanie reguł przez AI (Prompt do skopiowania)
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal group-open:hidden">Rozwiń &darr;</span>
                    <span className="text-[10px] text-slate-500 font-normal hidden group-open:inline">Zwiń &uarr;</span>
                  </summary>
                  <div className="p-3 border-t border-slate-900/80 bg-slate-950 text-[10px] text-slate-400 space-y-2 leading-relaxed">
                    <p>
                      Skopiuj poniższy prompt i wklej go do dowolnego modelu AI (np. ChatGPT, Claude, Gemini), uzupełniając go o własne frazy, aby automatycznie stworzyć poprawny kod JSON z regułami:
                    </p>
                    <pre className="p-2.5 bg-slate-900 rounded border border-slate-800 font-mono text-[10px] text-slate-300 whitespace-pre-wrap select-all cursor-pointer hover:border-slate-700 transition-colors" title="Kliknij, aby zaznaczyć całość">
{`Jesteś ekspertem od wyrażeń regularnych. Chcę stworzyć reguły blokowania treści (AI Slop) dla wtyczki AI Slop Blocker na podstawie poniższych słów/fraz:

[TUTAJ WKLEJ SWOJĄ LISTĘ FRAZ, NP. "w erze cyfrowej", "nieodłączny element"]

Przygotuj dla mnie tablicę JSON zawierającą obiekty o strukturze:
{
  "phrase": "krótka nazwa określająca frazę",
  "pattern": "wyrażenie regularne dopasowujące frazę w tekście (bez ukośników / na początku i końcu, uwzględniające polskie odmiany słów)",
  "flags": "i",
  "weight": liczba od 10 do 25 (ustaw wyższą wagę np. 20-25 dla bardzo unikalnych zwrotów AI, a niższą 10-15 dla bardziej ogólnych słów)
}

Zwróć TYLKO poprawny kod JSON w postaci tablicy [] bez żadnego dodatkowego komentarza.`}
                    </pre>
                  </div>
                </details>
              </div>

              <div className="pt-2.5 mt-1 border-t border-slate-900/50 flex justify-between items-center gap-2">
                <span className="text-[10px] text-slate-500 leading-tight">Chcesz zresetować edytor lub edytować na bazie gotowych reguł wbudowanych?</span>
                <button
                  type="button"
                  onClick={handleLoadDefaultRulesTemplate}
                  className="shrink-0 px-3 py-1.5 bg-red-950/40 hover:bg-red-900/40 border border-red-900/40 hover:border-red-500/50 text-red-400 hover:text-red-300 text-[10px] font-bold rounded-lg transition-all duration-150 flex items-center gap-1 shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Załaduj wbudowane reguły
                </button>
              </div>
            </div>

             {/* Wizualny Edytor Reguł */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-slate-450 uppercase tracking-wider mb-3 flex items-center justify-between border-b border-slate-800 pb-2 select-none">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Wizualny Kreator Reguł
                </span>
                <button
                  type="button"
                  onClick={handleLoadDefaultRulesTemplate}
                  className="px-2 py-1 bg-red-950/30 hover:bg-red-900/40 border border-red-900/40 hover:border-red-500/50 text-red-400 hover:text-red-300 text-[10px] font-bold rounded-lg transition-all duration-150 flex items-center gap-1 shadow-sm normal-case tracking-normal"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Wczytaj domyślne reguły
                </button>
              </h3>

              {/* Formularz dodawania */}
              <form onSubmit={handleAddRule} className="bg-slate-950/50 border border-slate-850 rounded-xl p-3 mb-3.5 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-4">
                    <label className="text-[9.5px] font-bold text-slate-550 uppercase block mb-1">Fraza / Nazwa</label>
                    <input
                      type="text"
                      placeholder="np. Zanurzmy się"
                      value={newPhrase}
                      onChange={(e) => setNewPhrase(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/40"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="text-[9.5px] font-bold text-slate-550 uppercase block mb-1">Wzorzec (Regex)</label>
                    <input
                      type="text"
                      placeholder="np. zanurzmy się"
                      value={newPattern}
                      onChange={(e) => setNewPattern(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/40 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[9.5px] font-bold text-slate-550 uppercase block mb-1">Flagi</label>
                    <input
                      type="text"
                      placeholder="np. i"
                      value={newFlags}
                      onChange={(e) => setNewFlags(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/40 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[9.5px] font-bold text-slate-550 uppercase block mb-1">Waga (1-100)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={newWeight}
                      onChange={(e) => setNewWeight(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-red-500/40"
                    />
                  </div>
                </div>
                {newRuleError && (
                  <p className="text-[10px] text-red-400 font-semibold">{newRuleError}</p>
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-red-650 hover:bg-red-600 text-white rounded-lg font-bold text-[10.5px] transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                    Dodaj regułę
                  </button>
                </div>
              </form>

              {/* Lista reguł */}
              <div className="max-h-[220px] overflow-y-auto border border-slate-850 bg-slate-950/20 rounded-xl pr-1 scrollbar-thin space-y-1.5 p-1.5">
                {visualRules.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-600 italic">
                    Brak zdefiniowanych własnych reguł. Użyj formularza powyżej lub edytora JSON na dole, aby dodać pierwsze reguły.
                  </div>
                ) : (
                  visualRules.map((rule, idx) => {
                    const isEditing = editingIndex === idx;
                    const weightColor = rule.weight >= 25 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                        rule.weight >= 15 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';

                    if (isEditing) {
                      return (
                        <div key={idx} className="bg-slate-900 border border-red-500/30 rounded-xl p-3 space-y-2.5 animate-fade-in">
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                            <div className="sm:col-span-4">
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Fraza</label>
                              <input
                                type="text"
                                value={editPhrase}
                                onChange={(e) => setEditPhrase(e.target.value)}
                                className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-red-500/40"
                              />
                            </div>
                            <div className="sm:col-span-4">
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Regex</label>
                              <input
                                type="text"
                                value={editPattern}
                                onChange={(e) => setEditPattern(e.target.value)}
                                className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-red-500/40 font-mono"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Flagi</label>
                              <input
                                type="text"
                                value={editFlags}
                                onChange={(e) => setEditFlags(e.target.value)}
                                className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-red-500/40 font-mono"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Waga</label>
                              <input
                                type="number"
                                value={editWeight}
                                onChange={(e) => setEditWeight(Number(e.target.value))}
                                className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-red-500/40"
                              />
                            </div>
                          </div>
                          {editRuleError && (
                            <p className="text-[10px] text-red-400 font-semibold">{editRuleError}</p>
                          )}
                          <div className="flex justify-end gap-2 text-[10px] font-bold">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                            >
                              Anuluj
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(idx)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                            >
                              Zapisz
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="flex items-center justify-between bg-slate-900/40 border border-slate-850 hover:border-slate-800/80 rounded-xl p-2.5 hover:bg-slate-900/60 transition-all duration-150 group">
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-slate-200 text-xs truncate max-w-[150px] sm:max-w-[200px]" title={rule.phrase}>
                              {rule.phrase}
                            </span>
                            <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded ${weightColor}`}>
                              {rule.weight} Pkt
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5 font-mono text-[9.5px] text-slate-500 truncate" title={`Regex: /${rule.pattern}/${rule.flags || 'i'}`}>
                            <span className="text-slate-650">/</span>
                            <span className="text-red-400/80 truncate">{rule.pattern}</span>
                            <span className="text-slate-650">/</span>
                            <span className="text-slate-400 font-semibold">{rule.flags || 'i'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(idx)}
                            className="p-1 rounded bg-slate-950 border border-slate-850 hover:border-red-500/40 hover:bg-red-500/5 text-slate-400 hover:text-red-400 transition-colors"
                            title="Edytuj regułę"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Czy na pewno chcesz usunąć regułę "${rule.phrase}"?`)) {
                                handleDeleteRule(idx);
                              }
                            }}
                            className="p-1 rounded bg-slate-950 border border-slate-850 hover:border-red-500/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                            title="Usuń regułę"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex-1 min-h-[300px] relative mb-4">
              <textarea
                value={customRulesText}
                onChange={handleCustomRulesChange}
                placeholder={`[\n  {\n    "phrase": "customowa fraza slopu",\n    "pattern": "customow[ya] fraz[aę]",\n    "weight": 20\n  }\n]`}
                className="w-full h-full min-h-[350px] p-4 bg-slate-950 border border-slate-850 rounded-xl font-mono text-xs text-slate-300 focus:outline-none focus:border-red-500/40 placeholder-slate-700 resize-y leading-relaxed"
                spellCheck={false}
              />
            </div>

            {/* Błąd walidacji */}
            {validationError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs leading-normal flex items-start gap-2 animate-fade-in">
                <svg className="w-4 h-4 shrink-0 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{validationError}</span>
              </div>
            )}

            {/* Przyciski akcji */}
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-slate-500">
                Wskazówka: Pusta tablica `[]` oznacza brak reguł własnych.
              </div>
              
              <div className="flex items-center gap-3">
                {saveSuccess && (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    Zapisano pomyślnie!
                  </span>
                )}
                <button
                  onClick={handleSaveCustomRules}
                  disabled={isSavingCustom || validationError !== null}
                  className="px-6 py-2 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 disabled:from-slate-800 disabled:to-slate-800 disabled:opacity-40 text-white rounded-lg font-bold text-xs transition-all duration-200 shadow-md shadow-red-950/20"
                >
                  {isSavingCustom ? 'Zapisywanie...' : 'Zapisz Reguły'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptionsPage />
  </React.StrictMode>
);
