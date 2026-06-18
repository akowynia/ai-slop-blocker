import { analyzeText } from '../utils/analyzer';
import { getSettings, saveSettings } from '../utils/storage';
import type { PluginSettings } from '../utils/settings';
import type { ASBModule } from '../types/module';

// Zmienne stanu modułu
let currentSettings: PluginSettings | null = null;
let isPluginEnabled = true;
let isCurrentPageExcluded = false;
let isDebugMode = false;

const activeOverlays = new Map<HTMLElement, HTMLElement>();
const activeWhitelistBadges = new Map<HTMLElement, HTMLElement>();

function cleanupDisconnectedOverlaysAndBadges() {
  let cleanedOverlays = 0;
  activeOverlays.forEach((overlay, target) => {
    if (!target.isConnected || !overlay.isConnected || !target.contains(overlay)) {
      try { overlay.remove(); } catch (e) {}
      activeOverlays.delete(target);
      cleanedOverlays++;
    }
  });

  let cleanedBadges = 0;
  activeWhitelistBadges.forEach((badge, target) => {
    if (!target.isConnected || !badge.isConnected || !target.contains(badge)) {
      try { badge.remove(); } catch (e) {}
      activeWhitelistBadges.delete(target);
      cleanedBadges++;
    }
  });

  if (cleanedOverlays > 0 || cleanedBadges > 0) {
    console.log(`[AI Slop Blocker - Posts] Oczyszczono nieaktywne elementy: nakładki=${cleanedOverlays}, plakietki=${cleanedBadges}`);
  }
}

const pendingElements = new Set<Element>();
let isAnalysisScheduled = false;
const layoutRetries = new WeakMap<Element, number>();

interface AnalysisResult {
  text: string;
  isSlop: boolean;
  score: number;
  matchedPhrases?: string[];
  emojiCount?: number;
  emojiDensity?: number;
}

// WeakMap przechowujący wyniki analizy elementu
let analyzedTexts = new WeakMap<Element, AnalysisResult>();

let pageHasShadowRoots = false;
let checkedForShadowRoots = false;

function checkForShadowRoots(): boolean {
  if (checkedForShadowRoots) return pageHasShadowRoots;
  checkedForShadowRoots = true;
  try {
    const all = document.body.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        pageHasShadowRoots = true;
        break;
      }
    }
  } catch (e) {
    pageHasShadowRoots = false;
  }
  return pageHasShadowRoots;
}

function removeWhitelistBadge(target: HTMLElement) {
  const badge = activeWhitelistBadges.get(target);
  if (badge) {
    badge.remove();
    activeWhitelistBadges.delete(target);
  }
}

function markAsWhitelisted(target: HTMLElement) {
  if (!isContextValid()) return;
  if (activeWhitelistBadges.has(target)) return;

  const style = window.getComputedStyle(target);
  if (style.position === 'static') {
    target.style.setProperty('position', 'relative', 'important');
  }

  const styleId = 'asb-whitelist-badge-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.innerHTML = `
      asb-whitelist-badge {
        position: absolute !important;
        top: 12px !important;
        right: 12px !important;
        z-index: 999 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 28px !important;
        height: 28px !important;
        background: rgba(16, 185, 129, 0.1) !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
        border: 1px solid rgba(16, 185, 129, 0.3) !important;
        border-radius: 50% !important;
        cursor: pointer !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        box-shadow: 0 4px 10px rgba(16, 185, 129, 0.1) !important;
        overflow: hidden !important;
        padding: 0 !important;
      }
      
      asb-whitelist-badge:hover {
        width: 105px !important;
        border-radius: 14px !important;
        background: rgba(16, 185, 129, 0.2) !important;
        border-color: rgba(16, 185, 129, 0.6) !important;
        box-shadow: 0 6px 14px rgba(16, 185, 129, 0.2) !important;
        padding: 0 8px !important;
      }

      asb-whitelist-badge svg {
        min-width: 14px !important;
        width: 14px !important;
        height: 14px !important;
        fill: none !important;
        stroke: #10b981 !important;
        stroke-width: 2.5 !important;
        stroke-linecap: round !important;
        stroke-linejoin: round !important;
        transition: transform 0.3s ease !important;
      }

      asb-whitelist-badge:hover svg {
        transform: scale(1.1) !important;
      }

      .asb-whitelist-badge-text {
        opacity: 0 !important;
        max-width: 0 !important;
        white-space: nowrap !important;
        color: #10b981 !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
        margin-left: 0px !important;
        transition: opacity 0.2s ease, max-width 0.3s ease, margin-left 0.2s ease !important;
        overflow: hidden !important;
      }

      asb-whitelist-badge:hover .asb-whitelist-badge-text {
        opacity: 1 !important;
        max-width: 80px !important;
        margin-left: 6px !important;
      }
    `;
    document.head.appendChild(styleEl);
  }

  const badge = document.createElement('asb-whitelist-badge');
  badge.className = 'asb-whitelist-badge';
  badge.setAttribute('title', 'Autor z białej listy');

  badge.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      <path d="m9 11 2 2 4-4"></path>
    </svg>
    <span class="asb-whitelist-badge-text">Biała lista</span>
  `;

  badge.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  target.appendChild(badge);
  activeWhitelistBadges.set(target, badge);
}

function checkPageExclusion(settings: PluginSettings): boolean {
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

let cachedHeaderBottom = 0;
let cachedFooterTop = typeof window !== 'undefined' ? window.innerHeight : 1000;
let lastCacheTime = 0;

function updateHeaderFooterCache() {
  const now = performance.now();
  if (now - lastCacheTime < 250) return;
  lastCacheTime = now;

  if (typeof document === 'undefined') return;

  const headers = Array.from(document.querySelectorAll('header, nav, [role="banner"], .global-nav, #global-nav')).filter(el => {
    const style = window.getComputedStyle(el);
    return (style.position === 'fixed' || style.position === 'sticky') && el.getBoundingClientRect().top <= 5;
  });
  
  let headerBottom = 0;
  headers.forEach(h => {
    const r = h.getBoundingClientRect();
    if (r.bottom > headerBottom && r.bottom < window.innerHeight / 3) {
      headerBottom = r.bottom;
    }
  });

  const footers = Array.from(document.querySelectorAll('footer, [role="contentinfo"]')).filter(el => {
    const style = window.getComputedStyle(el);
    return (style.position === 'fixed' || style.position === 'sticky') && el.getBoundingClientRect().bottom >= window.innerHeight - 5;
  });

  let footerTop = window.innerHeight;
  footers.forEach(f => {
    const r = f.getBoundingClientRect();
    if (r.top < footerTop && r.top > (window.innerHeight * 2) / 3) {
      footerTop = r.top;
    }
  });

  cachedHeaderBottom = headerBottom;
  cachedFooterTop = footerTop;
}

// Usunięto pętlę animacji syncOverlays - pozycjonowanie realizowane jest natywnie przez przeglądarkę dzięki absolute/relative

const ANALYZED_ATTR = 'data-slop-analyzed';
const BLOCKED_CLASS = 'asb-blocked-container';
const OVERLAY_CLASS = 'asb-overlay-host';

function getElementTextWithNewlines(el: Element): string {
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue || '';
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tag = element.tagName;
      if (tag === 'BR') {
        return '\n';
      }
      if (tag === 'P' || tag === 'DIV' || tag === 'LI' || tag === 'BLOCKQUOTE') {
        let childText = '';
        const children = element.childNodes;
        for (let i = 0; i < children.length; i++) {
          childText += walk(children[i]);
        }
        return '\n' + childText + '\n';
      }
    }
    let childText = '';
    const children = node.childNodes;
    for (let i = 0; i < children.length; i++) {
      childText += walk(children[i]);
    }
    return childText;
  };

  return walk(el).replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function isContextValid(): boolean {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      return true;
    }
    return !!chrome.runtime.getManifest();
  } catch (e) {
    return false;
  }
}

