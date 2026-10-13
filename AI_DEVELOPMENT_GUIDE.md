# Generative AI Agent & Developer Guidelines (Claude, Cursor, Gemini, ChatGPT)

This document provides a set of design guidelines, rules, and prompt templates to help human developers and AI assistants (Claude, Cursor, Gemini, ChatGPT, etc.) write code in this codebase with **maximum speed**, **minimal token usage**, and **strict null safety**.

---

## 🚀 1. Prompt & Context Optimization (Token Saving)

When pair programming with an AI assistant, excessive context size leads to slower response times, higher token costs, and increased hallucination rates. Follow these rules to keep context compact:

### Rule 1: Focus on Diffs and Targeted Blocks
*   **Do not** ask the AI to output the entire contents of a modified file.
*   **Do** instruct the AI to return code changes in unified diff format or as specific, replacement functions.
*   *Prompt template:* 
    > "Modify `useHomeViewModel.ts` to add refresh logic. Present your output as a code diff, showing only the lines that changed."

### Rule 2: Limit File Context Bloat
*   Only feed the AI files directly related to the current task. Do not upload or copy-paste unrelated helper utilities.
*   Provide type definitions (`.d.ts` or interface files) instead of the entire implementation files when the AI only needs to know how to call an API or helper.

### Rule 3: Keep AI Responses Concise
*   Request brief, direct code explanations. Instruct the AI to skip long preambles, summaries, and conversational filler.
*   *Prompt template:*
    > "Implement the follow-up logic. Respond with the code block only. No conversational filler."

---

## 🛡️ 2. Strict Null Safety & TypeScript Guardrails

JavaScript runtime crashes (e.g. `Cannot read properties of undefined`) are common. Avoid them by enforcing strict compile-time and runtime check rules.

### Rule 1: Mandatory Optional Chaining & Nullish Coalescing
*   Always use optional chaining (`?.`) when accessing values from nested properties, API payloads, or MobX state stores.
*   Provide robust default values using the nullish coalescing operator (`??`) instead of loose OR checks (`||`).
    ```typescript
    // ❌ Incorrect
    const title = response.data.post.title; 
    const count = response.data.count || 10; // Fails if count is 0

    //     Correct
    const title = response?.data?.post?.title ?? 'Untitled';
    const count = response?.data?.count ?? 10;
    ```

### Rule 2: Defensive API Mapping
*   Wrap data maps in check safeguards to protect against partial backend payloads or null elements.
    ```typescript
    const formatPosts = (rawPosts: any[] | null | undefined): Post[] => {
      if (!rawPosts || !Array.isArray(rawPosts)) return [];
      return rawPosts
        .filter(post => !!post && typeof post === 'object')
        .map(post => ({
          id: String(post.id ?? ''),
          title: String(post.title ?? 'No Title'),
          body: String(post.body ?? ''),
        }));
    };
    ```

### Rule 3: Component Style Prop Safety
*   Avoid declaring styles with loose `any` types. Custom style overrides passed to components must always utilize `StyleProp<ViewStyle>` or `StyleProp<TextStyle>` to avoid react-native styling mismatches.
    ```typescript
    import { StyleProp, ViewStyle } from 'react-native';

    interface MyComponentProps {
      style?: StyleProp<ViewStyle>;
    }
    ```

---

## 🏛️ 3. MVVM & Repository Pattern Conventions

Maintaining architectural separation ensures that clean-up and refactoring can be completed quickly and with fewer errors.

```
[View (React Component)] ──> [ViewModel (Custom Hook)] ──> [Repository (Data Layer)] ──> [Offline Cache / API Client]
```

### Rule 1: Pure Views
*   Views must contain only UI layout structure, theme bindings, and call handlers.
*   All component states, form submissions, and logic must be delegated to the ViewModel hook.

### Rule 2: Decoupled ViewModels
*   ViewModels (custom hooks) manage UI inputs and call repositories to fetch or update data.
*   ViewModels must **never** call `axios` or read/write to `MMKV` offline storage directly.

### Rule 3: Decoupled Repositories
*   Repositories act as the single source of truth for all data entities.
*   Use the caching patterns in `packages/core/src/utils/offlineCache.ts` to manage offline-first capabilities:
    ```typescript
    export const PostRepository = {
      getPosts: async (): Promise<Post[]> => {
        return offlineCache.getOrFetch<Post[]>(
          'posts',
          async () => apiRequest<Post[]>({ url: ENDPOINTS.POSTS }),
          10 // TTL in minutes
        );
      }
    };
    ```

---

## 🛠️ 4. Compiler & Static Checks verification

All code changes are automatically validated before entering the codebase. Always test locally to avoid failing Git gates:

1.  **Verify TypeScript Build**:
    ```bash
    yarn tsc -p _tsconfig.json --noEmit
    ```
2.  **Lint Check**:
    ```bash
    yarn lint
    ```

### Automated Git Gates:
*   **On `git commit`**: A pre-commit hook runs `lint-staged` which executes `eslint --fix` on staged files.
*   **On `git push`**: A pre-push hook runs the full TypeScript build compilation check. Pushing is blocked if compilation fails.
*   **On Pull Request / Merge**: A GitHub Actions workflow ([ci.yml](.github/workflows/ci.yml)) validates the entire branch before permitting a merge.

---

## 🔒 5. Cryptography & Security Conventions
All network API communication is encrypted and decrypted by default. Note the following runtime constraints:
*   **Default API Encryption**: Global switches `IS_API_ENCRYPTION_ENABLED` and `IS_API_DECRYPTION_ENABLED` are set to `true` inside `apiClient.ts`.
*   **Native Crypto Limitation**: The native Node.js `crypto` module is not available in the React Native Hermes runtime. Attempting to import `crypto` will fail at runtime.
*   **Secure Random Number Generation (CSPRNG)**: Since `global.crypto.getRandomValues()` is missing by default in React Native, CryptoJS uses `Math.random()` for salt generation unless a polyfill is active. If cryptographically secure random values are required, you must install `react-native-get-random-values` and import it at the top of your `index.js` entry point.
