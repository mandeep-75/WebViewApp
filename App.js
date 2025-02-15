import React, { useEffect, useState, useRef, createContext, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  StatusBar,
  BackHandler,
} from "react-native";
import { WebView } from "react-native-webview";
import SystemNavigationBar from "react-native-system-navigation-bar";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import AsyncStorage from "@react-native-async-storage/async-storage";

enableScreens();

// Create a context for sharing the URL state
export const UrlContext = createContext();

// WebViewScreen Component
const WebViewScreen = () => {
  const { selectedUrl } = useContext(UrlContext);
  const [canGoBack, setCanGoBack] = useState(false);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const webViewRef = useRef(null);

  useEffect(() => {
    StatusBar.setBarStyle("dark-content");

    const handleBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // Prevent exiting the app
      }
      return false; // Default back action (exit app if no history)
    };

    BackHandler.addEventListener("hardwareBackPress", handleBackPress);
    return () => {
      BackHandler.removeEventListener("hardwareBackPress", handleBackPress);
    };
  }, [canGoBack]);

  const handleMessage = (event) => {
    const message = event.nativeEvent.data;
    if (message === "enterFullscreen") {
      setIsFullscreen(true);
      StatusBar.setHidden(true, "fade");
      SystemNavigationBar.navigationHide();
    } else if (message === "exitFullscreen") {
      setIsFullscreen(false);
      StatusBar.setHidden(false);
      SystemNavigationBar.navigationShow();
    }
  };

  const fullscreenDetectionScript = `
    (function() {
      function handleFullscreenChange() {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          window.ReactNativeWebView.postMessage('enterFullscreen');
        } else {
          window.ReactNativeWebView.postMessage('exitFullscreen');
        }
      }
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    })();
  `;

  return (
    <SafeAreaView
      style={[styles.container, isFullscreen && styles.fullscreenContainer]}
      edges={isFullscreen ? [] : ["top", "left", "right"]}
    >
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load the page.</Text>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: selectedUrl }}
          style={styles.webview}
          key={selectedUrl}
          onMessage={handleMessage}
          injectedJavaScript={fullscreenDetectionScript}
          javaScriptEnabled
          domStorageEnabled
          allowsFullscreenVideo
          onError={() => setError(true)}
          onLoadEnd={() => setError(false)}
          onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
        />
      )}
    </SafeAreaView>
  );
};

// SettingsScreen Component
const SettingsScreen = () => {
  const { setSelectedUrl, customUrls, addCustomUrl, removeCustomUrl } = useContext(UrlContext);
  const [customUrl, setCustomUrl] = useState("");
  const navigation = useNavigation();

  const handleUrlChange = (url) => {
    setSelectedUrl(url);
    navigation.navigate("WebView");
  };

  const handleCustomUrlSubmit = () => {
    if (customUrl) {
      addCustomUrl(customUrl);
      setSelectedUrl(customUrl);
      setCustomUrl("");
      navigation.navigate("WebView");
    }
  };

  const predefinedSites = [
    {
      name: "Blackloop",
      url: "https://movies-react.vercel.app",
      icon: "search",
    },
    {
      name: "video_test",
      url: "https://www.sample-videos.com",
      icon: "search",
    },
    {
      name: "vimeo",
      url: "https://player.vimeo.com/video/76979871",
      icon: "search",
    },

  ];

  return (
    <SafeAreaView style={styles.settingsContainer}>
      <ScrollView>
        <Text style={styles.title}>Select a Website</Text>
        {predefinedSites.map((site, index) => (
          <Pressable
            key={index}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => handleUrlChange(site.url)}
          >
            <MaterialIcons name={site.icon} size={24} color="#6200ee" />
            <Text style={styles.buttonText}>{site.name}</Text>
          </Pressable>
        ))}
        {customUrls.map((url, index) => (
          <View key={`custom-${index}`} style={styles.urlContainer}>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={() => handleUrlChange(url)}
            >
              <MaterialIcons name="public" size={24} color="#6200ee" />
              <Text style={styles.buttonText}>{url}</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => removeCustomUrl(url)}>
              <MaterialIcons name="delete" size={20} color="#ff4444" />
            </Pressable>
          </View>
        ))}
        <TextInput
          style={styles.input}
          placeholder="Enter a custom URL"
          placeholderTextColor="#ccc"
          value={customUrl}
          onChangeText={setCustomUrl}
          onSubmitEditing={handleCustomUrlSubmit}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.madeByText}>Made by Mandeep Singh</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

// Tab Navigator
const Tab = createBottomTabNavigator();

// Main App Component
export default function App() {
  const [selectedUrl, setSelectedUrl] = useState("https://movies-react.vercel.app");
  const [customUrls, setCustomUrls] = useState([]);

  useEffect(() => {
    const loadCustomUrls = async () => {
      try {
        const savedUrls = await AsyncStorage.getItem("customUrls");
        if (savedUrls) {
          setCustomUrls(JSON.parse(savedUrls));
        }
      } catch (error) {
        console.error("Error loading custom URLs:", error);
      }
    };

    loadCustomUrls();
  }, []);

  const addCustomUrl = (url) => {
    const newUrls = [...customUrls, url];
    setCustomUrls(newUrls);
    AsyncStorage.setItem("customUrls", JSON.stringify(newUrls));
  };

  const removeCustomUrl = (urlToRemove) => {
    const newUrls = customUrls.filter((url) => url !== urlToRemove);
    setCustomUrls(newUrls);
    AsyncStorage.setItem("customUrls", JSON.stringify(newUrls));
  };

  return (
    <SafeAreaProvider>
      <UrlContext.Provider value={{ selectedUrl, setSelectedUrl, customUrls, addCustomUrl, removeCustomUrl }}>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ color, size }) => {
                let iconName = route.name === "WebView" ? "web" : "settings";
                return <MaterialIcons name={iconName} size={size} color={color} />;
              },
              tabBarActiveTintColor: "#6200ee",
              tabBarInactiveTintColor: "gray",
              headerShown: false,
              tabBarStyle: { backgroundColor: "#f5f5f5" },
            })}
          >
            <Tab.Screen name="WebView" component={WebViewScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </UrlContext.Provider>
    </SafeAreaProvider>
  );
}


// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  fullscreenContainer: {
    paddingTop: 0,
    marginTop: 0,
  },
  webview: {
    flex: 1,
  },
  settingsContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#6200ee",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonPressed: {
    backgroundColor: "#f0f0f0",
  },
  buttonText: {
    marginLeft: 10,
    fontSize: 18,
    color: "#333",
  },
  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 18,
    color: "red",
  },
  madeByText: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 16,
    color: "#333",
  },
  urlContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deleteButton: {
    padding: 10,
    marginLeft: 5,
  },
});
