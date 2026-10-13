# HMS App

Mobile app for the Hospital Management System (HMS). It currently covers the patient portal: find doctors, appointments, follow-ups, prescriptions, reports and profile.

Built on the company React Native CLI template (MVVM + MST + MMKV + i18n + Paper + Forms): a **purely functional architecture** (Custom Hooks for ViewModels and plain observable structures), **MobX-State-Tree (MST)** for state management, **MMKV** for secure storage, **Axios** for API queries, **i18next** for localization, **React Hook Form** for validation, and a set of **31 custom reusable UI components** built on **React Native Paper** (Material Design MD3).

## 🤖 AI-Assisted Development
To optimize token costs, reduce development time, and maintain strict null safety when using Generative AI agents and assistants (Claude, Cursor, Gemini, ChatGPT), please refer to:
*   [AI Agent & Developer Guidelines](AI_DEVELOPMENT_GUIDE.md)
*   [Workspace Coding Instructions (.instructions.md)](.instructions.md)

---

## 📂 Project Structure & File Guide

```
HMS-APP/
├── App.tsx                   # Main entry point (contexts and setups)
├── index.js                  # Component registry
├── package.json              # Monorepo root configuration defining Yarn Workspaces
├── react-native.config.js    # Asset link definitions (points to packages/ui for fonts)
├── babel.config.js           # Reanimated, Worklets, and Env plugin configuration
├── metro.config.js           # Metro bundler config (with symlinks support enabled)
├── tsconfig.json             # TypeScript rules (with paths aliases mapped to workspaces)
├── env.d.ts                  # TypeScript declaration file for environment variables
├── .env                      # Local environment configuration variables (git ignored)
├── .env.example              # Example environment configuration template file
├── android/                  # Android Gradle build configs (linked for icons)
├── ios/                      # iOS Xcode project configs (linked for fonts & icons)
├── src/                      # Main App source (navigation routing & screens)
│   ├── assets/               # Bundled images
│   ├── components/           # Components shared between screens
│   ├── hooks/                # Hooks shared between screens
│   ├── navigation/           # Navigation routers (Drawer, Bottom Tabs, Stack)
│   └── screens/              # Screen-wise nested Views & ViewModel Hooks
│       ├── auth/             # Login, sign-up, OTP verification and password screens
│       ├── common/           # File viewer, profile sheets, settings (theme & language)
│       └── patient/          # Find doctors, appointments, follow-ups, prescriptions, reports, profile
└── packages/                 # Local Workspace Packages
    ├── core/                 # @app/core package (business logic, stores, network)
    │   ├── package.json      # Dependencies (axios, mmkv, mobx, i18next, etc.)
    │   ├── tsconfig.json     # Core package tsconfig
    │   └── src/
    │       ├── assets/locales/ # localization files (en.json, bn.json)
    │       ├── hooks/        # useDownload, useDocumentViewer hooks
    │       ├── store/        # MobX-State-Tree models & MMKV snapshots
    │       ├── network/      # Axios client configuration & endpoints
    │       ├── repositories/ # Repositories abstraction layer (AuthRepository, AppointmentRepository, ...)
    │       ├── utils/        # i18n, secureStorage, offlineCache, crypto, downloader, documentViewer
    │       └── index.ts      # Package exports
    └── ui/                   # @app/ui package (reusable UI components & themes)
        ├── package.json      # Dependencies (paper, reanimated, icons, etc.)
        ├── tsconfig.json     # UI package tsconfig
        └── src/
            ├── assets/fonts/ # Inter TTF static font assets
            ├── theme/        # Custom typography & color configurations
            ├── components/   # 31 custom reusable UI components
            └── index.ts      # Package exports
```

## 📦 Monorepo Workspace Packages

This project is configured as a monorepo utilizing **Yarn Workspaces**. Dependencies and code assets are structured into local packages:

1. **`@app/core`** (`packages/core/`):
   - Handles all business logic, local state management, network client logic, localization configuration, storage snapshots, downloader engine, documentViewer utils, and crypto functions.
   - External library dependencies (such as `mobx-state-tree`, `axios`, `crypto-js`, `react-native-mmkv`) are declared inside `packages/core/package.json`.
   - Accessible via the package alias `@app/core` across all workspaces.

2. **`@app/ui`** (`packages/ui/`):
    - Houses all 31 custom reusable components, layout utilities (`Row`, `Col`), themes, font settings, and the Inter TTF assets.
   - Depends on `@app/core` to consume theme/language states.
   - Accessible via the package alias `@app/ui` across all workspaces.

