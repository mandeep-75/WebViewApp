import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="modal"
          options={{
            presentation: 'transparentModal',
            animation: 'fade'
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
