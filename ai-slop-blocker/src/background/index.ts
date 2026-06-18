import { incrementSlopBlockedCount, addBlockedEvent, markEventAsOverridden, getSettings } from '../utils/storage';
import { fetchRemoteRules } from '../core/remoteRules';

console.log('[AI Slop Blocker] Service worker zainicjalizowany.');

// Nasłuchiwanie na wiadomości z content scriptu
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'INCREMENT_SLOP_COUNT') {
    incrementSlopBlockedCount()
      .then((newCount) => {
        console.log(`[AI Slop Blocker] Licznik zablokowanych treści zwiększony. Nowa wartość: ${newCount}`);
        sendResponse({ success: true, count: newCount });
      })
      .catch((err) => {
        console.error('[AI Slop Blocker] Błąd przy zwiększaniu licznika w storage:', err);
        sendResponse({ success: false, error: err.toString() });
      });
    return true; // Informuje Chrome, że odpowiedź będzie wysłana asynchronicznie
  }

  if (message.type === 'RECORD_BLOCKED_EVENT') {
    getSettings().then((settings) => {
      if (!settings.enableTelemetry) {
        sendResponse({ success: false, error: 'Telemetria jest wyłączona' });
        return;
      }
      addBlockedEvent(message.event)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((err) => {
          console.error('[AI Slop Blocker] Błąd zapisu telemetrii:', err);
          sendResponse({ success: false, error: err.toString() });
        });
    }).catch((err) => {
      sendResponse({ success: false, error: err.toString() });
    });
    return true;
  }

  if (message.type === 'RECORD_OVERRIDE_EVENT') {
    getSettings().then((settings) => {
      if (!settings.enableTelemetry) {
        sendResponse({ success: false, error: 'Telemetria jest wyłączona' });
        return;
      }
      markEventAsOverridden(message.eventId)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((err) => {
          console.error('[AI Slop Blocker] Błąd nadpisania telemetrii:', err);
          sendResponse({ success: false, error: err.toString() });
        });
    }).catch((err) => {
      sendResponse({ success: false, error: err.toString() });
    });
    return true;
  }
});

// Funkcja synchronizacji zdalnych reguł
async function triggerRemoteRulesSync() {
  try {
    const settings = await getSettings();
    if (settings && settings.remoteRulesUrl) {
      console.log('[AI Slop Blocker - Background] Rozpoczęcie okresowej synchronizacji zdalnych reguł...');
      await fetchRemoteRules(settings.remoteRulesUrl);
      console.log('[AI Slop Blocker - Background] Okresowa synchronizacja reguł zakończona sukcesem.');
    } else {
      console.log('[AI Slop Blocker - Background] Okresowa synchronizacja pominięta: brak skonfigurowanego URL zdalnych zasad.');
    }
  } catch (err) {
    console.error('[AI Slop Blocker - Background] Błąd podczas okresowej synchronizacji reguł:', err);
  }
}

// Inicjalizacja alarmu przy instalacji / aktualizacji rozszerzenia
chrome.runtime.onInstalled.addListener(() => {
  console.log('[AI Slop Blocker - Background] Instalacja wtyczki. Tworzenie cyklicznego alarmu...');
  chrome.alarms.create('sync-remote-rules', {
    periodInMinutes: 24 * 60 // co 24 godziny
  });
  
  // Pierwsze pobranie od razu po instalacji
  triggerRemoteRulesSync();
});

// Zabezpieczenie alarmu przy starcie przeglądarki
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.get('sync-remote-rules', (alarm) => {
    if (!alarm) {
      console.log('[AI Slop Blocker - Background] Odtwarzanie brakującego alarmu przy starcie...');
      chrome.alarms.create('sync-remote-rules', {
        periodInMinutes: 24 * 60
      });
    }
  });
});

// Obsługa wywołania alarmu
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync-remote-rules') {
    console.log('[AI Slop Blocker - Background] Wyzwolono alarm: sync-remote-rules.');
    triggerRemoteRulesSync();
  }
});