3. **React Native Main App**:
   - The root of the initialized workspace targets the platform builders (`android/`, `ios/`) and the app views (`src/screens/`, `src/navigation/`).
   - Resolves `@app/core` and `@app/ui` via local workspace symlinks.


---

## 🏛️ MVVM Architecture & Repository Flow

This template separates logic from presentation using the **MVVM (Model-View-ViewModel)** design pattern with a **Repository Pattern** layer, implemented in a modern functional paradigm:

1. **View (observer Components):** Purely functional components that render UI, invoke ViewModel hooks, and observe stores.
2. **ViewModel (Custom Hooks / Stores):** Manage state inputs, form validation, and query repositories for data. ViewModels do not handle caching or raw API clients directly.
3. **Repository (Data Abstraction Layer):** Acts as the single source of truth for data operations. It decides whether to serve data from the local database cache (MMKV) or query the network API client (`apiRequest`).
4. **Model (Data Stores & Cache Providers):** State containers (`mobx-state-tree` stores) and persistence helpers (`offlineCache`).

```
[View (React Component)]
          │
          ▼
[ViewModel (Custom Hook)]
          │
          ▼
[Repository Layer (e.g. PostRepository)]  <--- Abstracts caching/fetch logic
          │
     ┌────┴────┐
     ▼         ▼
[API Client] [Offline Cache (MMKV)]
```

### 📂 Directory Structure of Repositories
All repositories reside in the `@app/core` package under `packages/core/src/repositories/`:
- `PostRepository.ts`: Manages caching logic (checking MMKV first) and refresh mechanics for post objects.
- `AuthRepository.ts`: Encapsulates authentication calls and payload processing.

### 📝 Repository Code Example
A repository abstracts data source decisions using a cache-first or network-fallback strategy:
```typescript
export const PostRepository = {
  // Checks cache first, falls back to API on miss/expiration
  getPosts: async (ttlMinutes = 10): Promise<Post[]> => {
    return offlineCache.getOrFetch<Post[]>(
      'posts',
      async () => apiRequest<Post[]>({ url: ENDPOINTS.POSTS }),
      ttlMinutes
    );
  },
  
  // Forces a fetch from network and refreshes cache
  refreshPosts: async (ttlMinutes = 10): Promise<Post[]> => {
    const data = await apiRequest<Post[]>({ url: ENDPOINTS.POSTS });
    offlineCache.set('posts', data, ttlMinutes);
    return data;
  }
};
```

---

## 💎 Custom Reusable Components Reference

Here is a reference of all **31 custom components** located in `@app/ui` (`packages/ui/src/components/`):

### 1. `CustomButton`
Wraps React Native Paper's `Button` with default Inter fonts and loading states.
*   **Props:**
    *   `mode?: 'text' | 'outlined' | 'contained' | 'elevated' | 'contained-tonal'` (default: `'contained'`)
    *   `onPress: () => void`
    *   `loading?: boolean`
    *   `disabled?: boolean`
    *   `icon?: string`
    *   `children: React.ReactNode`
    *   `style?: ViewStyle`
    *   `labelStyle?: TextStyle`
*   **Usage:**
    ```tsx
    <CustomButton mode="contained" onPress={handlePress} loading={isLoading}>
      Click Me
    </CustomButton>
    ```

### 2. `CustomInput`
Wraps `TextInput` with an outlines design, input icons, and validation error messages.
*   **Props:**
    *   `label: string`
    *   `value: string`
    *   `onChangeText: (text: string) => void`
    *   `placeholder?: string`
    *   `error?: string`
    *   `secureTextEntry?: boolean` (adds auto password visibility toggle)
    *   `keyboardType?: KeyboardTypeOptions`
    *   `leftIcon?: string`
    *   `rightIcon?: string`
    *   `onRightIconPress?: () => void`
*   **Usage:**
    ```tsx
    <CustomInput
      label="Email"
      value={email}
      onChangeText={setEmail}
      error={emailError}
      leftIcon="email-outline"
    />
    ```

### 3. `CustomCard`
A wrapper around `Card` to show content blocks.
*   **Props:**
    *   `title: string`
    *   `subtitle?: string`
    *   `coverImage?: string`
    *   `content?: string`
    *   `actions?: React.ReactNode`
    *   `onPress?: () => void`
*   **Usage:**
    ```tsx
    <CustomCard
      title="Recent Post"
      content="This is the post description."
      coverImage="https://picsum.photos/700"
    />
    ```

### 4. `CustomHeader`
Standard Appbar navigation header.
*   **Props:**
    *   `title: string`
    *   `subtitle?: string`
    *   `onBackPress?: () => void`
    *   `onMenuPress?: () => void` (Drawer toggle handle)
    *   `actions?: Array<{ icon: string; onPress: () => void }>`