const CONTAINER_SELECTOR = [
  'span[dir="ltr"]',
  'p[dir="ltr"]',
  '.break-words',
  '[data-urn] span[dir]',
  '[data-urn] p',
  'article p',
  'article span[dir]',
  'div[class*="update"] p',
  'div[class*="update"] span[dir]',
  'div[class*="feed"] p',
  'div[class*="feed"] span[dir]',
  'div[class*="commentary"] p',
  'div[class*="commentary"] span[dir]',
].join(', ');

function isOurElement(el: Element): boolean {
  if (
    el.classList.contains(OVERLAY_CLASS) ||
    el.classList.contains('asb-floating-overlay') ||
    el.classList.contains('asb-whitelist-badge')
  ) {
    return true;
  }

  if (
    el.id === 'asb-global-tooltip' ||
    el.id === 'asb-csr-reload-notification'
  ) {
    return true;
  }

  if (
    el.closest(`.${OVERLAY_CLASS}`) !== null ||
    el.closest('.asb-floating-overlay') !== null ||
    el.closest('.asb-whitelist-badge') !== null ||
    el.closest('#asb-global-tooltip') !== null ||
    el.closest('#asb-csr-reload-notification') !== null
  ) {
    return true;
  }

  return false;
}

function shouldCardBeBlocked(card: HTMLElement): { 
  isSlop: boolean; 
  score: number; 
  matchedPhrases: string[];
  textLength: number;
  emojiCount: number;
  emojiDensity: number;
} {
  const containers = findTextContainers(card);
  let maxScore = 0;
  let allMatchedPhrases: string[] = [];
  let hasSlop = false;
  let textLength = 0;
  let emojiCount = 0;
  let emojiDensity = 0;

  const updateMetrics = (analysis: any) => {
    if (analysis.score > maxScore) {
      maxScore = analysis.score;
      textLength = (analysis.text || '').length;
      emojiCount = analysis.emojiCount || 0;
      emojiDensity = analysis.emojiDensity || 0;
    }
  };

  for (const el of containers) {
    const analysis = analyzedTexts.get(el);
    if (analysis && analysis.isSlop) {
      hasSlop = true;
      updateMetrics(analysis);
      if (analysis.matchedPhrases) {
        allMatchedPhrases.push(...analysis.matchedPhrases);
      }
    }
  }

  const cardAnalysis = analyzedTexts.get(card);
  if (cardAnalysis && cardAnalysis.isSlop) {
    hasSlop = true;
    updateMetrics(cardAnalysis);
    if (cardAnalysis.matchedPhrases) {
      allMatchedPhrases.push(...cardAnalysis.matchedPhrases);
    }
  }

  return {
    isSlop: hasSlop,
    score: maxScore,
    matchedPhrases: Array.from(new Set(allMatchedPhrases)),
    textLength,
    emojiCount,
    emojiDensity
  };
}

