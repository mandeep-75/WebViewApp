import AsyncStorage from '@react-native-async-storage/async-storage';

const FILTERS_CACHE_KEY = '@webview_adblock_filters';
const LAST_UPDATE_KEY = '@webview_adblock_last_update';

// Default built-in filters (fallback)
const BUILTIN_BLOCKLIST = [
    'doubleclick.net', 'googlesyndication.com', 'google-analytics.com',
    'adnxs.com', 'adservice.google', 'taboola.com', 'outbrain.com',
    'facebook.net/en_US/fbevents.js', 'amazon-adsystem.com',
    'advertising.com', 'scorecardresearch.com', 'quantserve.com'
];

/**
 * uBlock Pro Engine: Downloads and applies real filter lists
 */
export const fetchFilterLists = async (force = false) => {
    try {
        const lastUpdate = await AsyncStorage.getItem(LAST_UPDATE_KEY);
        const now = Date.now();

        // Update every 24 hours unless forced
        if (!force && lastUpdate && (now - parseInt(lastUpdate)) < 86400000) {
            const cached = await AsyncStorage.getItem(FILTERS_CACHE_KEY);
            if (cached) return JSON.parse(cached);
        }

        console.log('uBlock Pro: Fetching external filter lists...');

        // We'll use Peter Lowe's list as it's efficient for mobile
        const response = await fetch('https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext');
        const text = await response.text();

        // Parse hosts file format (extract 127.0.0.1 domain.com)
        const domains = text.split('\n')
            .filter(line => line.startsWith('127.0.0.1'))
            .map(line => line.split(' ')[1]?.trim())
            .filter(domain => domain && domain.length > 3);

        const finalBlocklist = [...new Set([...BUILTIN_BLOCKLIST, ...domains])];

        await AsyncStorage.setItem(FILTERS_CACHE_KEY, JSON.stringify(finalBlocklist));
        await AsyncStorage.setItem(LAST_UPDATE_KEY, now.toString());

        return finalBlocklist;
    } catch (e) {
        console.error('uBlock Pro: Failed to fetch filters', e);
        return BUILTIN_BLOCKLIST;
    }
};

export const getAdBlockerEngine = (options = { blockAds: true, externalFilters: [] }) => {
    const blockAds = options.blockAds;
    const blocklist = options.externalFilters && options.externalFilters.length > 0
        ? options.externalFilters
        : BUILTIN_BLOCKLIST;

    return `
(function() {
    if (window.WebExplorer_AdBlock_Initialized) return;
    window.WebExplorer_AdBlock_Initialized = true;

    const blockAds = ${blockAds};
    const blocklist = ${JSON.stringify(blocklist)};

    // 1. REDIRECTION PROTECTION
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    if (node.tagName === 'A' && node.target === '_blank') {
                        node.target = '_self';
                    }
                }
            });
        });
    });

    document.querySelectorAll('a[target="_blank"]').forEach(link => {
        link.target = '_self';
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    // 2. MASTER COSMETIC FILTER
    const adStyles = document.createElement('style');
    let css = '';

    if (blockAds) {
        css += \`
            [id*="google_ads"], [class*="ad-unit"], [class*="ad-box"], [class*="ad-container"],
            [id^="taboola-"], [id^="outbrain-"], .adsbygoogle, ins.adsbygoogle,
            .ad-sidebar, .ad-banner, .sponsored-content, .promoted-post,
            .ytp-ad-overlay-container, .ytp-ad-message-container, .video-ads,
            iframe[src*="doubleclick.net"], iframe[src*="googlesyndication.com"],
            #bebi-ads, .bebi-ads-container {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                height: 0 !important;
            }
        \`;
    }

    adStyles.innerHTML = css;
    document.head.appendChild(adStyles);

    // 3. PRO NETWORK FILTERING (Optimized for large lists)
    const blockSet = new Set(blocklist);
    
    const isBlacklisted = (url) => {
        if (!url || typeof url !== 'string') return false;
        if (!blockAds) return false;
        
        try {
            const host = new URL(url).hostname;
            // Check exact host and parent domains
            const parts = host.split('.');
            for (let i = 0; i < parts.length - 1; i++) {
                const domain = parts.slice(i).join('.');
                if (blockSet.has(domain)) return true;
            }
        } catch(e) {
            // Fallback to substring check if URL is weird
            return blocklist.some(domain => url.includes(domain));
        }
        return false;
    };

    // Intercept Fetch
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        const url = (typeof input === 'string') ? input : (input instanceof Request ? input.url : '');
        if (isBlacklisted(url)) {
            return Promise.reject(new Error('Blocked by uBlock Pro'));
        }
        return originalFetch.apply(this, arguments);
    };

    // Intercept XHR
    const originalXHR = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url) {
        if (isBlacklisted(url)) {
            console.log('uBlock Pro blocked request to: ' + url);
            this.abort();
            return;
        }
        return originalXHR.apply(this, arguments);
    };

    // Dynamic cleanups
    const adObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    if (node.tagName === 'SCRIPT' && isBlacklisted(node.src)) {
                        node.remove();
                    }
                    if (blockAds && node.matches && node.matches('[class*="ad-"], [id*="ad-"]')) {
                        node.style.setProperty('display', 'none', 'important');
                    }
                }
            });
        });
    });
    adObserver.observe(document.documentElement, { childList: true, subtree: true });

    console.log('uBlock Pro: Active with ' + blocklist.length + ' domains blocked.');
})();
true;
`;
};