### 5. `CustomFAB`
Floating Action Button.
*   **Props:**
    *   `icon: string`
    *   `onPress: () => void`
    *   `label?: string`

### 6. `CustomLoader`
Centered fullscreen backdrop activity spinner.
*   **Props:**
    *   `visible: boolean`
    *   `message?: string`
    *   `isFullScreen?: boolean` (default: `true`)

### 7. `CustomThemeToggler`
A round icon button that toggles `themeStore.isDarkMode`.

### 8. `CustomLanguageToggler`
Segmented buttons that switch language settings between `'en'` and `'bn'`.

### 9. `CustomListItem`
Settings list row.
*   **Props:**
    *   `title: string`
    *   `description?: string`
    *   `leftIcon?: string`
    *   `rightType?: 'arrow' | 'switch' | 'badge' | 'none'`
    *   `switchValue?: boolean`
    *   `onSwitchChange?: (val: boolean) => void`
    *   `badgeValue?: string | number`

### 10. `CustomSwitch`
Labeled switch toggle.
*   **Props:**
    *   `label: string`
    *   `value: boolean`
    *   `onValueChange: (val: boolean) => void`

### 11. `CustomBadge`
Simple circular badge wrapper.
*   **Props:**
    *   `children?: string | number`
    *   `visible?: boolean`
    *   `size?: number`

### 12. `CustomAvatar`
Renders initials, standard icons, or custom images.
*   **Props:**
    *   `type?: 'text' | 'image' | 'icon'`
    *   `value: string` (initials text, image URL, or icon string)
    *   `size?: number`

### 13. `CustomDialog`
Standard modal alert dialog inside a Paper Portal.
*   **Props:**
    *   `visible: boolean`
    *   `title: string`
    *   `message: string`
    *   `onConfirm: () => void`
    *   `onDismiss: () => void`
    *   `confirmText?: string`
    *   `cancelText?: string`
    *   `showCancel?: boolean`

### 14. `CustomBottomSheet`
A custom modal drawer slide-up component.
*   **Props:**
    *   `visible: boolean`
    *   `onClose: () => void`
    *   `children: React.ReactNode`

### 15. `CustomDropdown`
A dropdown select menu wrapping React Native Paper's `Menu` and `TextInput` components.
*   **Props:**
    *   `label: string`
    *   `items: DropdownItem[]` (array of objects with `label` and `value`)
    *   `value: string | ''`
    *   `onValueChange: (value: string) => void`
    *   `placeholder?: string`
    *   `error?: string`
    *   `disabled?: boolean`
    *   `style?: ViewStyle`
*   **Usage:**
    ```tsx
    <CustomDropdown
      label="Priority"
      value={priority}
      onValueChange={setPriority}
      items={[
        { label: 'Low', value: 'low' },
        { label: 'High', value: 'high' },
      ]}
    />
    ```

### 16. `CustomChip`
Chip tag container.
*   **Props:**
    *   `children: React.ReactNode`
    *   `selected?: boolean`
    *   `onPress?: () => void`
    *   `onClose?: () => void`

### 17. `CustomProgressBar`
Horizontal progress indicator.
*   **Props:**
    *   `progress: number` (value from `0` to `1`)
    *   `label?: string`

### 18. `CustomDivider`
Consistent spacing divider.
*   **Props:**
    *   `marginVertical?: number` (default: `12`)

### 19. `CustomSearchbar`
Clean text Searchbar.
*   **Props:**
    *   `value: string`
    *   `onChangeText: (text: string) => void`
    *   `placeholder?: string`

### 20. `CustomFilePicker`
Pick single/multiple documents utilizing `@react-native-documents/picker`.
*   **Props:**
    *   `onFilePicked: (files: PickedFile[]) => void`
    *   `allowMultiSelection?: boolean`
    *   `allowedTypes?: string[]` (e.g. `['application/pdf']`)
    *   `label?: string`

### 21. `CustomDownloadButton`
A high-level download trigger with full state feedback (progress bar, size calculation, cancel, and open file functions).
*   **Props:**
    *   `url: string` (download endpoint)
    *   `filename: string` (saved filename including extension)
    *   `label?: string` (button label)
    *   `destination?: 'documents' | 'cache'` (storage target directory)
    *   `headers?: Record<string, string>` (custom HTTP request headers)
    *   `onSuccess?: (filePath: string) => void` (callback with absolute saved path)
    *   `onError?: (error: string) => void` (callback with error details)
    *   `style?: ViewStyle`
*   **Usage:**
    ```tsx
    <CustomDownloadButton
      url="https://example.com/file.pdf"
      filename="document.pdf"
      label="Download Document"
    />
    ```