function isPageOrPostWhitelisted(element: Element, whitelistAuthors: string[]): boolean {
  if (whitelistAuthors && whitelistAuthors.length > 0) {
    const authorElements = findAuthorElements(element);
    for (const el of authorElements) {
      const text = (el.textContent || '').trim();
      if (!text) continue;
      
      for (const allowed of whitelistAuthors) {
        const allowedLower = allowed.toLowerCase().trim();
        if (allowedLower && text.toLowerCase().includes(allowedLower)) {
          return true;
        }
      }
    }

    const links = findProfileLinks(element);
    for (const link of links) {
      const href = (link.getAttribute('href') || '').toLowerCase();
      if (href) {
        for (const allowed of whitelistAuthors) {
          const allowedLower = allowed.toLowerCase().trim();
          if (allowedLower && href.includes(allowedLower)) {
            console.log(`[AI Slop Blocker - Posts] Whitelist hit (href match): "${allowed}" in href="${href}"`);
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

function shouldSkipElement(el: Element): boolean {
  if (isOurElement(el)) return true;

  if (el.closest('header, nav, footer, aside, [role="banner"], [role="navigation"], [role="contentinfo"]')) {
    return true;
  }

  if (el.closest('[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"], [class*="privacy"], [id*="privacy"], [class*="banner-consent"]')) {
    return true;
  }

  if (el.closest('form, [class*="login"], [id*="login"], [class*="signup"], [id*="signup"], [class*="signin"], [id*="signin"]')) {
    return true;
  }

  return false;
}

function findTextContainers(root: Element): Element[] {
  const containers: Element[] = [];

  if (root.matches(CONTAINER_SELECTOR) && !shouldSkipElement(root)) {
    containers.push(root);
  }

  const elements = root.querySelectorAll(CONTAINER_SELECTOR);
  elements.forEach(el => {
    if (!shouldSkipElement(el)) {
      containers.push(el);
    }
  });

  return containers;
}

function findPostLevelParent(el: Element): Element | null {
  let parent = el.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    if (shouldSkipElement(parent)) return null;
    const tag = parent.tagName;
    if (tag === 'MAIN' || tag === 'NAV' || tag === 'HEADER' || tag === 'FOOTER' || tag === 'ASIDE') return null;

    const parentText = (parent.textContent || '').trim();
    if (parentText.length > 5000) return null;
    if (parentText.length >= 500) return parent;

    parent = parent.parentElement;
  }
  return null;
}

function getPostCard(el: Element): HTMLElement {
  const htmlEl = el as HTMLElement;

  const comment = htmlEl.closest('.comments-comment-item, [class*="comment-item"], .comment, [class*="comment-content"]');
  if (comment) return comment as HTMLElement;

  const card = htmlEl.closest('article, [role="article"], [class*="feed-shared-update"], [class*="feed-update"], [class*="post-layout"]');
  if (card) {
    const textLength = (card.textContent || '').trim().length;
    if (textLength < 6000) {
      return card as HTMLElement;
    }
  }

  const postParent = findPostLevelParent(htmlEl);
  if (postParent) return postParent as HTMLElement;

  return htmlEl;
}

function getElementToBlock(targetCard: HTMLElement, originalTextEl: Element): HTMLElement {
  const rect = targetCard.getBoundingClientRect();
  
  if (rect.width === 0 || rect.height === 0) {
    return (originalTextEl as HTMLElement) || targetCard;
  }

  const childCards = Array.from(targetCard.querySelectorAll('article, [role="article"], [class*="feed-shared-update"], [class*="feed-update"], [class*="post-layout"]'))
    .filter(child => child !== targetCard)
    .filter(child => !child.closest('.comments-comment-item, [class*="comment-item"], .comment, [class*="comment-content"], [class*="comments-container"], [class*="comments-section"]'));

  const isTooLarge = rect.width > 900 || rect.height > 1200 || 
                     (rect.width > window.innerWidth * 0.8 && window.innerWidth > 0) || 
                     (rect.height > window.innerHeight * 0.9 && window.innerHeight > 0) ||
                     (childCards.length > 0 && (rect.width > 800 || rect.height > 800));

  if (isTooLarge) {
    console.warn(`[AI Slop Blocker - Posts] Wykryto próbę zablokowania zbyt dużego elementu (width=${Math.round(rect.width)}, height=${Math.round(rect.height)}, childCards=${childCards.length}). Używam kontenera tekstowego jako fallback.`);
    return (originalTextEl as HTMLElement) || targetCard;
  }

  return targetCard;
}

function findTextContainersDeep(root: Element): Element[] {
  const containers = new Set<Element>();
  const candidates = root.querySelectorAll('p, span[class], article, [role="article"], div[class]');
  candidates.forEach(el => {
    if (shouldSkipElement(el)) return;
    const tag = el.tagName;
    if (tag === 'NAV' || tag === 'HEADER' || tag === 'FOOTER' || tag === 'ASIDE' || tag === 'SCRIPT' || tag === 'STYLE') return;
    const text = (el.textContent || '').trim();
    if (text.length < 70) return;
    if (text.length > 5000) return;
    if (el.matches(CONTAINER_SELECTOR)) return;

    if (text.length >= 500) {
      containers.add(el);
    } else {
      const postParent = findPostLevelParent(el);
      if (postParent) {
        containers.add(postParent);
      } else {
        containers.add(el);
      }
    }
  });
  return Array.from(containers);
}

function getClosestContainer(node: Node): Element | null {
  let el: Node | null = node;
  if (el.nodeType !== Node.ELEMENT_NODE) {
    el = el.parentNode;
  }
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;

  const element = el as Element;

  if (shouldSkipElement(element)) {
    return null;
  }

  if (element.matches(CONTAINER_SELECTOR)) {
    return element;
  }

  const closest = element.closest(CONTAINER_SELECTOR);
  if (closest && !shouldSkipElement(closest)) {
    return closest;
  }
  return null;
}

function collectContainersFromNode(node: Node): void {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    if (shouldSkipElement(el)) return;
    const containers = findTextContainers(el);
    containers.forEach(c => pendingElements.add(c));

    const parentContainer = getClosestContainer(el);
    if (parentContainer) {
      pendingElements.add(parentContainer);
    }

    if (containers.length === 0) {
      const deepContainers = findTextContainersDeep(el);
      deepContainers.forEach(c => pendingElements.add(c));
    }
  } else {
    const container = getClosestContainer(node);
    if (container) pendingElements.add(container);
  }
}

async function processQueue() {
  isAnalysisScheduled = false;

  if (!isContextValid()) {
    pendingElements.clear();
    return;
  }

  const settings = currentSettings || await getSettings();
  isPluginEnabled = settings.enabled ?? true;
  isCurrentPageExcluded = checkPageExclusion(settings);
  isDebugMode = settings.debugMode ?? false;
  if (isPluginEnabled === false || isCurrentPageExcluded) {
    pendingElements.clear();
    unblockAll();
    return;
  }

  cleanupDisconnectedOverlaysAndBadges();

  let blockedCount = 0;
  let dropDisconnected = 0;
  let dropOurElement = 0;
  let dropParentBlocked = 0;
  let dropTooShort = 0;
  let dropRevealed = 0;
  let dropSubContainer = 0;
  let dropRevealedParent = 0;
  let analyzedClean = 0;
  let analyzedSlop = 0;
  let totalProcessed = 0;

  pendingElements.forEach((el) => {
    pendingElements.delete(el);
    totalProcessed++;

    try {
      if (!el.isConnected) { dropDisconnected++; return; }
      if (shouldSkipElement(el)) { dropOurElement++; return; }

      const cleanText = getElementTextWithNewlines(el);
      const lastAnalyzedState = analyzedTexts.get(el);
      const targetCard = getPostCard(el);
      
      // Obsługa elementów 0x0 (brak wyrenderowanego layoutu na starcie)
      const rect = targetCard.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        const retries = layoutRetries.get(el) || 0;
        if (retries < 5) {
          layoutRetries.set(el, retries + 1);
          setTimeout(() => {
            pendingElements.add(el);
            scheduleAnalysis();
          }, 150);
          return;
        }
      }

      const blockTarget = getElementToBlock(targetCard, el);

      // Sprawdzenie zmiany tekstu - jeśli tekst uległ zmianie (recycling DOM), musimy zresetować stan blokady
      const textChanged = !lastAnalyzedState || lastAnalyzedState.text !== cleanText;
      if (textChanged) {
        el.removeAttribute('data-slop-revealed');
        blockTarget.removeAttribute('data-slop-revealed');
        if (targetCard !== blockTarget) targetCard.removeAttribute('data-slop-revealed');
        removeWhitelistBadge(blockTarget);
        if (targetCard !== blockTarget) removeWhitelistBadge(targetCard);
      }

      // Sprawdzamy, czy jakikolwiek przodek elementu jest już zablokowany.
      // Jeśli tak, bezwarunkowo pomijamy analizę, ponieważ element jest już zasłonięty nakładką rodzica.
      if (el.parentElement && el.parentElement.closest('[data-asb-blocked="true"]')) {
        analyzedTexts.set(el, { text: cleanText, isSlop: false, score: -1 });
        dropParentBlocked++;
        return;
      }

      if (cleanText.length < 70) {
        analyzedTexts.set(el, { text: cleanText, isSlop: false, score: -1 });
        dropTooShort++;
        return;
      }

      if (isPageOrPostWhitelisted(el, settings.whitelistAuthors || [])) {
        unblockElement(blockTarget);
        if (targetCard !== blockTarget) unblockElement(targetCard);
        markAsWhitelisted(blockTarget);
        analyzedTexts.set(el, { text: cleanText, isSlop: false, score: -2 });
        return;
      }

      if (isAuthorWhitelisted(el, settings.authorWhitelist || [])) {
        unblockElement(blockTarget);
        if (targetCard !== blockTarget) unblockElement(targetCard);
        markAsWhitelisted(blockTarget);
        analyzedTexts.set(el, { text: cleanText, isSlop: false, score: -3 });
        return;
      }

      if (el.getAttribute('data-slop-revealed') === 'true' || 
          blockTarget.getAttribute('data-slop-revealed') === 'true' || 
          targetCard.getAttribute('data-slop-revealed') === 'true') {
        if (textChanged) {
          el.removeAttribute('data-slop-revealed');
          blockTarget.removeAttribute('data-slop-revealed');
          if (targetCard !== blockTarget) targetCard.removeAttribute('data-slop-revealed');
        } else {
          dropRevealed++;
          return;
        }
      }

      const subContainers = Array.from(el.querySelectorAll(CONTAINER_SELECTOR)).filter(child => {
        return !child.classList.contains('asb-overlay-host') && (child.textContent || '').trim().length > 70;
      });

      if (subContainers.length > 0) {
        subContainers.forEach(sub => {
          const cached = analyzedTexts.get(sub);
          const currentText = getElementTextWithNewlines(sub);
          if (!cached || cached.text !== currentText) {
            pendingElements.add(sub);
          }
        });
        analyzedTexts.set(el, { text: cleanText, isSlop: false, score: -1 });
        dropSubContainer++;
        return;
      }

      if (el.closest('[data-slop-revealed="true"]')) {
        dropRevealedParent++;
        return;
      }

      const lastAnalyzed = lastAnalyzedState;
      if (lastAnalyzed && lastAnalyzed.text === cleanText) {
        const cardStatus = shouldCardBeBlocked(targetCard);
        if (cardStatus.isSlop) {
          blockElement(
            blockTarget,
            cardStatus.score,
            settings.hideSlopCompletely || false,
            cardStatus.matchedPhrases,
            cardStatus.textLength,
            cardStatus.emojiCount,
            cardStatus.emojiDensity
          );
        } else {
          unblockElement(blockTarget);
          if (targetCard !== blockTarget) unblockElement(targetCard);
        }
        return;
      }

      const analysis = analyzeText(cleanText, settings.sensitivityThreshold);
      analyzedTexts.set(el, { 
        text: cleanText, 
        isSlop: analysis.isSlop, 
        score: analysis.score, 
        matchedPhrases: analysis.matchedPhrases,
        emojiCount: analysis.emojiCount,
        emojiDensity: analysis.emojiDensity
      });
      el.setAttribute(ANALYZED_ATTR, 'true');

      const cardStatus = shouldCardBeBlocked(targetCard);
      if (cardStatus.isSlop) {
        blockedCount++;
        analyzedSlop++;
        blockElement(
          blockTarget,
          cardStatus.score,
          settings.hideSlopCompletely || false,
          cardStatus.matchedPhrases,
          cardStatus.textLength,
          cardStatus.emojiCount,
          cardStatus.emojiDensity
        );
      } else {
        analyzedClean++;
        if (cleanText.length >= 200) {
          const tag = el.tagName.toLowerCase();
          const cls = (el as HTMLElement).className?.toString().substring(0, 80) || '';
          const textPreview = cleanText.substring(0, 120).replace(/\n/g, ' ');
          console.log(`[AI Slop Blocker - Posts] DIAG clean: <${tag} class="${cls}"> len=${cleanText.length} score=${analysis.score} text="${textPreview}..."`);
        }
        unblockElement(blockTarget);
        if (targetCard !== blockTarget) unblockElement(targetCard);
      }
    } catch (err) {
      console.error('[AI Slop Blocker - Posts] processQueue error:', err);
    }
  });

  if (blockedCount > 0) {
    console.log(`[AI Slop Blocker - Posts] Zablokowano ${blockedCount} nowych elementów.`);
  }

  if (totalProcessed > 0) {
    const parts: string[] = [];
    if (analyzedSlop > 0) parts.push(`slop=${analyzedSlop}`);
    if (analyzedClean > 0) parts.push(`clean=${analyzedClean}`);
    if (dropSubContainer > 0) parts.push(`skip:subContainer=${dropSubContainer}`);
    if (dropTooShort > 0) parts.push(`skip:short=${dropTooShort}`);
    if (dropDisconnected > 0) parts.push(`skip:disconnected=${dropDisconnected}`);
    if (dropRevealed > 0) parts.push(`skip:revealed=${dropRevealed}`);
    if (dropRevealedParent > 0) parts.push(`skip:revealedParent=${dropRevealedParent}`);
    if (dropParentBlocked > 0) parts.push(`skip:parentBlocked=${dropParentBlocked}`);
    if (dropOurElement > 0) parts.push(`skip:ourElement=${dropOurElement}`);
    if (parts.length > 0) {
      console.log(`[AI Slop Blocker - Posts] processQueue(${totalProcessed}): ${parts.join(', ')}`);
    }
  }
}

function scheduleAnalysis() {
  if (isAnalysisScheduled) return;

  isAnalysisScheduled = true;
  setTimeout(processQueue, 40);
}

function fullBodyRescan() {
  if (!document.body) return;
  const containers = findTextContainers(document.body);
  const newOrChanged = containers.filter(el => {
    const cached = analyzedTexts.get(el);
    if (!cached) return true;
    const currentText = getElementTextWithNewlines(el);
    return cached.text !== currentText;
  });
  if (newOrChanged.length > 0) {
    console.log(`[AI Slop Blocker - Posts] fullBodyRescan: znaleziono ${newOrChanged.length} NOWYCH kontenerów (z ${containers.length} total)`);
    newOrChanged.forEach(el => pendingElements.add(el));
    scheduleAnalysis();
  }
}

function deepBodyRescan() {
  if (!document.body) return;
  const containers = findTextContainersDeep(document.body);

  const shadowContainers: Element[] = [];
  if (checkForShadowRoots()) {
    try {
      const allElements = document.body.querySelectorAll('*');
      allElements.forEach(el => {
        if (el.shadowRoot) {
          const innerContainers = findTextContainersDeep(el.shadowRoot as unknown as Element);
          shadowContainers.push(...innerContainers);
          const innerStandard = findTextContainers(el.shadowRoot as unknown as Element);
          shadowContainers.push(...innerStandard);
        }
      });
      if (shadowContainers.length > 0) {
        console.log(`[AI Slop Blocker - Posts] SHADOW DOM: znaleziono ${shadowContainers.length} kontenerów w shadow roots!`);
      }
    } catch(e) { /* ignore */ }
  }

  const allContainers = [...containers, ...shadowContainers];

  const newOrChanged = allContainers.filter(el => {
    const cached = analyzedTexts.get(el);
    if (!cached) return true;
    const currentText = getElementTextWithNewlines(el);
    return cached.text !== currentText;
  });
  if (newOrChanged.length > 0) {
    console.log(`[AI Slop Blocker - Posts] deepRescan: znaleziono ${newOrChanged.length} NOWYCH/ZMIENIONYCH kontenerów (deep=${containers.length}, shadow=${shadowContainers.length})`);
    newOrChanged.forEach(el => pendingElements.add(el));
    scheduleAnalysis();
  }
}

function triggerFullRescan(reason: string) {
  console.log(`[AI Slop Blocker - Posts] Pełne skanowanie: ${reason}`);

  if (typeof document !== 'undefined') {
    document.querySelectorAll('[data-slop-revealed="true"]').forEach(el => {
      el.removeAttribute('data-slop-revealed');
    });
  }

  analyzedTexts = new WeakMap<Element, AnalysisResult>();
  checkedForShadowRoots = false;
  pageHasShadowRoots = false;

  activeOverlays.forEach((overlay, target) => {
    if (!target.isConnected) {
      overlay.remove();
      activeOverlays.delete(target);
    }
  });

  fullBodyRescan();
}

function showCsrReloadNotification() {
  if (typeof document === 'undefined') return;

  const styleId = 'asb-animation-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      @keyframes asb-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  const notification = document.createElement('div');
  notification.id = 'asb-csr-reload-notification';
  notification.style.cssText = `
    position: fixed !important;
    bottom: 24px !important;
    right: 24px !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    background: rgba(30, 41, 59, 0.95) !important;
    backdrop-filter: blur(8px) !important;
    -webkit-backdrop-filter: blur(8px) !important;
    color: #ffffff !important;
    border: 1px solid rgba(239, 68, 68, 0.5) !important;
    border-left: 4px solid #ef4444 !important;
    border-radius: 8px !important;
    padding: 12px 16px !important;
    font-family: system-ui, -apple-system, sans-serif !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1) !important;
    transition: opacity 0.3s ease, transform 0.3s ease !important;
    opacity: 0 !important;
    transform: translateY(10px) !important;
  `;

  const icon = document.createElement('span');
  icon.innerText = '🔄';
  icon.style.cssText = `
    display: inline-block !important;
    animation: asb-spin 2s linear infinite !important;
    font-size: 16px !important;
  `;

  const textNode = document.createElement('span');
  textNode.innerText = 'Działanie CSR: Wykryto niedorenderowanie strony. Przeładowuję dla pełnego skanowania...';

  notification.appendChild(icon);
  notification.appendChild(textNode);
  document.body.appendChild(notification);

  requestAnimationFrame(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
  });
}

async function scheduleCSRContentGapCheck() {
  try {
    const settings = currentSettings || await getSettings();
    if (settings && (settings.enabled === false || checkPageExclusion(settings))) {
      console.log('[AI Slop Blocker - Posts] Wtyczka wyłączona lub strona wykluczona - pomijanie sprawdzania CSR.');
      return;
    }
    if (settings && settings.enableSpaMode === false) {
      console.log('[AI Slop Blocker - Posts] Tryb detekcji SPA (autoczyszczenie CSR) jest wyłączony.');
      return;
    }
  } catch (err) {
    return;
  }

  setTimeout(() => {
    if (!document.body) return;

    const containers = findTextContainers(document.body);

    const allEls = document.body.querySelectorAll('*');
    let contentLeaves = 0;
    allEls.forEach(el => {
      if (isOurElement(el)) return;
      const text = (el.textContent || '').trim();
      if (text.length >= 200 && text.length <= 5000) {
        const hasChildWithText = Array.from(el.children).some(c =>
          (c.textContent || '').trim().length >= 200
        );
        if (!hasChildWithText) contentLeaves++;
      }
    });

    if (contentLeaves > 10 && containers.length <= 5) {
      const reloadKey = `asb-csr-reload:${location.href}`;
      try {
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, '1');
          console.log(`[AI Slop Blocker - Posts] Wykryto niedorenderowanie strony (elementy tekstowe: ${contentLeaves}, dopasowane kontenery: ${containers.length}). Przeładowuję.`);
          showCsrReloadNotification();
          setTimeout(() => {
            location.reload();
          }, 1500);
        }
      } catch(e) { /* sessionStorage niedostępne */ }
    }
  }, 3000);
}



