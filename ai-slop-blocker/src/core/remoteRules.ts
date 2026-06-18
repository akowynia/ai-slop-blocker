import { saveRemoteRules, saveLastSyncTime } from '../utils/storage';

export interface RemoteRuleJSON {
  phrase: string;
  pattern: string;
  flags?: string;
  weight: number;
}

/**
 * Pobiera zdalne reguły z podanego URL, waliduje ich strukturę i zapisuje do storage.
 * @param url URL do pliku JSON (musi zaczynać się od https://)
 */
export async function fetchRemoteRules(url: string): Promise<RemoteRuleJSON[]> {
  if (!url) {
    throw new Error('URL nie może być pusty.');
  }

  // Wymóg bezpieczeństwa z Faza02.md: Pobieraj zasady tylko przez HTTPS
  if (!url.toLowerCase().startsWith('https://')) {
    throw new Error('Bezpieczeństwo: Reguły mogą być pobierane wyłącznie przez HTTPS.');
  }

  console.log(`[AI Slop Blocker - Remote Rules] Rozpoczęcie pobierania reguł z: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Błąd połączenia: Serwer zwrócił status ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.includes('application/json') && !url.endsWith('.json') && !url.includes('raw')) {
    console.warn('[AI Slop Blocker - Remote Rules] Content-Type odpowiedzi może nie być poprawnym JSON-em:', contentType);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error(`Błąd parsowania JSON: ${(err as Error).message}`);
  }

  // Walidacja struktury
  if (!Array.isArray(data)) {
    throw new Error('Niepoprawny format danych: Główny element musi być tablicą JSON.');
  }

  const validatedRules: RemoteRuleJSON[] = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    
    if (!item || typeof item !== 'object') {
      throw new Error(`Reguła na pozycji ${idxToString(i)}: Element nie jest obiektem.`);
    }

    if (typeof item.phrase !== 'string' || !item.phrase.trim()) {
      throw new Error(`Reguła na pozycji ${idxToString(i)}: Pole "phrase" musi być niepustym ciągiem znaków.`);
    }

    if (typeof item.pattern !== 'string' || !item.pattern.trim()) {
      throw new Error(`Reguła na pozycji ${idxToString(i)} (fraza: "${item.phrase}"): Pole "pattern" musi być niepustym ciągiem znaków.`);
    }

    if (typeof item.weight !== 'number' || isNaN(item.weight)) {
      throw new Error(`Reguła na pozycji ${idxToString(i)} (fraza: "${item.phrase}"): Pole "weight" musi być liczbą.`);
    }

    if (item.flags !== undefined && typeof item.flags !== 'string') {
      throw new Error(`Reguła na pozycji ${idxToString(i)} (fraza: "${item.phrase}"): Pole "flags" (jeśli występuje) musi być ciągiem znaków.`);
    }

    // Dodatkowa walidacja kompilacji wyrażenia regularnego, aby zapobiec crashowaniu orkiestratora
    try {
      new RegExp(item.pattern, item.flags || 'i');
    } catch (regErr) {
      throw new Error(`Reguła na pozycji ${idxToString(i)} (fraza: "${item.phrase}"): Wyrażenie regularne "/${item.pattern}/${item.flags || 'i'}" jest niepoprawne: ${(regErr as Error).message}`);
    }

    validatedRules.push({
      phrase: item.phrase.trim(),
      pattern: item.pattern,
      flags: item.flags,
      weight: item.weight
    });
  }

  // Zapisanie reguł do storage.local
  await saveRemoteRules(validatedRules);
  
  // Zaktualizowanie czasu ostatniej synchronizacji
  const nowStr = new Date().toISOString();
  await saveLastSyncTime(nowStr);

  console.log(`[AI Slop Blocker - Remote Rules] Synchronizacja zakończona sukcesem. Wczytano ${validatedRules.length} reguł.`);
  
  return validatedRules;
}

function idxToString(idx: number): string {
  return `${idx} (indeks 0-based)`;
}