### 22. `CustomDatePicker`
Wraps `@react-native-community/datetimepicker` with high-level platform logic (native picker on Android, Dialog spinner on iOS).
*   **Props:**
    *   `label: string`
    *   `value?: Date`
    *   `onChange?: (date: Date) => void`
    *   `mode?: 'date' | 'time' | 'datetime'`
    *   `placeholder?: string`
    *   `error?: string`
    *   `disabled?: boolean`
    *   `minimumDate?: Date`
    *   `maximumDate?: Date`
    *   `formatString?: (date: Date) => string`
*   **Usage:**
    ```tsx
    <CustomDatePicker
      label="Birth Date"
      value={birthDate}
      onChange={setBirthDate}
      mode="date"
    />
    ```

### 23. `CustomFormInput`
Controlled text input component wrapper that integrates `CustomInput` with React Hook Form.
*   **Props:**
    *   `name: string` (RHF register key)
    *   `control: Control<any>` (RHF control context)
    *   `rules?: RegisterOptions` (validation constraints)
    *   `label: string`
    *   `placeholder?: string`
    *   `secureTextEntry?: boolean`
    *   `leftIcon?: string`
    *   `rightIcon?: string`
    *   `disabled?: boolean`

### 24. `CustomFormSwitch`
Controlled switch component wrapper that integrates `CustomSwitch` with React Hook Form.
*   **Props:**
    *   `name: string` (RHF register key)
    *   `control: Control<any>` (RHF control context)
    *   `rules?: RegisterOptions` (validation constraints)
    *   `label: string`
    *   `disabled?: boolean`

### 25. `CustomFormDropdown`
Controlled dropdown select component wrapper that integrates `CustomDropdown` with React Hook Form.
*   **Props:**
    *   `name: string` (RHF register key)
    *   `control: Control<any>` (RHF control context)
    *   `rules?: RegisterOptions` (validation constraints)
    *   `defaultValue?: string`
    *   `label: string`
    *   `items: DropdownItem[]`
    *   `placeholder?: string`
    *   `disabled?: boolean`
    *   `style?: ViewStyle`
*   **Usage:**
    ```tsx
    <CustomFormDropdown
      name="priority"
      control={control}
      label="Priority"
      items={[
        { label: 'Low', value: 'low' },
        { label: 'High', value: 'high' },
      ]}
    />
    ```

### 26. `CustomFormFilePicker`
Controlled document picker component wrapper that integrates `CustomFilePicker` with React Hook Form, exposing errors via Paper's `HelperText`.
*   **Props:**
    *   `name: string` (RHF register key)
    *   `control: Control<any>` (RHF control context)
    *   `rules?: RegisterOptions` (validation constraints)
    *   `allowMultiSelection?: boolean`
    *   `allowedTypes?: string[]`
    *   `label?: string`

### 27. `CustomFormDatePicker`
Controlled date picker component wrapper that integrates `CustomDatePicker` with React Hook Form.
*   **Props:**
    *   `name: string` (RHF register key)
    *   `control: Control<any>` (RHF control context)
    *   `rules?: RegisterOptions` (validation constraints)
    *   `label: string`
    *   `mode?: 'date' | 'time' | 'datetime'`
    *   `placeholder?: string`
    *   `disabled?: boolean`
    *   `minimumDate?: Date`
    *   `maximumDate?: Date`

### 28. `Row` & 29. `Col` (Grid System)
Grid systems built for flex partitioning.
*   **Row Props:**
    *   `alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch'`
    *   `justifyContent?: 'flex-start' | 'center' | 'space-between'`
    *   `gap?: number`
*   **Col Props:**
    *   `span?: number` (1 to 12)
    *   `flex?: number | string` (proportional share)
*   **Usage:**
    ```tsx
    <Row gap={12}>
      <Col span={6}>
        <Text>Left Block (50%)</Text>
      </Col>
      <Col span={6}>
        <Text>Right Block (50%)</Text>
      </Col>
    </Row>
    ```

### 30. `CustomToast`
Global toast notification overlay, subscribing automatically to the `@app/core` `ToastStore`.
*   **Triggering / Usage:**
    ```typescript
    import { useStores } from '@app/core';
    const { toastStore } = useStores();

    // Show default info Toast
    toastStore.show("Connecting to server...");

    // Show success Toast
    toastStore.show("Profile saved successfully!", "success");

    // Show error Toast
    toastStore.show("Failed to update profile.", "error");

    // Show warning Toast
    toastStore.show("Please enter a valid phone number.", "warning");

    // Show Toast with custom duration (e.g. 5 seconds)
    toastStore.show("Long running process started.", "info", 5000);
    ```