let isEventDelegationInitialized = false;

function initializeEventDelegation() {
  if (isEventDelegationInitialized) return;
  isEventDelegationInitialized = true;

  console.log('[AI Slop Blocker - Posts] Inicjalizacja globalnej delegacji zdarzeń');

  // Wstrzyknięcie globalnych stylów dla nakładek (glassmorphism i hover effects)
  const styleId = 'asb-overlay-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.innerHTML = `
      asb-overlay {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 99999 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: rgba(241, 245, 249, 0.4) !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
        border: 1px dashed rgba(148, 163, 184, 0.4) !important;
        cursor: pointer !important;
        transition: background-color 0.3s ease, border-color 0.3s ease !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 16px !important;
      }
      
      asb-overlay:hover {
        background: rgba(241, 245, 249, 0.5) !important;
        border-color: rgba(148, 163, 184, 0.6) !important;
      }
      
      asb-badge {
        display: inline-flex !important;
        align-items: center !important;
        gap: 10px !important;
        background: #1e293b !important;
        color: #f8fafc !important;
        padding: 6px 6px 6px 14px !important;
        border-radius: 9999px !important;
        font-weight: 500 !important;
        font-size: 13px !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        text-align: left !important;
        white-space: nowrap !important;
        max-width: 95% !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease !important;
        pointer-events: auto !important;
      }
      
      asb-overlay:hover asb-badge {
        transform: scale(1.02) !important;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2) !important;
      }

      asb-btn-show {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: #ef4444 !important;
        color: #ffffff !important;
        border: none !important;
        border-radius: 9999px !important;
        padding: 5px 12px !important;
        font-size: 11px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: background-color 0.2s ease, transform 0.2s ease !important;
        white-space: nowrap !important;
        line-height: 1.2 !important;
        margin-left: 4px !important;
      }
      
      asb-btn-show:hover {
        background: #dc2626 !important;
        transform: scale(1.05) !important;
      }
      
      asb-btn-show:active {
        transform: scale(0.95) !important;
      }
    `;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as Element;
    if (!target) return;

    const blockedParent = target.closest('[data-asb-blocked="true"]');
    if (blockedParent) {
      e.stopPropagation();
      e.preventDefault();

      let curr: Element | null = blockedParent;
      while (curr && curr !== document.body && curr !== document.documentElement) {
        const tagName = curr.tagName.toLowerCase();
        if (tagName === 'main' || tagName === 'header' || tagName === 'nav' || tagName === 'aside') {
          break;
        }
        curr.setAttribute('data-slop-revealed', 'true');
        curr = curr.parentElement;
      }

      const eventId = blockedParent.getAttribute('data-asb-event-id');
      if (eventId && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        try { chrome.runtime.sendMessage({ type: 'RECORD_OVERRIDE_EVENT', eventId }, () => {}); } catch (err) {}
      }

      unblockElement(blockedParent);

      // Odblokuj i oznacz jako odsłonięte wszystkie zablokowane elementy podrzędne
      blockedParent.querySelectorAll('[data-asb-blocked="true"]').forEach(child => {
        unblockElement(child as HTMLElement);
        child.setAttribute('data-slop-revealed', 'true');
      });
    }
  }, true);
}

function blockElement(
  element: Element,
  score: number,
  hideSlopCompletely: boolean = false,
  matchedPhrases: string[] = [],
  textLength: number = 0,
  emojiCount: number = 0,
  emojiDensity: number = 0
) {
  if (!isContextValid()) return;
  const target = element as HTMLElement;
  removeWhitelistBadge(target);

  // Usuń nakładki ze wszystkich potomków (dzieci), ponieważ nowa nakładka na rodzicu i tak ich zasłoni
  target.querySelectorAll('[data-asb-blocked="true"]').forEach(child => {
    unblockElement(child as HTMLElement);
  });

  // Wymuś relative na kontenerze posta, jeśli jest static
  const style = window.getComputedStyle(target);
  if (style.position === 'static') {
    target.style.setProperty('position', 'relative', 'important');
  }

  let eventId = target.getAttribute('data-asb-event-id');
  if (!eventId) {
    eventId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    target.setAttribute('data-asb-event-id', eventId);
  }

  if (target.getAttribute('data-asb-blocked') === 'true') {
    if (hideSlopCompletely) {
      if (target.style.display === 'none') {
        return;
      }
      target.style.setProperty('display', 'none', 'important');
      return;
    } else {
      const existingOverlay = activeOverlays.get(target);
      if (existingOverlay && existingOverlay.isConnected && target.contains(existingOverlay)) {
        // Zaktualizuj wysokość istniejącej nakładki, jeśli pozycja komentarzy się zmieniła
        const commentsEl = target.querySelector('.comments-comment-item, [class*="comment-item"], .comment, [class*="comment-content"], [class*="comments-container"], [class*="comments-section"]');
        if (commentsEl) {
          const targetRect = target.getBoundingClientRect();
          const commentsRect = commentsEl.getBoundingClientRect();
          if (commentsRect.top > targetRect.top + 50) {
            const relativeTop = commentsRect.top - targetRect.top;
            existingOverlay.style.setProperty('height', `${relativeTop}px`, 'important');
          }
        }
        return;
      } else if (existingOverlay) {
        try { existingOverlay.remove(); } catch (e) {}
        activeOverlays.delete(target);
      }
    }
  }

  if (target.getAttribute('data-slop-revealed') === 'true') return;

  if (hideSlopCompletely) {
    if (!target.hasAttribute('data-asb-original-display')) {
      target.setAttribute('data-asb-original-display', target.style.display || 'block');
    }
    target.style.setProperty('display', 'none', 'important');
    target.setAttribute('data-asb-blocked', 'true');
    target.setAttribute('data-asb-score', score.toString());
    target.setAttribute('data-asb-matched-phrases', JSON.stringify(matchedPhrases));
    console.log('[AI Slop Blocker - Posts] Ukryto post całkowicie.');

    if (!target.hasAttribute('data-slop-counted')) {
      target.setAttribute('data-slop-counted', 'true');
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        try {
          chrome.runtime.sendMessage({ type: 'INCREMENT_SLOP_COUNT' }, () => {});
          
          chrome.runtime.sendMessage({
            type: 'RECORD_BLOCKED_EVENT',
            event: {
              id: eventId,
              timestamp: new Date().toISOString(),
              domain: window.location.hostname.toLowerCase(),
              score,
              matchedRules: matchedPhrases,
              textLength,
              emojiCount,
              emojiDensity,
              isOverridden: false
            }
          }, () => {});
        } catch (err) {}
      }
    }
    return;
  }

  const overlay = document.createElement('asb-overlay');
  overlay.className = `asb-floating-overlay asb-overlay ${OVERLAY_CLASS}`;
  overlay.setAttribute('data-asb-target-id', eventId);
  
  // Zabezpieczenie inline dla layoutu (resztą właściwości zarządza arkusz stylów)
  overlay.style.setProperty('position', 'absolute', 'important');
  overlay.style.setProperty('top', '0', 'important');
  overlay.style.setProperty('left', '0', 'important');
  overlay.style.setProperty('width', '100%', 'important');
  overlay.style.setProperty('height', '100%', 'important');

  // Dynamiczne dopasowanie wysokości nakładki w celu odsłonięcia komentarzy
  const commentsEl = target.querySelector('.comments-comment-item, [class*="comment-item"], .comment, [class*="comment-content"], [class*="comments-container"], [class*="comments-section"]');
  if (commentsEl) {
    const targetRect = target.getBoundingClientRect();
    const commentsRect = commentsEl.getBoundingClientRect();
    if (commentsRect.top > targetRect.top + 50) {
      const relativeTop = commentsRect.top - targetRect.top;
      overlay.style.setProperty('height', `${relativeTop}px`, 'important');
    }
  }

  overlay.style.setProperty('z-index', '99999', 'important');
  overlay.style.setProperty('display', 'flex', 'important');
  overlay.style.setProperty('align-items', 'center', 'important');
  overlay.style.setProperty('justify-content', 'center', 'important');
  overlay.style.setProperty('background', 'rgba(241, 245, 249, 0.4)', 'important');
  overlay.style.setProperty('backdrop-filter', 'blur(8px)', 'important');
  overlay.style.setProperty('-webkit-backdrop-filter', 'blur(8px)', 'important');
  overlay.style.setProperty('border', '1px dashed rgba(148, 163, 184, 0.4)', 'important');
  overlay.style.setProperty('cursor', 'pointer', 'important');
  overlay.style.setProperty('transition', 'background-color 0.3s ease, border-color 0.3s ease', 'important');
  overlay.style.setProperty('box-sizing', 'border-box', 'important');
  overlay.style.setProperty('margin', '0', 'important');
  overlay.style.setProperty('padding', '16px', 'important');
  
  if (target.style.borderRadius) {
    overlay.style.setProperty('border-radius', target.style.borderRadius, 'important');
  } else {
    const computedRadius = window.getComputedStyle(target).borderRadius;
    if (computedRadius) {
      overlay.style.setProperty('border-radius', computedRadius, 'important');
    }
  }

  const badge = document.createElement('asb-badge');
  badge.className = 'asb-floating-overlay-badge';
  
  // Zabezpieczenie inline dla layoutu plakietki
  badge.style.setProperty('display', 'inline-flex', 'important');
  badge.style.setProperty('align-items', 'center', 'important');
  badge.style.setProperty('gap', '10px', 'important');
  badge.style.setProperty('background', '#1e293b', 'important');
  badge.style.setProperty('color', '#f8fafc', 'important');
  badge.style.setProperty('padding', '6px 6px 6px 14px', 'important');
  badge.style.setProperty('border-radius', '9999px', 'important');
  badge.style.setProperty('font-weight', '500', 'important');
  badge.style.setProperty('font-size', '13px', 'important');
  badge.style.setProperty('font-family', 'system-ui, -apple-system, sans-serif', 'important');
  badge.style.setProperty('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.15)', 'important');
  badge.style.setProperty('text-align', 'left', 'important');
  badge.style.setProperty('white-space', 'nowrap', 'important');
  badge.style.setProperty('max-width', '95%', 'important');
  badge.style.setProperty('box-sizing', 'border-box', 'important');
  badge.style.setProperty('margin', '0', 'important');
  badge.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.1)', 'important');
  badge.style.setProperty('transition', 'transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease', 'important');

  const textSpan = document.createElement('span');
  textSpan.style.setProperty('display', 'inline-block', 'important');
  textSpan.style.setProperty('white-space', 'nowrap', 'important');
  
  let badgeText = `🤖 Wykryto AI Slop (${score}%)`;
  if (isDebugMode && matchedPhrases.length > 0) {
    badgeText = `🤖 [DEBUG] AI Slop (${score}%) [${matchedPhrases.join(', ')}]`;
  }
  textSpan.textContent = badgeText;
  badge.appendChild(textSpan);

  const showBtn = document.createElement('asb-btn-show');
  showBtn.className = 'asb-show-button';
  showBtn.textContent = 'Pokaż';
  showBtn.style.setProperty('display', 'inline-flex', 'important');
  showBtn.style.setProperty('align-items', 'center', 'important');
  showBtn.style.setProperty('justify-content', 'center', 'important');
  showBtn.style.setProperty('background', '#ef4444', 'important');
  showBtn.style.setProperty('color', '#ffffff', 'important');
  showBtn.style.setProperty('border', 'none', 'important');
  showBtn.style.setProperty('border-radius', '9999px', 'important');
  showBtn.style.setProperty('padding', '5px 12px', 'important');
  showBtn.style.setProperty('font-size', '11px', 'important');
  showBtn.style.setProperty('font-weight', '600', 'important');
  showBtn.style.setProperty('cursor', 'pointer', 'important');
  showBtn.style.setProperty('transition', 'background-color 0.2s ease, transform 0.2s ease', 'important');
  showBtn.style.setProperty('white-space', 'nowrap', 'important');
  showBtn.style.setProperty('line-height', '1.2', 'important');
  showBtn.style.setProperty('margin-left', '4px', 'important');
  badge.appendChild(showBtn);

  overlay.appendChild(badge);

  overlay.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    overlay.remove();
    activeOverlays.delete(target);
    target.setAttribute('data-slop-revealed', 'true');
    target.removeAttribute('data-asb-blocked');
    target.removeAttribute('data-asb-score');
    target.removeAttribute('data-asb-matched-phrases');

    // Odblokuj i oznacz jako odsłonięte wszystkie zablokowane elementy podrzędne
    target.querySelectorAll('[data-asb-blocked="true"]').forEach(child => {
      unblockElement(child as HTMLElement);
      child.setAttribute('data-slop-revealed', 'true');
    });

    const eventId = target.getAttribute('data-asb-event-id');
    if (eventId && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      try { chrome.runtime.sendMessage({ type: 'RECORD_OVERRIDE_EVENT', eventId }, () => {}); } catch (err) {}
    }
  });

  target.appendChild(overlay);
  activeOverlays.set(target, overlay);
  target.setAttribute('data-asb-blocked', 'true');
  target.setAttribute('data-asb-score', score.toString());
  target.setAttribute('data-asb-matched-phrases', JSON.stringify(matchedPhrases));

  const rect = target.getBoundingClientRect();
  if (rect.height < 40) {
    badge.style.setProperty('display', 'none', 'important');
  } else if (rect.height < 80) {
    badge.style.setProperty('padding', '3px 3px 3px 8px', 'important');
    badge.style.setProperty('font-size', '11px', 'important');
    badge.style.setProperty('gap', '6px', 'important');
    showBtn.style.setProperty('padding', '3px 8px', 'important');
    showBtn.style.setProperty('font-size', '10px', 'important');
  }

  console.log('[AI Slop Blocker - Posts] Nałożono Floating Overlay na post.');

  if (!target.hasAttribute('data-slop-counted')) {
    target.setAttribute('data-slop-counted', 'true');
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      try {
        chrome.runtime.sendMessage({ type: 'INCREMENT_SLOP_COUNT' }, () => {});
        
        chrome.runtime.sendMessage({
          type: 'RECORD_BLOCKED_EVENT',
          event: {
            id: eventId,
            timestamp: new Date().toISOString(),
            domain: window.location.hostname.toLowerCase(),
            score,
            matchedRules: matchedPhrases,
            textLength,
            emojiCount,
            emojiDensity,
            isOverridden: false
          }
        }, () => {});
      } catch (err) {}
    }
  }
}

function unblockElement(element: Element) {
  const target = element as HTMLElement;
  const overlay = activeOverlays.get(target);
  if (overlay) {
    overlay.remove();
    activeOverlays.delete(target);
  }
  
  if (target.hasAttribute('data-asb-original-display')) {
    const orig = target.getAttribute('data-asb-original-display');
    if (orig && orig !== 'none') {
      target.style.display = orig;
    } else {
      target.style.removeProperty('display');
    }
    target.removeAttribute('data-asb-original-display');
  }
  target.removeAttribute('data-asb-blocked');
  target.removeAttribute('data-asb-score');
  target.removeAttribute('data-asb-matched-phrases');
}

function unblockAll() {
  console.log('[AI Slop Blocker - Posts] Wyłączono wtyczkę lub wykluczono domenę - usuwanie blokad.');
  
  const targets = Array.from(activeOverlays.keys());
  targets.forEach((target) => {
    unblockElement(target);
  });
  activeOverlays.clear();
  
  const hiddenElements = document.querySelectorAll('[data-asb-original-display]');
  hiddenElements.forEach((el) => {
    unblockElement(el);
  });

  analyzedTexts = new WeakMap<Element, AnalysisResult>();
  
  const analyzedElements = document.querySelectorAll(`[${ANALYZED_ATTR}]`);
  analyzedElements.forEach((el) => {
    el.removeAttribute(ANALYZED_ATTR);
  });

  activeWhitelistBadges.forEach((badge) => {
    badge.remove();
  });
  activeWhitelistBadges.clear();
}

function findAuthorElements(element: Element): HTMLElement[] {
  const targetCard = getPostCard(element);
  const authorElements: HTMLElement[] = [];
  
  const elements = targetCard.querySelectorAll('h3, h4, a, span, [class*="name"], [class*="author"], [class*="actor"]');
  for (const el of Array.from(elements)) {
    if (isOurElement(el)) continue;
    if (el.matches(CONTAINER_SELECTOR) || el.closest(CONTAINER_SELECTOR) !== null) continue;
    if (el === element || element.contains(el)) continue;
    
    const htmlEl = el as HTMLElement;
    authorElements.push(htmlEl);
  }
  return authorElements;
}

function findProfileLinks(element: Element): HTMLElement[] {
  const targetCard = getPostCard(element);
  const profileLinks: HTMLElement[] = [];
  
  const links = targetCard.querySelectorAll('a[href]');
  for (const link of Array.from(links)) {
    if (isOurElement(link)) continue;
    if (link.matches(CONTAINER_SELECTOR) || link.closest(CONTAINER_SELECTOR) !== null) continue;
    if (link === element || element.contains(link)) continue;
    
    const htmlLink = link as HTMLElement;
    profileLinks.push(htmlLink);
  }
  return profileLinks;
}

function isAuthorWhitelisted(element: Element, authorWhitelist: string[]): boolean {
  if (!authorWhitelist || authorWhitelist.length === 0) return false;

  const links = findProfileLinks(element);
  for (const link of links) {
    const href = (link.getAttribute('href') || '').toLowerCase();
    if (href) {
      for (const allowed of authorWhitelist) {
        const allowedLower = allowed.toLowerCase().trim();
        if (allowedLower && href.includes(allowedLower)) {
          console.log(`[AI Slop Blocker - Posts] Author profile URL whitelist hit: "${allowed}" matched in href="${href}"`);
          return true;
        }
      }
    }
  }

  return false;
}

// Eksportujemy moduł zgodny z ASBModule
export const postsModule: ASBModule = {
  id: 'posts',
  name: 'Detekcja wpisów AI',
  description: 'Skanowanie i blokowanie automatycznych wpisów i postów w mediach społecznościowych.',
  isEnabled: () => {
    const isModuleEnabled = currentSettings?.activeModules?.posts ?? true;
    return isPluginEnabled && !isCurrentPageExcluded && isModuleEnabled;
  },
  
  init: async () => {
    console.log('[AI Slop Blocker - Posts] Inicjalizacja modułu posts...');
    
    // Załadowanie początkowych ustawień
    const settings = await getSettings();
    currentSettings = settings;
    isPluginEnabled = settings.enabled ?? true;
    isCurrentPageExcluded = checkPageExclusion(settings);
    isDebugMode = settings.debugMode ?? false;

    if (!isPluginEnabled || isCurrentPageExcluded) {
      return;
    }

    initializeEventDelegation();
    
    // Scroll listener dla wirtualnego scrolla
    let scrollScanTimer: ReturnType<typeof setTimeout> | null = null;
    const scrollHandler = () => {
      if (!isPluginEnabled || isCurrentPageExcluded) return;
      if (scrollScanTimer) clearTimeout(scrollScanTimer);
      scrollScanTimer = setTimeout(() => {
        if (!isContextValid() || !document.body) return;
        fullBodyRescan();
        deepBodyRescan();
      }, 500);
    };
    window.addEventListener('scroll', scrollHandler, { passive: true });
    document.addEventListener('scroll', scrollHandler, { passive: true, capture: true });

    // Watchdog
    let watchdogCycle = 0;
    setInterval(() => {
      if (!isPluginEnabled || isCurrentPageExcluded) return;
      if (!isContextValid()) return;
      if (!document.body) return;
      if (document.visibilityState !== 'visible') return;

      cleanupDisconnectedOverlaysAndBadges();
      fullBodyRescan();
      deepBodyRescan();
      watchdogCycle++;
      if (watchdogCycle % 10 === 0) {
        console.log(`[AI Slop Blocker - Posts] watchdog heartbeat #${watchdogCycle}, overlays=${activeOverlays.size}, pending=${pendingElements.size}`);
      }
    }, 10000);

    // Pierwsze skanowanie
    fullBodyRescan();
  },

  analyze: (node: Element) => {
    if (!isPluginEnabled || isCurrentPageExcluded) return;
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el.shadowRoot) {
        checkedForShadowRoots = false; // reset flagi, by sprawdzić ponownie przy następnym cyklu
      }
    }
    
    collectContainersFromNode(node);
    scheduleAnalysis();
  },

  onUrlChange: async (url: string) => {
    console.log(`[AI Slop Blocker - Posts] Wykryto zmianę URL: ${url}`);
    
    const settings = await getSettings();
    currentSettings = settings;
    isCurrentPageExcluded = checkPageExclusion(settings);
    
    if (isCurrentPageExcluded) {
      console.log('[AI Slop Blocker - Posts] Nowy URL jest na białej liście. Usuwam nakładki.');
      unblockAll();
    } else {
      triggerFullRescan('nawigacja SPA (powiadomienie z orkiestratora)');
      scheduleCSRContentGapCheck();
    }
  },

  onSettingsChange: (newSettings: PluginSettings) => {
    console.log('[AI Slop Blocker - Posts] Otrzymano nowe ustawienia.');
    const wasEnabled = isPluginEnabled;
    const wasExcluded = isCurrentPageExcluded;
    const wasDebug = isDebugMode;
    
    currentSettings = newSettings;
    isPluginEnabled = newSettings.enabled ?? true;
    isCurrentPageExcluded = checkPageExclusion(newSettings);
    isDebugMode = newSettings.debugMode ?? false;
    
    if ((wasEnabled && !isPluginEnabled) || (!wasExcluded && isCurrentPageExcluded)) {
      unblockAll();
    } else if ((!wasEnabled && isPluginEnabled && !isCurrentPageExcluded) || (wasExcluded && !isCurrentPageExcluded && isPluginEnabled) || (wasDebug !== isDebugMode)) {
      triggerFullRescan('zmiana konfiguracji w locie');
    }
  }
};
