import type { ASBModule } from '../types/module';
import { getSettings } from '../utils/storage';
import type { PluginSettings } from '../utils/settings';

let isPluginEnabled = true;
let isCurrentPageExcluded = false;
let currentSettings: PluginSettings | null = null;

export const pagesModule: ASBModule = {
  id: 'pages',
  name: 'Ostrzeganie stron AI',
  description: 'Analiza i ostrzeganie przed całymi witrynami internetowymi wygenerowanymi przez AI (Wkrótce).',
  isEnabled: () => {
    // Na razie moduł detekcji stron jest wyłączony
    return false;
  },
  init: async () => {
    const settings = await getSettings();
    currentSettings = settings;
    isPluginEnabled = settings.enabled ?? true;
  },
  onSettingsChange: (newSettings: PluginSettings) => {
    currentSettings = newSettings;
    isPluginEnabled = newSettings.enabled ?? true;
  },
  analyze: (node: Element) => {
    // Szkielet metody analyze - w tej fazie nie wykonuje żadnych operacji
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AI Slop Blocker] Page detection module received node:`, node);
    }
  }
};