### 31. `CustomFlatList`
Highly performant custom wrapper around React Native's `FlatList`, pre-configured with rendering optimizations and built-in scroll states.
*   **Props:**
    *   `data: T[] | null | undefined`
    *   `renderItem: ListRenderItem<T>`
    *   `loading?: boolean` (initial loading spinner)
    *   `loadingMore?: boolean` (pagination bottom spinner)
    *   `onLoadMore?: () => void` (onEndReached trigger)
    *   `onRefresh?: () => void` (pull-to-refresh trigger)
    *   `refreshing?: boolean`
    *   `emptyText?: string`
    *   `emptyIcon?: string`
    *   `emptyComponent?: React.ReactNode`
*   **Usage:**
    ```tsx
    <CustomFlatList
      data={items}
      renderItem={({ item }) => <Text>{item.title}</Text>}
      loading={isLoading}
      loadingMore={isFetchingMore}
      onLoadMore={fetchMoreItems}
      onRefresh={refreshItems}
      refreshing={isRefreshing}
    />
    ```

### Programmatic Document Viewing (`useDocumentViewer` Hook)

For programmatic document viewing (such as when clicking a list item, card, grid tab, or custom UI layout), use the `useDocumentViewer` hook from `@app/core`. Under the hood, it transparently downloads remote documents (with progress indicators) to cache and launches native viewing apps (iOS QuickLook / Android ACTION_VIEW intent).

*   **Hook Signature:**
    ```typescript
    const { 
      view, 
      cancel, 
      reset, 
      isDownloading, 
      progress, 
      bytesReceived, 
      totalBytes, 
      error, 
      filePath 
    } = useDocumentViewer();
    ```
*   **Usage Example:**
    ```tsx
    import React from 'react';
    import { useDocumentViewer } from '@app/core';
    import { CustomListItem, CustomProgressBar } from '@app/ui';
    import { View, Text } from 'react-native';

    const DocumentList = () => {
      const { view, isDownloading, progress, error } = useDocumentViewer();

      const handlePress = (uri: string, name: string) => {
        view({ uri, filename: name, title: name });
      };

      return (
        <View>
          {isDownloading && (
            <View style={{ margin: 10 }}>
              <Text>Downloading... {Math.round(progress * 100)}%</Text>
              <CustomProgressBar progress={progress} />
            </View>
          )}
          <CustomListItem
            title="Invoice Report"
            description="Click to download & preview sample PDF"
            leftIcon="file-pdf-box"
            rightType="arrow"
            onPress={() => handlePress('https://example.com/invoice.pdf', 'invoice.pdf')}
          />
        </View>
      );
    };
    ```

---

## 📝 Form Handling & Validation (React Hook Form)

The template utilizes **React Hook Form** to manage form states and validate inputs efficiently. Controlled form inputs under `src/components/` handle value bindings, blur triggers, and error messages automatically.

### Creating and Validating Forms

1. Define the validation constraints in the **View** component (e.g. `LoginScreen.tsx`):
   ```tsx
   <CustomFormInput
     name="email"
     control={viewModel.control}
     label="Email Address"
     rules={{
       required: "Email is required",
       pattern: {
         value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
         message: "Please enter a valid email address",
       },
     }}
   />
   ```

2. Expose the `control` and standard submit/state helpers in the **ViewModel** hook (e.g. `useLoginViewModel.ts`):
   ```typescript
   import { useForm } from 'react-hook-form';

   export const useLoginViewModel = () => {
     const { control, handleSubmit } = useForm({
       defaultValues: { email: '', password: '' },
       mode: 'onBlur', // Validates when users leave a field
     });

     const submitLogin = async () => {
       return await handleSubmit(async (data) => {
         // Executed only if validations succeed
         console.log(data.email, data.password);
       })();
     };

     return { control, submitLogin };
   };
   ```

---

## ⚡ State Management (MobX-State-Tree)

All stores are declared under `packages/core/src/store/` (exposed via `@app/core`):
- **`AuthStore.ts`**: Handles authentication states and login/logout action sequences.
- **`ThemeStore.ts`**: Manages light/dark mode selection.
- **`LanguageStore.ts`**: Updates default translations and language context.

### RootStore & Snapshots (Automatic Persistence)
In `packages/core/src/store/index.tsx`, the `RootStore` combined model binds all sub-stores. We leverage MST's native snapshots:
*   **On Startup:** The complete store tree is loaded synchronously from MMKV and instantiated:
    ```typescript
    const savedState = storage.getString(ROOT_STORAGE_KEY);
    export const rootStore = RootStore.create(savedState ? JSON.parse(savedState) : {});
    ```
