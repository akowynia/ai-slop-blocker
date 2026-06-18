import { DEFAULT_SETTINGS } from './settings';
import type { PluginSettings } from './settings';
import type { BlockedEvent } from './telemetry';

const SETTINGS_KEY = 'slopSettings';
const STATS_KEY = 'slopStats';
const TELEMETRY_KEY = 'slopBlockedEvents';
const CUSTOM_RULES_KEY = 'customRules';
const REMOTE_RULES_KEY = 'remoteRules';
const REMOTE_RULES_LAST_SYNC_KEY = 'remoteRulesLastSync';

export function getLocalDateString(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getStats(): Promise<Record<string, number>> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([STATS_KEY], (result) => {
          resolve(result[STATS_KEY] || {});
        });
      } catch (err) {
        console.error('[AI Slop Blocker] Błąd odczytu statystyk z chrome.storage:', err);
        resolve({});
      }
    });
  } else {
    // Fallback dla środowiska developerskiego
    try {
      const val = localStorage.getItem(STATS_KEY);
      return val ? JSON.parse(val) : {};
    } catch (e) {
      console.error('[AI Slop Blocker] Błąd odczytu statystyk z localStorage:', e);
      return {};
    }
  }
}

export async function incrementStat(): Promise<void> {
  const today = getLocalDateString();
  const stats = await getStats();
  stats[today] = (stats[today] || 0) + 1;

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [STATS_KEY]: stats }, () => {
          resolve();
        });
      } catch (err) {
        console.error('[AI Slop Blocker] Błąd zapisu statystyk do chrome.storage:', err);
        resolve();
      }
    });
  } else {
    // Fallback dla środowiska developerskiego
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {
      console.error('[AI Slop Blocker] Błąd zapisu statystyk do localStorage:', e);
    }
  }
}

export async function getSlopBlockedCount(): Promise<number> {
  const stats = await getStats();
  return Object.values(stats).reduce((sum, val) => sum + val, 0);
}

export async function incrementSlopBlockedCount(): Promise<number> {
  await incrementStat();
  return getSlopBlockedCount();
}

export async function getSettings(): Promise<PluginSettings> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get([SETTINGS_KEY], (result) => {
          resolve(result[SETTINGS_KEY] || DEFAULT_SETTINGS);
        });
      } catch (err) {
        console.error('[AI Slop Blocker] Błąd odczytu ustawień z chrome.storage:', err);
        resolve(DEFAULT_SETTINGS);
      }
    });
  } else {
    // Fallback dla środowiska developerskiego
    const val = localStorage.getItem(SETTINGS_KEY);
    if (val) {
      try {
        return JSON.parse(val) as PluginSettings;
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: PluginSettings): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.set({ [SETTINGS_KEY]: settings }, () => {
          resolve();
        });
      } catch (err) {
        console.error('[AI Slop Blocker] Błąd zapisu ustawień do chrome.storage:', err);
        resolve();
      }
    });
  } else {
    // Fallback dla środowiska developerskiego
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('[AI Slop Blocker] Błąd zapisu ustawień do localStorage:', e);
    }
  }
}

export async function getBlockedEvents(): Promise<BlockedEvent[]> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([TELEMETRY_KEY], (result) => {
          resolve(result[TELEMETRY_KEY] || []);
        });
      } catch (err) {
        console.error('[AI Slop Blocker] Błąd odczytu telemetrii z chrome.storage:', err);
        resolve([]);
      }
    });
  } else {
    try {
      const val = localStorage.getItem(TELEMETRY_KEY);
      return val ? JSON.parse(val) : [];
    } catch (e) {
      console.error('[AI Slop Blocker] Błąd odczytu telemetrii z localStorage:', e);
      return [];
    }
  }
}

export async function addBlockedEvent(event: BlockedEvent): Promise<void> {
  const events = await getBlockedEvents();
  events.push(event);

  // Limit do 5000 najnowszych rekordów, aby uniknąć przepełnienia pamięci storage
  const maxRecords = 5000;
  let updatedEvents = events;
  if (events.length > maxRecords) {
    updatedEvents = events.slice(events.length - maxRecords);
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [TELEMETRY_KEY]: updatedEvents }, () => {
          resolve();
        });
      } catch (err) {
        console.error('[AI Slop Blocker] Błąd zapisu telemetrii do chrome.storage:', err);
        resolve();
      }
    });
  } else {
    try {
      localStorage.setItem(TELEMETRY_KEY, JSON.stringify(updatedEvents));
    } catch (e) {
      console.error('[AI Slop Blocker] Błąd zapisu telemetrii do localStorage:', e);
    }
  }
}

