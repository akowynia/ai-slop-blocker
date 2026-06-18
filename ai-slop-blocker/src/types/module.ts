import type { PluginSettings } from '../utils/settings';

export interface ASBModule {
  id: string;
  name: string;
  description?: string;
  isEnabled: () => boolean;
  analyze: (node: Element) => void;
  
  // Opcjonalne metody cyklu życia modułu
  init?: () => Promise<void> | void;
  onUrlChange?: (url: string) => Promise<void> | void;
  onSettingsChange?: (settings: PluginSettings) => Promise<void> | void;
}