*   **On Modifications:** MST's `onSnapshot` hook writes updates back to MMKV in a single serialized block:
    ```typescript
    onSnapshot(rootStore, (snapshot) => {
      storage.set(ROOT_STORAGE_KEY, JSON.stringify(snapshot));
    });
    ```

---

## 🛜 Offline Caching System

The template implements a robust cache manager in `packages/core/src/utils/offlineCache.ts` (exposed via `@app/core`):
*   `offlineCache.set(key, data, expireInMinutes)`: Save data to cache with a custom TTL.
*   `offlineCache.get(key)`: Retrieve cache (returns `null` if expired).
*   `offlineCache.getOrFetch(key, fetchFn, expireInMinutes)`: Tries returning valid cache. If expired or missing, triggers the network function and updates the cache.
*   **Network Failure Fallback:** If the API fetch throws an exception (due to network loss), it automatically serves the expired cached data as a fallback so that the screen remains functional.

---

## 🌐 API Networking (Axios & Default Encryption)

The Axios client wrapper in `packages/core/src/network/apiClient.ts` (exposed via `@app/core`) includes:
- **Automatic Headers:** Injects authorization headers if `authStore.authToken` is populated.
- **Auto Logout:** Automatically logs the user out if a request returns a `401 Unauthorized` status.
- **Normalized Errors:** Normalizes network failures and handles request/response logging in `__DEV__` mode.
- **Default Payload Encryption (AES-256):** Transparently encrypts request bodies and decrypts response bodies.

### Payload Encryption Toggles & Native Crypto Limitations

Encryption is powered by `crypto-js` (fully functional on JS-only layers without native link bindings).

> [!WARNING]
> In React Native, the native Node.js `crypto` module is not available, and JS engines (like Hermes) do not expose `global.crypto.getRandomValues()` by default. CryptoJS falls back to `Math.random()` to generate encryption salts if not polyfilled.
> 
> For cryptographically secure random number generation (CSPRNG), you must install `react-native-get-random-values` and import it at the top of your `index.js` entry point.

1.  **Global Toggles (On by Default):**
    In `packages/core/src/network/apiClient.ts`, requests and responses are encrypted/decrypted by default:
    ```typescript
    export const IS_API_ENCRYPTION_ENABLED = true; // Turn on/off request encryption
    export const IS_API_DECRYPTION_ENABLED = true; // Turn on/off response decryption
    ```

2.  **Per-Request Toggles:**
    If you want to bypass encryption or decryption for specific endpoints, pass `encrypt` or `decrypt` configs to your request:
    ```typescript
    // Send raw payload and bypass response decryption
    const response = await apiClient.post('/submit-data', data, {
      encrypt: false,
      decrypt: false
    });
    ```

3.  **Encryption Standard:**
    Encrypted request payloads are serialized to string, AES-encrypted, and wrapped in:
    ```json
    {
      "payload": "U2FsdGVkX1+...encrypted..."
    }
    ```
    A header of `X-Encrypted: true` is automatically injected into the request headers. If the server returns an encrypted payload (indicated by the `X-Encrypted: true` response header), the client will automatically decrypt it.

---

## 🗺️ How to Create a New Screen

To add a new screen (e.g. `Dashboard`):

1.  **Create a folder:** `src/screens/dashboard/`.
2.  **Create ViewModel Hook (`useDashboardViewModel.ts`):**
    ```typescript
    import { useState } from 'react';
    export const useDashboardViewModel = () => {
      const [data, setData] = useState(null);
      // add functions/states
      return { data };
    };
    ```
3.  **Create View Screen (`DashboardScreen.tsx`):**
    ```tsx
    import React from 'react';
    import { View } from 'react-native';
    import { observer } from 'mobx-react-lite';
    import { useDashboardViewModel } from './useDashboardViewModel';
    
    export const DashboardScreen = observer(() => {
      const viewModel = useDashboardViewModel();
      return (
        <View />
      );
    });
    ```
4.  **Register Screen:** Add the screen references to `src/navigation/DrawerNavigator.tsx` or `src/navigation/TabNavigator.tsx`.

---

## 🔗 Deep Linking Configuration

The app is configured for deep linking (custom URL schemes and Universal/App Links) out-of-the-box:

*   **iOS URL Scheme:** Registered in `Info.plist` under `CFBundleURLTypes` using the scheme `Managerium_Health`.
*   **iOS URL Handler:** Implemented inside `AppDelegate.swift` overriding `application(_:open:options:)` and Universal Links continuation.
*   **Android Scheme & Hosts:** Configured in `AndroidManifest.xml` under `<intent-filter>` mapping the scheme `Managerium_Health` and host `Managerium_Health.com`.
*   **React Navigation Mapping:** Configured inside `src/navigation/AppNavigator.tsx` pointing to nested screens:
    *   `login` -> Login Screen
    *   `main/home` -> Find Doctors tab
    *   `main/activity` -> Appointments tab
    *   `main/me` -> Profile tab
    *   `settings` -> Settings Screen

