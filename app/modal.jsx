import { IconSymbol } from '@/components/ui/icon-symbol';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STORAGE_KEY = '@webview_user_sites';
const CURRENT_URL_KEY = '@webview_current_url';
const BLOCK_EXTERNAL_KEY = '@webview_block_external';
const UBOL_ENABLED_KEY = '@webview_ubol_enabled';
const ALLOWED_DOMAINS_KEY = '@webview_allowed_domains';
const BLOCKED_DOMAINS_KEY = '@webview_blocked_domains';

const COLORS = {
  background: '#ffffff',
  surface: '#f2f2f7',
  accent: '#007aff',
  text: '#000000',
  textSecondary: '#8e8e93',
  border: '#d1d1d6',
  danger: '#ff3b30',
  success: '#34c759'
};

const DEFAULT_SITES = [
  { id: 'movies', name: 'Movies', url: 'https://movies-react.vercel.app/', isPermanent: true },
  { id: 'huggingfacespaces', name: 'Hugging Face spaces', url: 'https://huggingface.co/spaces', isPermanent: true },
];

export default function SettingsModal() {
  const [userSites, setUserSites] = useState([]);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [blockExternal, setBlockExternal] = useState(false);
  const [ubolEnabled, setUbolEnabled] = useState(true);

  const [allowedDomains, setAllowedDomains] = useState([]);
  const [blockedDomains, setBlockedDomains] = useState([]);
  const [newDomain, setNewDomain] = useState('');
  const [domainMode, setDomainMode] = useState('allow'); // 'allow' or 'block'

  const [filterText, setFilterText] = useState('');
  const [domainFilterText, setDomainFilterText] = useState('');

  const router = useRouter();

  useEffect(() => {
    loadSites();
    loadSettings();
    StatusBar.setHidden(true, 'none');
  }, []);

  const loadSites = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) setUserSites(JSON.parse(saved));
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

  const toggleBlockExternal = async (value) => {
    setBlockExternal(value);
    await AsyncStorage.setItem(BLOCK_EXTERNAL_KEY, JSON.stringify(value));
  };

  const toggleUbol = async (value) => {
    setUbolEnabled(value);
    await AsyncStorage.setItem(UBOL_ENABLED_KEY, JSON.stringify(value));
  };

  const addDomain = async () => {
    if (!newDomain) return;
    const cleanDomain = newDomain.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];

    if (domainMode === 'allow') {
      if (!allowedDomains.includes(cleanDomain)) {
        const updated = [cleanDomain, ...allowedDomains]; // Latest on top
        setAllowedDomains(updated);
        await AsyncStorage.setItem(ALLOWED_DOMAINS_KEY, JSON.stringify(updated));
      }
    } else {
      if (!blockedDomains.includes(cleanDomain)) {
        const updated = [cleanDomain, ...blockedDomains]; // Latest on top
        setBlockedDomains(updated);
        await AsyncStorage.setItem(BLOCKED_DOMAINS_KEY, JSON.stringify(updated));
      }
    }
    setNewDomain('');
  };

  const removeDomain = async (domain, mode) => {
    if (mode === 'allow') {
      const updated = allowedDomains.filter(d => d !== domain);
      setAllowedDomains(updated);
      await AsyncStorage.setItem(ALLOWED_DOMAINS_KEY, JSON.stringify(updated));
    } else {
      const updated = blockedDomains.filter(d => d !== domain);
      setBlockedDomains(updated);
      await AsyncStorage.setItem(BLOCKED_DOMAINS_KEY, JSON.stringify(updated));
    }
  };

  const addSite = async () => {
    if (!newSiteName || !newSiteUrl) return;
    let url = newSiteUrl.toLowerCase();
    if (!url.startsWith('http')) url = 'https://' + url;

    const nextSite = { id: Date.now().toString(), name: newSiteName, url: url };
    const updated = [nextSite, ...userSites]; // Add to top for latest first
    setUserSites(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setNewSiteName('');
    setNewSiteUrl('');
  };

  const deleteSite = async (id) => {
    const updated = userSites.filter(site => site.id !== id);
    setUserSites(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const selectSite = async (url) => {
    await AsyncStorage.setItem(CURRENT_URL_KEY, url);
    router.back();
  };

  const clearData = async () => {
    Alert.alert('Clear All Data', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove([STORAGE_KEY, BLOCK_EXTERNAL_KEY, UBOL_ENABLED_KEY, ALLOWED_DOMAINS_KEY, BLOCKED_DOMAINS_KEY]);
          setUserSites([]);
          setAllowedDomains([]);
          setBlockedDomains([]);
          setBlockExternal(false);
          setUbolEnabled(true);
          router.back();
        }
      }
    ]);
  };

  const filteredSites = [...DEFAULT_SITES, ...userSites].filter(site =>
    site.name.toLowerCase().includes(filterText.toLowerCase()) ||
    site.url.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.dismissArea} onPress={() => router.back()} activeOpacity={1} />
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={24} color={COLORS.accent} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Settings</Text>
            <View style={{ width: 40 }} />
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>General</Text>
                <View style={[styles.settingItem, { marginBottom: 12 }]}>
                  <View style={styles.settingInfo}><Text style={styles.settingLabel}>uBlock Pro</Text></View>
                  <Switch value={ubolEnabled} onValueChange={toggleUbol} trackColor={{ false: COLORS.border, true: COLORS.accent }} />
                </View>
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}><Text style={styles.settingLabel}>Block External Links</Text></View>
                  <Switch value={blockExternal} onValueChange={toggleBlockExternal} trackColor={{ false: COLORS.border, true: COLORS.accent }} />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bookmarks</Text>
                <TextInput style={styles.input} placeholder="Name" value={newSiteName} onChangeText={setNewSiteName} />
                <TextInput style={styles.input} placeholder="URL" value={newSiteUrl} onChangeText={setNewSiteUrl} autoCapitalize="none" />
                <TouchableOpacity style={styles.addButton} onPress={addSite}><Text style={styles.addButtonText}>Add Site</Text></TouchableOpacity>

                <TextInput
                  style={[styles.input, { marginTop: 16 }]}
                  placeholder="Search bookmarks..."
                  value={filterText}
                  onChangeText={setFilterText}
                />

                <View style={{ marginTop: 12 }}>
                  {filteredSites.map((item) => (
                    <View key={item.id} style={styles.siteItemContainer}>
                      <TouchableOpacity style={styles.siteItem} onPress={() => selectSite(item.url)}>
                        <Text style={styles.siteName}>{item.name}</Text>
                        <Text style={[styles.siteUrl, { fontSize: 10, color: COLORS.textSecondary }]}>{item.url}</Text>
                      </TouchableOpacity>
                      {!item.isPermanent && (
                        <TouchableOpacity style={styles.deleteIconButton} onPress={() => deleteSite(item.id)}>
                          <IconSymbol name="trash.fill" size={18} color={COLORS.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Manage External Filters</Text>
                <View style={styles.domainToggleContainer}>
                  <TouchableOpacity
                    style={[styles.domainTab, domainMode === 'allow' && styles.activeTabAllow]}
                    onPress={() => setDomainMode('allow')}
                  >
                    <Text style={[styles.tabText, domainMode === 'allow' && styles.activeTabText]}>Allowed</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.domainTab, domainMode === 'block' && styles.activeTabBlock]}
                    onPress={() => setDomainMode('block')}
                  >
                    <Text style={[styles.tabText, domainMode === 'block' && styles.activeTabText]}>Blocked</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.domainInputRow}>
                  <TextInput
                    style={styles.domainInput}
                    placeholder="domain.com"
                    value={newDomain}
                    onChangeText={setNewDomain}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={[styles.domainAddButton, { backgroundColor: domainMode === 'allow' ? COLORS.success : COLORS.danger }]} onPress={addDomain}>
                    <IconSymbol name="plus" size={20} color="#ffffff" />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[styles.input, { height: 40, marginTop: 8 }]}
                  placeholder="Search domains..."
                  value={domainFilterText}
                  onChangeText={setDomainFilterText}
                />

                <View style={{ marginTop: 12 }}>
                  {(domainMode === 'allow' ? allowedDomains : blockedDomains)
                    .filter(d => d.toLowerCase().includes(domainFilterText.toLowerCase()))
                    .map((domain) => (
                      <View key={domain} style={styles.domainItem}>
                        <Text style={styles.domainText}>{domain}</Text>
                        <TouchableOpacity onPress={() => removeDomain(domain, domainMode)}>
                          <IconSymbol name="trash.fill" size={16} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                </View>
              </View>

              <TouchableOpacity style={styles.clearButton} onPress={clearData}>
                <Text style={styles.clearButtonText}>Reset All</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  safeArea: { width: '100%', height: '90%' },
  dismissArea: { flex: 1 },
  modalContent: { flex: 1, backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  backButton: { padding: 8, marginLeft: -8 },
  scrollContent: { paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.accent, textTransform: 'uppercase', marginBottom: 12 },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: COLORS.surface, borderRadius: 12 },
  settingLabel: { fontSize: 16, fontWeight: '600' },
  input: { height: 48, backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  addButton: { backgroundColor: COLORS.accent, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: '#ffffff', fontWeight: '700' },
  siteItemContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  siteItem: { flex: 1, padding: 14, backgroundColor: COLORS.surface, borderRadius: 10 },
  siteName: { fontWeight: '600' },
  deleteIconButton: { padding: 10, marginLeft: 8 },
  domainToggleContainer: { flexDirection: 'row', marginBottom: 12, backgroundColor: COLORS.surface, borderRadius: 10, padding: 4 },
  domainTab: { flex: 1, padding: 8, alignItems: 'center', borderRadius: 8 },
  activeTabAllow: { backgroundColor: COLORS.success },
  activeTabBlock: { backgroundColor: COLORS.danger },
  tabText: { fontWeight: '700', color: COLORS.textSecondary },
  activeTabText: { color: '#ffffff' },
  domainInputRow: { flexDirection: 'row', marginBottom: 12 },
  domainInput: { flex: 1, height: 44, backgroundColor: COLORS.surface, borderRadius: 8, paddingHorizontal: 12, marginRight: 8, borderWidth: 1, borderColor: COLORS.border },
  domainAddButton: { width: 44, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  domainItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.surface },
  domainText: { fontSize: 14, color: COLORS.text },
  clearButton: { padding: 16, alignItems: 'center', marginTop: 20 },
  clearButtonText: { color: COLORS.danger, fontWeight: '700' },
});
