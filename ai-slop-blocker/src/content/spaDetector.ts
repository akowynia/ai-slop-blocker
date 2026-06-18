(function() {
  // Przechwytujemy oryginalne metody History API w kontekście strony (MAIN world)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    window.dispatchEvent(new CustomEvent('asb-spa-navigation', { detail: 'pushState' }));
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    window.dispatchEvent(new CustomEvent('asb-spa-navigation', { detail: 'replaceState' }));
  };

  // Dodajemy globalne funkcje do włączania/wyłączania trybu debugowania w konsoli strony
  (window as any).asbDebug = function(enable: boolean = true) {
    window.postMessage({ type: 'ASB_TOGGLE_DEBUG', enabled: enable }, '*');
    return `Tryb debugowania AI Slop Blocker został ${enable ? 'aktywowany' : 'deaktywowany'}. Otwórz popup rozszerzenia, aby zobaczyć Tester Heurystyki.`;
  };
  
  (window as any).enableASBDebug = () => (window as any).asbDebug(true);
  (window as any).disableASBDebug = () => (window as any).asbDebug(false);
})();
