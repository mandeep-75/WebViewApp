import { IconSymbol } from '@/components/ui/icon-symbol';
import { fetchFilterLists, getAdBlockerEngine } from '@/utils/AdBlocker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    PanResponder,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const CURRENT_URL_KEY = '@webview_current_url';
const BUTTON_POS_KEY = '@webview_button_pos';
const BLOCK_EXTERNAL_KEY = '@webview_block_external';
const UBOL_ENABLED_KEY = '@webview_ubol_enabled';
const ALLOWED_DOMAINS_KEY = '@webview_allowed_domains';
const BLOCKED_DOMAINS_KEY = '@webview_blocked_domains';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
    background: '#ffffff',
    surface: '#f2f2f7',
    accent: '#007aff',
    text: '#000000',
    textSecondary: '#8e8e93',
    border: '#c6c6c8'
};

export default function WebviewScreen() {
    const [currentUrl, setCurrentUrl] = useState('https://movies-react.vercel.app');
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [blockExternal, setBlockExternal] = useState(false);
    const [ubolEnabled, setUbolEnabled] = useState(true);
    const [externalFilters, setExternalFilters] = useState([]);

    // Domain Filter Lists
    const [allowedDomains, setAllowedDomains] = useState([]);
    const [blockedDomains, setBlockedDomains] = useState([]);

    const webViewRef = useRef(null);
    const router = useRouter();

    const pan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - 70, y: SCREEN_HEIGHT - 100 })).current;

    useEffect(() => {
        const init = async () => {
            await loadAppState();
            await loadButtonPosition();
            await loadSettings();

            const filters = await fetchFilterLists();
            if (filters) setExternalFilters(filters);
        };

        init();

        StatusBar.setHidden(false, 'fade');
        StatusBar.setBarStyle('dark-content');
    }, []);

    const loadAppState = async () => {
        try {
            const savedUrl = await AsyncStorage.getItem(CURRENT_URL_KEY);
            if (savedUrl) setCurrentUrl(savedUrl);
        } catch (e) { console.error(e); }
    };

    const loadSettings = async () => {
        try {
            const savedBlock = await AsyncStorage.getItem(BLOCK_EXTERNAL_KEY);
            if (savedBlock !== null) setBlockExternal(JSON.parse(savedBlock));

            const savedUbol = await AsyncStorage.getItem(UBOL_ENABLED_KEY);
            if (savedUbol !== null) setUbolEnabled(JSON.parse(savedUbol));

            const savedAllowed = await AsyncStorage.getItem(ALLOWED_DOMAINS_KEY);
            if (savedAllowed) setAllowedDomains(JSON.parse(savedAllowed));

            const savedBlocked = await AsyncStorage.getItem(BLOCKED_DOMAINS_KEY);
            if (savedBlocked) setBlockedDomains(JSON.parse(savedBlocked));
        } catch (e) { console.error(e); }
    };

    const loadButtonPosition = async () => {
        try {
            const savedPos = await AsyncStorage.getItem(BUTTON_POS_KEY);
            if (savedPos) {
                const { x, y } = JSON.parse(savedPos);
                pan.setValue({ x, y });
            }
        } catch (e) { console.error(e); }
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
            },
            onPanResponderGrant: () => {
                pan.setOffset({ x: pan.x._value, y: pan.y._value });
                pan.setValue({ x: 0, y: 0 });
            },
            onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
            onPanResponderRelease: (_, gestureState) => {
                pan.flattenOffset();
                const hasMovedSignificantly = Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;

                if (!hasMovedSignificantly) {
                    router.push('/modal');
                } else {
                    const finalX = pan.x._value > SCREEN_WIDTH / 2 ? SCREEN_WIDTH - 70 : 10;
                    let finalY = pan.y._value;
                    if (finalY < 40) finalY = 40;
                    if (finalY > SCREEN_HEIGHT - 80) finalY = SCREEN_HEIGHT - 80;

                    Animated.spring(pan, {
                        toValue: { x: finalX, y: finalY },
                        useNativeDriver: false,
                        friction: 8,
                    }).start(async () => {
                        await AsyncStorage.setItem(BUTTON_POS_KEY, JSON.stringify({ x: finalX, y: finalY }));
                    });
                }
            }
        })
    ).current;

    useEffect(() => {
        const interval = setInterval(async () => {
            const savedUrl = await AsyncStorage.getItem(CURRENT_URL_KEY);
            if (savedUrl && savedUrl !== currentUrl) setCurrentUrl(savedUrl);

            const savedBlock = await AsyncStorage.getItem(BLOCK_EXTERNAL_KEY);
            if (savedBlock !== null) {
                const parsedBlock = JSON.parse(savedBlock);
                if (parsedBlock !== blockExternal) setBlockExternal(parsedBlock);
            }

            const savedUbol = await AsyncStorage.getItem(UBOL_ENABLED_KEY);
            if (savedUbol !== null) {
                const parsedUbol = JSON.parse(savedUbol);
                if (parsedUbol !== ubolEnabled) {
                    setUbolEnabled(parsedUbol);
                    if (webViewRef.current) webViewRef.current.reload();
                }
            }

            // Sync Allowed/Blocked domains from modal
            const savedAllowed = await AsyncStorage.getItem(ALLOWED_DOMAINS_KEY);
            if (savedAllowed) {
                const parsed = JSON.parse(savedAllowed);
                if (JSON.stringify(parsed) !== JSON.stringify(allowedDomains)) setAllowedDomains(parsed);
            }

            const savedBlocked = await AsyncStorage.getItem(BLOCKED_DOMAINS_KEY);
            if (savedBlocked) {
                const parsed = JSON.parse(savedBlocked);
                if (JSON.stringify(parsed) !== JSON.stringify(blockedDomains)) setBlockedDomains(parsed);
            }

        }, 1000);
        return () => clearInterval(interval);
    }, [currentUrl, blockExternal, ubolEnabled, allowedDomains, blockedDomains]);

    const getHostname = (u) => {
        try {
            return new URL(u).hostname;
        } catch (e) { return null; }
    };

    const handleBlockedNavigation = (url) => {
        const hostname = getHostname(url);
        if (!hostname) return;

        // Don't ask if already in blocked list
        if (blockedDomains.includes(hostname)) return;

        Alert.alert(
            'Navigation Blocked',
            `External domain: ${hostname}\n\nWould you like to always allow or permanently block this site?`,
            [
                {
                    text: 'Always Block',
                    style: 'destructive',
                    onPress: async () => {
                        const updated = [...new Set([...blockedDomains, hostname])];
                        setBlockedDomains(updated);
                        await AsyncStorage.setItem(BLOCKED_DOMAINS_KEY, JSON.stringify(updated));
                    }
                },
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Always Allow',
                    onPress: async () => {
                        const updated = [...new Set([...allowedDomains, hostname])];
                        setAllowedDomains(updated);
                        await AsyncStorage.setItem(ALLOWED_DOMAINS_KEY, JSON.stringify(updated));
                        setCurrentUrl(url);
                    }
                }
            ]
        );
    };

    const handleShouldStartLoad = (request) => {
        const { url } = request;

        // 1. Handle intent: URLs
        if (url.startsWith('intent:') || url.startsWith('intent://')) {
            let targetUrl = null;

            // Try S.browser_fallback_url
            const fallbackMatch = url.match(/S\.browser_fallback_url=([^;]+)/);
            if (fallbackMatch) {
                targetUrl = decodeURIComponent(fallbackMatch[1]);
            }
            // Handle direct wrapping: intent:https://...
            else if (url.includes('http')) {
                const httpMatch = url.match(/(https?:\/\/[^;#]+)/);
                if (httpMatch) targetUrl = httpMatch[1];
            }

            if (targetUrl) {
                const targetHost = getHostname(targetUrl);
                const currentHost = getHostname(currentUrl);

                if (targetHost === currentHost || allowedDomains.includes(targetHost)) {
                    setCurrentUrl(targetUrl);
                } else if (blockExternal) {
                    handleBlockedNavigation(targetUrl);
                } else {
                    setCurrentUrl(targetUrl);
                }
            }
            return false;
        }

        // 2. ALWAYS Block non-http protocols
        if (!url.startsWith('http://') && !url.startsWith('https://')) return false;

        // 3. Always allow the current intended URL
        if (url === currentUrl) return true;

        // 4. Domain Filtering Logic
        const currentHost = getHostname(currentUrl);
        const nextHost = getHostname(url);

        if (!nextHost || nextHost === currentHost) return true;

        if (allowedDomains.includes(nextHost)) return true;
        if (blockedDomains.includes(nextHost)) {
            console.log(`Auto-blocked domain (Blacklisted): ${nextHost}`);
            return false;
        }

        if (blockExternal) {
            console.log(`Blocking external domain: ${url}`);
            handleBlockedNavigation(url);
            return false;
        }

        return true;
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View style={styles.webViewWrapper}>
                <WebView
                    ref={webViewRef}
                    source={{ uri: currentUrl }}
                    style={styles.webview}
                    onLoadStart={() => setLoading(true)}
                    onLoadEnd={() => setLoading(false)}
                    onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
                    onShouldStartLoadWithRequest={handleShouldStartLoad}
                    allowsBackForwardNavigationGestures
                    pullToRefreshEnabled
                    domStorageEnabled
                    javaScriptEnabled
                    setSupportMultipleWindows={false}
                    injectedJavaScript={getAdBlockerEngine({
                        blockAds: ubolEnabled,
                        externalFilters: externalFilters
                    })}
                />
            </View>

            {loading && (
                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: COLORS.accent }]} />
                </View>
            )}

            <Animated.View
                style={[styles.movableButtonContainer, { transform: pan.getTranslateTransform() }]}
                {...panResponder.panHandlers}
            >
                <View style={styles.quickMenuButton}>
                    <IconSymbol name="safari.fill" size={28} color={COLORS.accent} />
                </View>
            </Animated.View>

            {loading && progress < 0.1 && (
                <View style={styles.centeredLoader}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                    <Text style={styles.loadingSubtext}>CONNECTING...</Text>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    webViewWrapper: { flex: 1 },
    webview: { flex: 1, backgroundColor: 'transparent' },
    progressContainer: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 100 },
    progressBar: { height: '100%' },
    movableButtonContainer: { position: 'absolute', zIndex: 9999, width: 56, height: 56 },
    quickMenuButton: { flex: 1, borderRadius: 28, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.accent, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    centeredLoader: { position: 'absolute', top: '50%', left: '50%', marginTop: -40, marginLeft: -50, width: 100, alignItems: 'center' },
    loadingSubtext: { marginTop: 10, fontSize: 10, letterSpacing: 2, fontWeight: 'bold', color: COLORS.textSecondary }
});
