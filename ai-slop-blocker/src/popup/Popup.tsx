import { useEffect, useState } from 'react';
import { getSlopBlockedCount, getSettings, saveSettings, getBlockedEvents, clearBlockedEvents } from '../utils/storage';
import { BANNED_PHRASES, analyzeText } from '../utils/analyzer';
import type { PluginSettings } from '../utils/settings';
import { getChartData } from '../utils/stats';
import StatsChart from '../components/StatsChart';

export default function Popup() {
  const [count, setCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'stats' | 'settings' | 'tester'>('stats');
  const [testText, setTestText] = useState<string>('');
  const [testResult, setTestResult] = useState<any>(null);
  const [settings, setSettings] = useState<PluginSettings | null>(null);
  const [newAuthor, setNewAuthor] = useState<string>('');
  const [newDomain, setNewDomain] = useState<string>('');
  const [newAuthorUrl, setNewAuthorUrl] = useState<string>('');
  const [days, setDays] = useState<number>(7);
  const [chartData, setChartData] = useState<any>(null);
  const [currentHostname, setCurrentHostname] = useState<string>('');
  const [isCurrentPageWhitelisted, setIsCurrentPageWhitelisted] = useState<boolean>(false);
  const [telemetryCount, setTelemetryCount] = useState<number>(0);

  useEffect(() => {
    getSlopBlockedCount().then((val) => setCount(val));
    getSettings().then((setts) => setSettings(setts));
    getBlockedEvents().then((events) => setTelemetryCount(events.length));

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.url) {
          try {
            const url = new URL(activeTab.url);
            setCurrentHostname(url.hostname.toLowerCase());
          } catch (e) {
            console.error('Error parsing tab URL:', e);
          }
        }
      });
    }

    // Pozwala na włączenie/wyłączenie debugowania z poziomu konsoli popupu
    (window as any).asbDebug = async (enable: boolean = true) => {
      const setts = await getSettings();
      const updated = { ...setts, debugMode: enable };
      setSettings(updated);
      await saveSettings(updated);
      console.log(`[AI Slop Blocker] Tryb debugowania w popupie został ${enable ? 'aktywowany' : 'deaktywowany'}.`);
    };
    (window as any).enableASBDebug = () => (window as any).asbDebug(true);
    (window as any).disableASBDebug = () => (window as any).asbDebug(false);
  }, []);

  useEffect(() => {
    if (settings && !settings.debugMode && activeTab === 'tester') {
      setActiveTab('stats');
    }
  }, [settings, activeTab]);

  useEffect(() => {
    if (!settings || !currentHostname) {
      setIsCurrentPageWhitelisted(false);
      return;
    }
    const domains = settings.whitelistDomains || [];
    const isWhitelisted = domains.some((allowed) => {
      const allowedLower = allowed.toLowerCase().trim();
      return allowedLower && currentHostname.includes(allowedLower);
    });
    setIsCurrentPageWhitelisted(isWhitelisted);
  }, [settings, currentHostname]);

  useEffect(() => {
    if (activeTab === 'stats') {
      getChartData(days).then((data) => setChartData(data));
    }
  }, [days, activeTab, count]);

  const handleReset = async () => {
    if (confirm('Czy na pewno chcesz zresetować licznik?')) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise<void>((resolve) => {
          chrome.storage.local.set({ slopStats: {} }, () => resolve());
        });
      } else {
        localStorage.setItem('slopStats', JSON.stringify({}));
      }
      setCount(0);
    }
  };

  const handleExportJSON = async () => {
    const events = await getBlockedEvents();
    if (events.length === 0) {
      alert('Brak danych do wyeksportowania.');
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ai_blocker_telemetry_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = async () => {
    const events = await getBlockedEvents();
    if (events.length === 0) {
      alert('Brak danych do wyeksportowania.');
      return;
    }
    const headers = ['id', 'timestamp', 'domain', 'score', 'matchedRules', 'textLength', 'emojiCount', 'emojiDensity', 'isOverridden'];
    const csvRows = [headers.join(',')];

    for (const ev of events) {
      const row = [
        ev.id,
        ev.timestamp,
        ev.domain,
        ev.score,
        `"${ev.matchedRules.join(';')}"`,
        ev.textLength,
        ev.emojiCount,
        ev.emojiDensity,
        ev.isOverridden
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join('\n'));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", csvContent);
    downloadAnchor.setAttribute("download", `ai_blocker_telemetry_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleClearTelemetry = async () => {
    if (confirm('Czy na pewno chcesz usunąć wszystkie zgromadzone zdarzenia badawcze? Tej operacji nie można cofnąć.')) {
      await clearBlockedEvents();
      setTelemetryCount(0);
    }
  };

  const handleTelemetryChange = async (val: boolean) => {
    if (!settings) return;
    const updated = { ...settings, enableTelemetry: val };
    setSettings(updated);
    await saveSettings(updated);
    if (val) {
      getBlockedEvents().then((events) => setTelemetryCount(events.length));
    }
  };

  const handleThresholdChange = async (val: number) => {
    if (!settings) return;
    const updated = { ...settings, sensitivityThreshold: val };
    setSettings(updated);
    await saveSettings(updated);
  };

  const handleEnabledChange = async (val: boolean) => {
    if (!settings) return;
    const updated = { ...settings, enabled: val };
    setSettings(updated);
    await saveSettings(updated);
  };

  const handleSpaModeChange = async (val: boolean) => {
    if (!settings) return;
    const updated = { ...settings, enableSpaMode: val };
    setSettings(updated);
    await saveSettings(updated);
  };

  const handleHideSlopChange = async (val: boolean) => {
    if (!settings) return;
    const updated = { ...settings, hideSlopCompletely: val };
    setSettings(updated);
    await saveSettings(updated);
  };

  const handleModuleToggle = async (moduleId: string, val: boolean) => {
    if (!settings) return;
    const activeModules = settings.activeModules || { posts: true, pages: false };
    const updated = {
      ...settings,
      activeModules: {
        ...activeModules,
        [moduleId]: val
      }
    };
    setSettings(updated);
    await saveSettings(updated);
  };

  const getActiveModulesCount = () => {
    if (!settings) return { active: 0, total: 2 };
    const activeModules = settings.activeModules || { posts: true, pages: false };
    const isPostsActive = activeModules.posts ?? true;
    return { active: isPostsActive ? 1 : 0, total: 2 };
  };

  const handleAddAuthor = async () => {
    if (!settings || !newAuthor.trim()) return;
    const trimmed = newAuthor.trim();
    const authors = settings.whitelistAuthors || [];
    if (authors.some(item => item.toLowerCase() === trimmed.toLowerCase())) return;
    const updated = { ...settings, whitelistAuthors: [...authors, trimmed] };
    setSettings(updated);
    await saveSettings(updated);
    setNewAuthor('');
  };

  const handleRemoveAuthor = async (itemToRemove: string) => {
    if (!settings) return;
    const authors = settings.whitelistAuthors || [];
    const updated = { ...settings, whitelistAuthors: authors.filter(item => item !== itemToRemove) };
    setSettings(updated);
    await saveSettings(updated);
  };

  const handleAddAuthorUrl = async () => {
    if (!settings || !newAuthorUrl.trim()) return;
    const trimmed = newAuthorUrl.trim().toLowerCase();
    const list = settings.authorWhitelist || [];
    if (list.some(item => item.toLowerCase() === trimmed)) return;
    const updated = { ...settings, authorWhitelist: [...list, trimmed] };
    setSettings(updated);
    await saveSettings(updated);
    setNewAuthorUrl('');
  };

  const handleRemoveAuthorUrl = async (itemToRemove: string) => {
    if (!settings) return;
    const list = settings.authorWhitelist || [];
    const updated = { ...settings, authorWhitelist: list.filter(item => item !== itemToRemove) };
    setSettings(updated);
    await saveSettings(updated);
  };

  const handleAddDomain = async () => {
    if (!settings || !newDomain.trim()) return;
    const trimmed = newDomain.trim();
    const domains = settings.whitelistDomains || [];
    if (domains.some(item => item.toLowerCase() === trimmed.toLowerCase())) return;
    const updated = { ...settings, whitelistDomains: [...domains, trimmed] };
    setSettings(updated);
    await saveSettings(updated);
    setNewDomain('');
  };

  const handleRemoveDomain = async (itemToRemove: string) => {
    if (!settings) return;
    const domains = settings.whitelistDomains || [];
    const updated = { ...settings, whitelistDomains: domains.filter(item => item !== itemToRemove) };
    setSettings(updated);
    await saveSettings(updated);
  };

  return (
    <div className="w-full min-h-[420px] bg-slate-950 text-slate-100 flex flex-col p-4 select-none">
      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold bg-gradient-to-r from-red-500 to-rose-400 bg-clip-text text-transparent leading-none">
              AI Slop Blocker
            </h1>
            <span className="text-[10px] text-slate-500">Projekt Badawczy</span>
          </div>
        </div>

        {/* Przełącznik Wł/Wył */}
        {settings && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
                  chrome.runtime.openOptionsPage();
                } else {
                  window.open(chrome.runtime.getURL('src/options/options.html'));
                }
              }}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-805 hover:border-red-500/50 hover:bg-red-500/5 text-slate-400 hover:text-red-400 transition-all duration-200"
              title="Zaawansowane reguły (Opcje)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.enabled ?? true}
                onChange={(e) => handleEnabledChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-9 h-5 bg-slate-850 border border-slate-850 rounded-full peer peer-checked:bg-red-600 peer-checked:border-red-500 after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-slate-500 peer-checked:after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
              <span className="ms-2 text-[10px] font-bold text-slate-400 peer-checked:text-red-500 uppercase tracking-wider">
                {settings.enabled ?? true ? 'Wł' : 'Wył'}
              </span>
            </label>
          </div>
        )}
      </div>

      {isCurrentPageWhitelisted && (
        <div className="mb-4 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-amber-400 text-[11px] animate-fade-in">
          <svg className="w-4 h-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1 font-medium leading-snug">
            Ta strona została wykluczona.
          </div>
        </div>
      )}

      {/* Przełącznik zakładek */}
      <div className="flex border-b border-slate-800 mb-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 pb-2 text-center transition-all duration-150 ${
            activeTab === 'stats' ? 'text-red-500 border-b-2 border-red-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Statystyki
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 pb-2 text-center transition-all duration-150 ${
            activeTab === 'settings' ? 'text-red-500 border-b-2 border-red-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Ustawienia
        </button>
        {settings?.debugMode && (
          <button
            onClick={() => setActiveTab('tester')}
            className={`flex-1 pb-2 text-center transition-all duration-150 ${
              activeTab === 'tester' ? 'text-red-500 border-b-2 border-red-500' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tester Heurystyki
          </button>
        )}
      </div>

      {/* Zawartość zakładek */}
      <div className="flex-1 flex flex-col justify-between">
        {activeTab === 'stats' && (
          <div className="space-y-4">
            {/* Karta licznika */}
            <div className={`bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-800 rounded-xl p-5 text-center shadow-lg relative overflow-hidden group transition-all duration-300 ${!(settings?.enabled ?? true) ? 'opacity-60 saturate-50' : ''}`}>
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-red-500/5 rounded-full blur-xl group-hover:bg-red-500/10 transition-all duration-300" />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                Zneutralizowany AI Slop
              </p>
              <div className="text-4xl font-extrabold text-white my-2 tracking-tight group-hover:scale-105 transition-transform duration-300">
                {count}
              </div>
              <p className="text-[11px] text-slate-500">
                Tyle generycznych wpisów AI zostało zablokowanych.
              </p>
            </div>

            {/* Historia blokad - wykres */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Historia blokad</span>
                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all duration-150 ${
                        days === d
                          ? 'bg-red-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="max-w-[300px] mx-auto">
                {chartData ? (
                  <StatsChart data={chartData} />
                ) : (
                  <div className="h-[120px] flex items-center justify-center text-xs text-slate-600 italic">
                    Ładowanie wykresu...
                  </div>
                )}
              </div>
            </div>

            {/* Status i info */}
            <div className={`bg-slate-900/50 border border-slate-800/60 rounded-lg p-3 text-xs text-slate-400 space-y-2 transition-all duration-300 ${!(settings?.enabled ?? true) ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${(settings?.enabled ?? true) ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="font-semibold">
                  {(settings?.enabled ?? true) ? 'Ochrona w czasie rzeczywistym' : 'Ochrona jest wyłączona'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400 pb-1.5">
                {(settings?.enabled ?? true)
                  ? 'Wykrywamy sztuczne, zautomatyzowane teksty na podstawie heurystyki, gęstości emoji i struktury.'
                  : 'Włącz wtyczkę przełącznikiem na górze, aby aktywować blokowanie treści AI Slop.'}
              </p>
              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1.5 border-t border-slate-800/40">
                <span>Aktywne moduły detekcji</span>
                <span className="font-bold text-slate-400">
                  {getActiveModulesCount().active}/{getActiveModulesCount().total}
                </span>
              </div>
            </div>

            {/* Panel Eksportu Danych Badawczych */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Baza badawcza ({telemetryCount} wpisów)</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  settings?.enableTelemetry 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {settings?.enableTelemetry ? 'AKTYWNA (Opt-in)' : 'NIEAKTYWNA'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-snug">
                {settings?.enableTelemetry 
                  ? 'Gromadzimy lokalnie zanonimizowane metryki lingwistyczne (bez tekstów i danych osobowych). Dziękujemy za wspieranie nauki!' 
                  : 'Zbieranie danych jest wyłączone. Włącz opcję "Wspieraj projekt badawczy" w zakładce Ustawienia, aby rozpocząć zbieranie statystyk.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExportJSON}
                  disabled={telemetryCount === 0}
                  className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-850 hover:border-red-500/30 hover:bg-slate-900 text-slate-300 hover:text-red-400 text-xs font-semibold transition-all duration-200 disabled:opacity-40 disabled:hover:border-slate-850 disabled:hover:text-slate-300 disabled:hover:bg-transparent"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  JSON
                </button>
                <button
                  onClick={handleExportCSV}
                  disabled={telemetryCount === 0}
                  className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-850 hover:border-red-500/30 hover:bg-slate-900 text-slate-300 hover:text-red-400 text-xs font-semibold transition-all duration-200 disabled:opacity-40 disabled:hover:border-slate-850 disabled:hover:text-slate-300 disabled:hover:bg-transparent"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  CSV
                </button>
              </div>
              {telemetryCount > 0 && (
                <button
                  onClick={handleClearTelemetry}
                  className="w-full py-1 border border-transparent hover:border-red-950/20 text-slate-500 hover:text-red-400 text-[10px] font-semibold rounded transition-colors duration-150"
                >
                  Wyczyść bazę badawczą
                </button>
              )}
            </div>

            {/* Reset */}
            {count > 0 && (
              <button
                onClick={handleReset}
                className="w-full py-1.5 rounded-lg border border-slate-800 hover:border-red-500/30 hover:bg-red-500/5 text-slate-400 hover:text-red-400 text-xs font-semibold transition-all duration-200"
              >
                Zresetuj statystyki
              </button>
            )}
          </div>
        )}

        {activeTab === 'settings' && settings && (
          <div className="space-y-3.5 text-xs flex flex-col flex-1 overflow-y-auto max-h-[340px] pr-0.5 scrollbar-thin">
            {/* Suwak czułości */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-bold text-[11px]">Próg czułości: {settings.sensitivityThreshold}%</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  settings.sensitivityThreshold <= 45 ? 'bg-red-500/10 text-red-400' :
                  settings.sensitivityThreshold <= 75 ? 'bg-amber-500/10 text-amber-400' :
                  'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {settings.sensitivityThreshold <= 45 ? 'Agresywny' :
                   settings.sensitivityThreshold <= 75 ? 'Średni' :
                   'Zrównoważony'}
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={settings.sensitivityThreshold}
                onChange={(e) => handleThresholdChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
              <div className="text-[9.5px] text-slate-500 leading-relaxed space-y-1 pt-1.5 mt-1 border-t border-slate-900/50">
                <p>
                  <strong className="text-slate-400">Agresywny (10%-45%):</strong> Ukrywa nawet drobne ślady automatyzacji. Może powodować fałszywe zablokowania.
                </p>
                <p>
                  <strong className="text-slate-400">Średni (46%-75%):</strong> Standardowa ochrona przed masowym, sztucznym slopem. Optymalny balans.
                </p>
                <p>
                  <strong className="text-slate-400">Zrównoważony (76%-100%):</strong> Reaguje tylko na ewidentny, surowy tekst bezpośrednio z generatorów AI.
                </p>
              </div>
            </div>

            {/* Moduły Detekcji */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 space-y-2.5">
              <span className="text-slate-300 font-bold text-[11px] block border-b border-slate-800/50 pb-1">
                Moduły Detekcji
              </span>
              <div className="space-y-3">
                {/* Moduł 1: Wpisy */}
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={settings.activeModules?.posts ?? true}
                    onChange={(e) => handleModuleToggle('posts', e.target.checked)}
                    className="mt-0.5 rounded border-slate-800 bg-slate-950 text-red-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-red-500 animate-fade-in"
                  />
                  <div className="space-y-0.5">
                    <span className="text-slate-300 font-bold text-[11px] block group-hover:text-slate-200 transition-colors">
                      Detekcja wpisów AI (Media społecznościowe)
                    </span>
                    <p className="text-[9.5px] text-slate-500 leading-relaxed">
                      Skanowanie i filtrowanie automatycznych, niskiej jakości wpisów generowanych przez LLM na LinkedIn i innych wspieranych portalach.
                    </p>
                  </div>
                </label>

                {/* Moduł 2: Strony */}
                <label className="flex items-start gap-2.5 cursor-not-allowed group opacity-50">
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={true}
                    className="mt-0.5 rounded border-slate-800 bg-slate-950 text-red-600 focus:ring-0 focus:ring-offset-0 cursor-not-allowed accent-red-500 animate-fade-in"
                  />
                  <div className="space-y-0.5">
                    <span className="text-slate-300 font-bold text-[11px] block transition-colors">
                      Ostrzeganie stron AI <span className="text-red-500 text-[9px] font-semibold">(Wkrótce)</span>
                    </span>
                    <p className="text-[9.5px] text-slate-500 leading-relaxed">
                      Analiza i ostrzeganie przed całymi witrynami internetowymi, stronami docelowymi i blogami zdominowanymi przez treści generowane automatycznie.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Tryb SPA */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.enableSpaMode ?? true}
                  onChange={(e) => handleSpaModeChange(e.target.checked)}
                  className="mt-0.5 rounded border-slate-800 bg-slate-950 text-red-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-red-500"
                />
                <div className="space-y-0.5">
                  <span className="text-slate-300 font-bold text-[11px] block group-hover:text-slate-200 transition-colors">
                    Automatyczne odświeżanie stron SPA (CSR)
                  </span>
                  <p className="text-[9.5px] text-slate-500 leading-relaxed">
                    Wtyczka automatycznie odświeży stronę w przypadku wykrycia problemów z doczytaniem dynamicznej treści po przejściu na nową podstronę. Wyłączenie tej opcji zapobiega nagłym przeładowaniom kart, ale wtyczka może zblurować nowe posty dopiero po pierwszym przewinięciu ekranu.
                  </p>
                </div>
              </label>
            </div>

            {/* Całkowite ukrywanie */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.hideSlopCompletely ?? false}
                  onChange={(e) => handleHideSlopChange(e.target.checked)}
                  className="mt-0.5 rounded border-slate-800 bg-slate-950 text-red-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-red-500"
                />
                <div className="space-y-0.5">
                  <span className="text-slate-300 font-bold text-[11px] block group-hover:text-slate-200 transition-colors">
                    Całkowicie ukrywaj posty AI Slop
                  </span>
                  <p className="text-[9.5px] text-slate-500 leading-relaxed">
                    Zamiast nakładania półprzezroczystego rozmycia (blura) z przyciskiem do odsłonięcia treści, wtyczka całkowicie usunie wykryte posty AI Slop z widoku strony. <strong className="text-amber-500/80">Uwaga: Jest to funkcja eksperymentalna, uruchamiana na własne ryzyko.</strong> Ponieważ wtyczka działa uniwersalnie na różnych portalach, całkowite usuwanie elementów DOM może w niektórych przypadkach powodować nieprawidłowe wyświetlanie struktury lub błędne zachowanie układu strony.
                  </p>
                </div>
              </label>
            </div>

            {/* Zgoda na telemetrię */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.enableTelemetry ?? false}
                  onChange={(e) => handleTelemetryChange(e.target.checked)}
                  className="mt-0.5 rounded border-slate-800 bg-slate-950 text-red-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-red-500"
                />
                <div className="space-y-0.5">
                  <span className="text-slate-300 font-bold text-[11px] block group-hover:text-slate-200 transition-colors">
                    Wspieraj projekt badawczy (Telemetria)
                  </span>
                  <p className="text-[9.5px] text-slate-500 leading-relaxed">
                    Włączenie tej opcji pozwala na lokalne zbieranie całkowicie zanonimizowanych statystyk o zablokowanych treściach (takich jak dopasowane reguły, domeny, gęstość emoji). Dane te nie zawierają żadnych tekstów postów ani nazwisk autorów. Będziesz mógł je w każdej chwili wyeksportować lub usunąć.
                  </p>
                </div>
              </label>
            </div>

            {/* Zaufani Autorzy */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 space-y-3">
              <span className="text-slate-300 font-bold text-[11px] block border-b border-slate-800/50 pb-1">Zaufani Autorzy</span>
              
              {/* Sekcja dodawania nazw */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-semibold block">Nazwy wyświetlane:</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="np. Jan Kowalski, Anna Nowak"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddAuthor(); }}
                    className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/50"
                  />
                  <button
                    onClick={handleAddAuthor}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-colors duration-150 text-xs"
                  >
                    Dodaj
                  </button>
                </div>

                {/* Lista whitelistAuthors */}
                <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1 scrollbar-thin">
                  {(!settings.whitelistAuthors || settings.whitelistAuthors.length === 0) ? (
                    <span className="text-[10px] text-slate-600 italic">Brak zaufanych nazw.</span>
                  ) : (
                    settings.whitelistAuthors.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-850 hover:border-red-500/30 text-slate-300 text-[10px] pl-2 pr-1 py-0.5 rounded-full group transition-all duration-150"
                      >
                        <span className="truncate max-w-[100px]">{item}</span>
                        <button
                          onClick={() => handleRemoveAuthor(item)}
                          className="w-4 h-4 rounded-full flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 font-bold transition-all duration-150"
                          title="Usuń"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Sekcja dodawania profilów URL */}
              <div className="space-y-2 pt-2 border-t border-slate-900/50">
                <span className="text-[10px] text-slate-400 font-semibold block">Dodaj profil użytkownika (fragment URL):</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="np. /in/jan-kowalski, /profile/anna-nowak"
                    value={newAuthorUrl}
                    onChange={(e) => setNewAuthorUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddAuthorUrl(); }}
                    className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/50"
                  />
                  <button
                    onClick={handleAddAuthorUrl}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-colors duration-150 text-xs"
                  >
                    Dodaj
                  </button>
                </div>

                {/* Lista authorWhitelist */}
                <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1 scrollbar-thin">
                  {(!settings.authorWhitelist || settings.authorWhitelist.length === 0) ? (
                    <span className="text-[10px] text-slate-600 italic">Brak zaufanych profili URL.</span>
                  ) : (
                    settings.authorWhitelist.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-850 hover:border-red-500/30 text-slate-300 text-[10px] pl-2 pr-1 py-0.5 rounded-full group transition-all duration-150"
                      >
                        <span className="truncate max-w-[150px]">{item}</span>
                        <button
                          onClick={() => handleRemoveAuthorUrl(item)}
                          className="w-4 h-4 rounded-full flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 font-bold transition-all duration-150"
                          title="Usuń"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Zaufane Strony (Domeny) */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 space-y-2.5">
              <span className="text-slate-300 font-bold text-[11px] block">Zaufane strony (domeny)</span>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="np. messenger.com, bank"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddDomain(); }}
                  className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/50"
                />
                <button
                  onClick={handleAddDomain}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-colors duration-150"
                >
                  Dodaj
                </button>
              </div>

              {/* Lista whitelistDomains */}
              <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1 scrollbar-thin">
                {(!settings.whitelistDomains || settings.whitelistDomains.length === 0) ? (
                  <span className="text-[10px] text-slate-600 italic">Brak zaufanych stron.</span>
                ) : (
                  settings.whitelistDomains.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-850 hover:border-red-500/30 text-slate-300 text-[10px] pl-2 pr-1 py-0.5 rounded-full group transition-all duration-150"
                    >
                      <span className="truncate max-w-[100px]">{item}</span>
                      <button
                        onClick={() => handleRemoveDomain(item)}
                        className="w-4 h-4 rounded-full flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 font-bold transition-all duration-150"
                        title="Usuń"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Zaawansowany Panel Reguł */}
            <div className="pt-1.5 pb-0.5">
              <button
                onClick={() => {
                  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
                    chrome.runtime.openOptionsPage();
                  } else {
                    window.open(chrome.runtime.getURL('src/options/options.html'));
                  }
                }}
                className="w-full py-2 bg-gradient-to-r from-red-950/45 to-rose-950/45 border border-red-900/35 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-lg font-bold text-[11px] transition-all duration-200 flex items-center justify-center gap-1.5 shadow-md shadow-red-950/10"
              >
                <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Zaawansowane reguły (Opcje)
              </button>
            </div>

            {/* Tryb debugowania */}
            {settings.debugMode && (
              <div className="bg-red-950/20 border border-red-500/20 rounded-lg p-3 space-y-2 mb-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-red-400 font-bold text-[11px] block">
                    🐞 Tryb deweloperski (Debug) jest aktywny
                  </span>
                  <button
                    onClick={async () => {
                      const updated = { ...settings, debugMode: false };
                      setSettings(updated);
                      await saveSettings(updated);
                    }}
                    className="px-2 py-1 bg-red-900/50 hover:bg-red-900 border border-red-500/30 text-white rounded text-[10px] font-bold transition-colors"
                  >
                    Wyłącz debug
                  </button>
                </div>
                <p className="text-[9.5px] text-slate-500 leading-relaxed">
                  Tryb debugowania wyświetla Tester Heurystyki w popupie oraz pokazuje wyzwalające reguły i frazy bezpośrednio na zablokowanych postach.
                </p>
              </div>
            )}

            {/* Słownik heurystyki */}
            <div className="space-y-1.5 pt-1 border-t border-slate-900">
              <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider block">
                Słownik heurystyki (przykłady)
              </span>
              <div className="max-h-[90px] overflow-y-auto border border-slate-850 bg-slate-900/20 rounded-lg p-2 space-y-1 pr-1.5 scrollbar-thin">
                {BANNED_PHRASES.slice(0, 8).map((phrase, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-950/50 border border-slate-900 px-2 py-0.5 rounded text-[10px]">
                    <span className="truncate text-slate-400">"{phrase}"</span>
                    <span className="text-[9px] text-red-500/50 font-bold">+20 Pkt</span>
                  </div>
                ))}
                {BANNED_PHRASES.length > 8 && (
                  <p className="text-center text-[9px] text-slate-600 pt-0.5">
                    oraz {BANNED_PHRASES.length - 8} innych fraz...
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tester' && (
          <div className="space-y-3 text-xs flex flex-col flex-1">
            <p className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">
              Wklej podejrzany tekst
            </p>
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Wklej tutaj tekst posta do analizy..."
              className="w-full h-[110px] p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs placeholder-slate-600 focus:outline-none focus:border-red-500/50 resize-none"
            />
            <button
              onClick={() => {
                const res = analyzeText(testText, settings?.sensitivityThreshold);
                const unicodeFormattingRegex = /[\u{1D400}-\u{1D7FF}]/gu;
                const hasUnicode = unicodeFormattingRegex.test(testText);
                const nameChainRegex = /(?:[A-ZĆŁŚÓŻŹĄĘŃ][a-zćłśóżźąęń]+\s+[A-ZĆŁŚÓŻŹĄĘŃ][a-zćłśóżźąęń]+(?:\s*,\s*|\s+)(?:PhD|DSc|PhD,\s*DSc)?\s*){3,}/g;
                const hasNameChain = nameChainRegex.test(testText);
                setTestResult({
                  ...res,
                  hasUnicode,
                  hasNameChain
                });
              }}
              className="w-full py-2 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white rounded-lg font-bold transition-all duration-200 shadow-md shadow-red-900/20"
            >
              Testuj heurystykę
            </button>

            {testResult && (
              <div className="border border-slate-800 bg-slate-900/40 rounded-lg p-3 space-y-2.5 mt-1">
                <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
                  <span className="text-slate-400 font-semibold">Wynik analizy:</span>
                  <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                    testResult.isSlop 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {testResult.isSlop ? '🚨 SLOP / BLOKUJ' : '✅ BEZPIECZNY'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-900/60 p-2 rounded border border-slate-850">
                    <span className="text-slate-500 block">Score:</span>
                    <span className={`font-extrabold text-sm ${testResult.score >= (settings?.sensitivityThreshold ?? 45) ? 'text-red-400' : 'text-emerald-400'}`}>
                      {testResult.score}%
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded border border-slate-850">
                    <span className="text-slate-500 block">Emoji:</span>
                    <span className="font-bold text-slate-200">
                      {testResult.emojiCount} <span className="text-[9px] text-slate-500">({testResult.emojiDensity}%)</span>
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded border border-slate-850">
                    <span className="text-slate-500 block">Formatowanie Unicode:</span>
                    <span className={`font-bold ${testResult.hasUnicode ? 'text-red-400' : 'text-slate-400'}`}>
                      {testResult.hasUnicode ? 'TAK (+40)' : 'NIE'}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded border border-slate-850">
                    <span className="text-slate-500 block">Name-dropping:</span>
                    <span className={`font-bold ${testResult.hasNameChain ? 'text-red-400' : 'text-slate-400'}`}>
                      {testResult.hasNameChain ? 'TAK (+35)' : 'NIE'}
                    </span>
                  </div>
                </div>

                {testResult.matchedPhrases.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Wykryte frazy:</span>
                    <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto pr-1 scrollbar-thin">
                      {testResult.matchedPhrases.map((phrase: string, idx: number) => (
                        <span key={idx} className="bg-red-500/5 border border-red-500/10 text-red-300 text-[9px] px-1.5 py-0.5 rounded">
                          {phrase}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stopka */}
        <div className="mt-6 border-t border-slate-900 pt-3 text-center">
          <p className="text-[9px] text-slate-600 font-semibold">
            Projekt badawczy detekcji treści AI Slop
          </p>
        </div>
      </div>
    </div>
  );
}
