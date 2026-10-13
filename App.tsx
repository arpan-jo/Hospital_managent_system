import "react-native-gesture-handler"; // Required at the absolute top for gesture compatibility
import React from "react";
import { StatusBar } from "react-native";
import { Provider as PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { observer } from "mobx-react-lite";
import { StoreProvider, useStores } from "@app/core";
import AppNavigator from "./src/navigation/AppNavigator";
import { AppLightTheme, AppDarkTheme, CustomToast } from "@app/ui";

const AppContent = observer(() => {
  const { themeStore } = useStores();
  const theme = themeStore.isDarkMode ? AppDarkTheme : AppLightTheme;

  return (
    <PaperProvider theme={theme}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={themeStore.isDarkMode ? "light-content" : "dark-content"}
      />
      <AppNavigator />
      <CustomToast />
    </PaperProvider>
  );
});

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