export async function markEventAsOverridden(eventId: string): Promise<void> {
  const events = await getBlockedEvents();
  let changed = false;

  for (const ev of events) {
    if (ev.id === eventId) {
      ev.isOverridden = true;
      changed = true;
      break;
    }
  }

  if (!changed) return;

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [TELEMETRY_KEY]: events }, () => {
          resolve();
        });
      } catch (err) {
        console.error('[AI Slop Blocker] Błąd aktualizacji telemetrii w chrome.storage:', err);
        resolve();
      }
    });
  } else {
    try {
      localStorage.setItem(TELEMETRY_KEY, JSON.stringify(events));
    } catch (e) {
      console.error('[AI Slop Blocker] Błąd aktualizacji telemetrii w localStorage:', e);
    }
  }
}

export async function clearBlockedEvents(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [TELEMETRY_KEY]: [] }, () => {
          resolve();
        });
      } catch (err) {
        console.error('[AI Slop Blocker] Błąd czyszczenia telemetrii w chrome.storage:', err);
        resolve();
      }
    });
  } else {
    try {
      localStorage.setItem(TELEMETRY_KEY, JSON.stringify([]));
    } catch (e) {
      console.error('[AI Slop Blocker] Błąd czyszczenia telemetrii w localStorage:', e);
    }
  }
}

export async function getCustomRules(): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([CUSTOM_RULES_KEY], (result) => {
          resolve(result[CUSTOM_RULES_KEY] || '[]');
        });
      } catch (err) {
        console.error('[AI Slop Blocker] Błąd odczytu customRules z chrome.storage:', err);
        resolve('[]');
      }
    });
  } else {
    return localStorage.getItem(CUSTOM_RULES_KEY) || '[]';
  }
}

export async function saveCustomRules(rulesJson: string): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [CUSTOM_RULES_KEY]: rulesJson }, () => {
          resolve();
        });
      } catch (err) {
        console.error('[AI Slop Blocker] Błąd zapisu customRules do chrome.storage:', err);
        resolve();
      }
    });
  } else {
    try {
      localStorage.setItem(CUSTOM_RULES_KEY, rulesJson);
    } catch (e) {
      console.error('[AI Slop Blocker] Błąd zapisu customRules do localStorage:', e);
    }
  }
}

export async function getRemoteRules(): Promise<any[]> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([REMOTE_RULES_KEY], (result) => {
          resolve(result[REMOTE_RULES_KEY] || []);
        });
      } catch (err) {
        console.error('[AI Slop Blocker] Błąd odczytu remoteRules z chrome.storage:', err);
        resolve([]);
      }
    });
  } else {
    try {
      const val = localStorage.getItem(REMOTE_RULES_KEY);
      return val ? JSON.parse(val) : [];
    } catch (e) {
      return [];
    }
  }
}

export async function saveRemoteRules(rules: any[]): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [REMOTE_RULES_KEY]: rules }, () => {
          resolve();
        });
      } catch (err) {
        console.error('[AI Slop Blocker] Błąd zapisu remoteRules do chrome.storage:', err);
        resolve();
      }
    });
  } else {
    try {
      localStorage.setItem(REMOTE_RULES_KEY, JSON.stringify(rules));
    } catch (e) {
      console.error('[AI Slop Blocker] Błąd zapisu remoteRules do localStorage:', e);
    }
  }
}

export async function getLastSyncTime(): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([REMOTE_RULES_LAST_SYNC_KEY], (result) => {
          resolve(result[REMOTE_RULES_LAST_SYNC_KEY] || '');
        });
      } catch (err) {
        resolve('');
      }
    });
  } else {
    return localStorage.getItem(REMOTE_RULES_LAST_SYNC_KEY) || '';
  }
}

export async function saveLastSyncTime(timeStr: string): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [REMOTE_RULES_LAST_SYNC_KEY]: timeStr }, () => {
          resolve();
        });
      } catch (err) {
        resolve();
      }
    });
  } else {
    try {
      localStorage.setItem(REMOTE_RULES_LAST_SYNC_KEY, timeStr);
    } catch (e) {}
  }
}