### How to Test Deep Linking

#### Testing on Android Emulator:
```bash
# Test URL Scheme (Custom URI)
npx uri-scheme open "Managerium_Health://settings" --android

# Test App Link (HTTP/HTTPS)
npx uri-scheme open "https://Managerium_Health.com/main/home" --android
```

#### Testing on iOS Simulator:
```bash
# Test URL Scheme (Custom URI)
npx uri-scheme open "Managerium_Health://settings" --ios

# Test Universal Link (HTTP/HTTPS)
npx uri-scheme open "https://Managerium_Health.com/main/home" --ios
```

## ➕ How to Add a New Workspace Package (Module)

To extend the monorepo by adding a new local workspace package (e.g. `@app/features` or `@app/services`), follow these steps:

### 1. Create the Package Folder Structure
Create a new subdirectory under `packages/` with a `src` folder and entrypoint file:
```bash
mkdir -p packages/features/src
touch packages/features/src/index.ts
```

### 2. Configure `package.json`
Create `packages/features/package.json` with the following configuration:
```json
{
  "name": "@app/features",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "peerDependencies": {
    "react": "*",
    "react-native": "*"
  },
  "dependencies": {}
}
```
*Note: Make sure `"name"` is prefixed with your workspace scope (e.g. `@app/`) and `"private": true` is specified.*

### 3. Configure `tsconfig.json`
Create `packages/features/tsconfig.json` so that the package compiler extends the root rules:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

### 4. Register Path Aliases
To enable module resolution and absolute imports in the IDE and during compilation without manual path linking, register the new package in the root `_tsconfig.json` under `compilerOptions.paths`:
```json
    "paths": {
      "@app/core": ["packages/core/src"],
      "@app/ui": ["packages/ui/src"],
      "@app/features": ["packages/features/src"]
    }
```

### 5. Add Export Definitions
In the entrypoint `packages/features/src/index.ts`, export the public modules and components of this package:
```typescript
// Example:
// export * from './components/MyFeature';
```

### 6. Install and Link the Package
Run the workspace installation command from the project root to link the new workspace:
```bash
yarn install
```
This automatically symlinks `@app/features` under `node_modules/@app/features` using Yarn Workspaces.

### 7. Import and Use the Package
To use this new package in the main React Native application or inside another package:
1. Reference it in dependencies:
   - If using it in the main application, add `@app/features` under `dependencies` in the root `package.json`:
     ```json
     "@app/features": "*"
     ```
   - If using it inside another package (e.g. `@app/ui`), add it to that package's `dependencies` or `peerDependencies`.
2. Import modules absolutely:
   ```tsx
   import { MyFeatureComponent } from '@app/features';
   ```

### 8. Installing External npm Packages to a Specific Workspace Package
To add dependencies directly to a specific workspace package (e.g. adding `lodash` to `@app/core`), run the following command from the monorepo root:
```bash
yarn workspace <workspace-name> add <package-name>
# Example:
yarn workspace @app/core add lodash
```

To add devDependencies (such as type definitions) to a workspace package:
```bash
yarn workspace <workspace-name> add -D <package-name>
# Example:
yarn workspace @app/core add -D @types/lodash
```

### 9. Working with Native Code (External Packages, Custom Modules & Scaffolding)

When working in a Yarn Workspaces monorepo, managing native code dependencies or writing custom native modules requires a few additional steps to ensure React Native's autolinking finds and builds the native sources.

#### Scenario A: Adding an External npm Package with Native Code
If you want to install an external library that contains native code (e.g. `react-native-device-info`, `react-native-video`) to be used inside your custom workspace package (e.g. `@app/core`):

1. **Install the package to the workspace**:
   Run the command from the monorepo root:
   ```bash
   yarn workspace @app/core add react-native-device-info
   ```
2. **Re-run root installation**:
   Ensure dependencies are linked across the workspace:
   ```bash
   yarn install
   ```
3. **Link Native CocoaPods (iOS only)**:
   Navigate to the native `ios/` folder at the root of the project and run CocoaPods linking:
   ```bash
   cd ios && pod install && cd ..
   ```
4. **Rebuild the Native Binaries**:
   Since the library contains native code, you must recompile the Android/iOS apps instead of relying on JavaScript hot reloads:
   ```bash
   yarn android
   # or
   yarn ios
   ```

#### Scenario B: Scaffolding a New Local Native Package with `create-react-native-library`
If you want to create a brand-new native module or library as a standalone workspace package automatically (without writing any native boilerplate or configuration files manually):

1. **Run the Scaffolder**:
   Run the CLI command from the project root and specify the target path inside your `packages/` directory:
   ```bash
   npx create-react-native-library@latest packages/my-new-module
   ```
2. **Respond to the Interactive Prompts**:
   - **What is the name of the package?** Specify `@app/my-new-module` (using the `@app/` monorepo scope prefix).
   - **What kind of library?** Select the type (e.g., Native module in Swift/Kotlin or Kotlin/Objective-C).
   - **Do you want to generate an example app?** **Select "No"** (uncheck it), because we already have the main React Native application at the workspace root, and we don't want a nested example application inside our `packages/` directory.
3. **Register in Root Dependencies**:
   Add the new package to your dependencies in the root `package.json`:
   ```json
   "@app/my-new-module": "*"
   ```
4. **Configure Path Aliases**:
   Add the package alias to the root `_tsconfig.json` (and `tsconfig.json`) under `compilerOptions.paths` so TypeScript resolves imports:
   ```json
   "@app/my-new-module": ["packages/my-new-module/src"]
   ```
5. **Autolink and Link**:
   Run `yarn install` at the project root to link the workspace, and link the native iOS pods:
   ```bash
   yarn install
   cd ios && pod install && cd ..
   ```
6. **Rebuild the App**:
   Recompile your application to load the native module:
   ```bash
   yarn android
   # or
   yarn ios
   ```

#### Scenario C: Adding a TurboModule (New Architecture)
To create a high-performance native module utilizing React Native's New Architecture (JSI / TurboModules) using scaffolding:

1. **Run the Scaffolder**:
   Run the generator from the project root and specify the target path inside your `packages/` directory:
   ```bash
   npx create-react-native-library@latest packages/my-turbo-module
   ```
2. **Respond to the Interactive Prompts**:
   - **What is the name of the package?** Specify `@app/my-turbo-module` (using the `@app/` monorepo scope prefix).
   - **What kind of library?** Select **TurboModule** (or Fabric component).
   - **Do you want to generate an example app?** **Select "No"** (uncheck it).
3. **Register, Autolink, and Link**:
   Follow steps 3 to 6 from Scenario B to add the module to root dependencies, configure TypeScript path aliases, link native CocoaPods (`pod install`), and rebuild your application.

---

## 🔐 Environment Variables

The project utilizes `react-native-dotenv` to manage environment configurations securely and transparently in JavaScript/TypeScript layers.

1. **Configuration Files**:
   - `.env`: Contains your local environment values (git ignored).
   - `.env.example`: Template for environment variables (version controlled).

2. **Usage**:
   Define variables inside `.env`:
   ```env
   API_URL=https://api.example.com
   ```

   Import them in your TS/JS files:
   ```typescript
   import { API_URL } from '@env';

   console.log("Backend URL:", API_URL);
   ```

3. **TypeScript Support**:
   Type declarations are registered in `env.d.ts` at the workspace root. When adding new environment variables, update `env.d.ts` to ensure full autocomplete and type safety.

## 🔄 Merge Validation & CI Pipeline

To maintain code standards, prevent runtime errors, and ensure type safety, the repository implements a dual-gate validation pipeline:

### 1. Local Git Hook Validation (Husky & lint-staged)
We utilize **Husky** and **lint-staged** to validate files locally before changes are pushed:
*   **Pre-Commit Hook**: Runs `eslint --fix` on staged `.ts` and `.tsx` files. If there are unresolved lint/style issues, the commit is blocked.
*   **Pre-Push Hook**: Runs the full compiler type check (`yarn tsc -p _tsconfig.json --noEmit`). If there are any compile errors, the push is blocked.

### 2. Remote CI Gating (GitHub Actions)
For every pull request and merge targeting `main`, `master`, or `development`, a remote pipeline ([ci.yml](.github/workflows/ci.yml)) automatically runs:
1. Dependency installation checks with cached node modules.
2. Code style validation (`yarn lint`).
3. Strict type compilation verification (`yarn tsc -p _tsconfig.json --noEmit`).

Branches cannot be merged if any pipeline step fails.

---

## ⚙️ Getting Started

1. **Install dependencies:**
   ```bash
   yarn install
   ```

2. **Configure environment:** copy `.env.example` to `.env` and fill in the values.

3. **Install Pods (for iOS):**
   ```bash
   cd ios && pod install && cd ..
   ```

4. **Start and Run:**
   - Run Android: `yarn android`
   - Run iOS: `yarn ios`
