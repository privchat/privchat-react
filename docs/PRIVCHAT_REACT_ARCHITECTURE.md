# `@privchat/react` Architecture

Headless React integration layer for `@privchat/sdk`. This document locks the
**scope and boundaries** of the package so future contributions don't drift it
into a UI kit, a router, a worker runtime, or a multi-tab coordinator. It is
also the contract between `@privchat/react` and its first consumer,
`privchat-web`.

The package is currently a `private: true` workspace package. It will be
published as `@privchat/react` only after `privchat-web` exercises the API
shape against a real timeline, composer, and outbox UI.

---

## 1. Position in the ecosystem

```
@privchat/sdk            // protocol / transport / cache / sync / outbox / events
@privchat/react          // ← this package: Provider + hooks + ViewModels (headless)
@privchat/cocos          // (planned) Cocos Creator integration
privchat-web             // official React Web App; first consumer of @privchat/react
privchat-ui              // KMP UI kit (separate ecosystem)
```

The relationship is **strictly one-way**: `@privchat/react` depends on
`@privchat/sdk`. It does NOT depend on Cocos, Tauri, Vue, or any specific
visual library. `privchat-web` depends on both.

Local development uses npm `file:` linking:

```jsonc
// privchat-react/package.json
{
  "devDependencies": {
    "@privchat/sdk": "file:../privchat-sdk-typescript"
  },
  "peerDependencies": {
    "@privchat/sdk": "*",
    "react": "^19.0.0"
  }
}
```

`react` is a **peerDependency**, not a dependency. The web app must own the
single React copy; nesting React under `@privchat/react` would produce two
copies and trigger `Invalid Hook Call` at runtime.

---

## 2. What `@privchat/react` IS responsible for

### 2.1 Provider

A single `<PrivchatProvider adapter={...}>` roots the React tree. Hooks read
the adapter via `useContext`. The Provider does NOT own connection lifecycle
(connect / authenticate / dispose) — the host does, because lifecycle policy
varies sharply between web (visibilitychange + multi-tab) and Tauri (single
process) and Cocos (scene transitions).

### 2.2 ClientAdapter abstraction

The Provider does not import `PrivchatClient` directly. It accepts anything
implementing `PrivchatClientAdapter`. The default `DirectClientAdapter` is a
trivial pass-through. Worker / SharedWorker bridges are also valid adapter
implementations and live in the consuming app, NOT in this package.

This seam is the reason the package can later support a SharedWorker setup
without rewriting hooks.

### 2.3 Hooks (`useSyncExternalStore`-based)

Every hook that observes SDK state MUST use `useSyncExternalStore`, not
`useState` + `useEffect` event listeners. Reasons:

- Concurrent-React-safe (no tearing on transitions).
- Synchronous initial snapshot — no `undefined` flash on mount.
- One subscription per adapter event stream, not one per hook instance with
  manual deduplication.

The first hook batch (R0) is intentionally narrow:

| Hook                  | Returns               | Subscribes to                    |
| --------------------- | --------------------- | -------------------------------- |
| `usePrivchatClient()` | `PrivchatClientAdapter` | (none — context only)          |
| `useConnectionState()` | `ConnectionState`    | `connection_state_changed`       |

Future batches (R1+) — to be added only after `privchat-web` proves they're
needed:

- `useChannelList()`
- `useActiveConversation()`
- `useMessages(channelId, channelType)`
- `useSendTextMessage(channelId, channelType)`
- `useOutbox()`
- `useReadCursor(channelId, channelType)`
- `usePeerReadCursor(channelId, channelType)`
- `usePresence(userIds)`
- `useTyping(channelId, channelType)`

### 2.4 ViewModel selectors (R2+)

SDK records (`MessageRecord`, `ChannelRecord`, `OutboxEntry`) are the
persistence shape. UI consumes a different shape. The boundary between them is
this package, not the consuming app — otherwise every consumer reinvents the
same projections.

Examples (not yet implemented):

```ts
interface ConversationListItemVM {
  id: string;
  title: string;
  unread_count: number;
  last_message_preview?: string;
  pinned: boolean;
  muted: boolean;
  updated_at: number;
}

type TimelineItem =
  | { type: 'date_separator'; date: string }
  | { type: 'unread_divider' }
  | { type: 'message_group'; messages: MessageBubbleVM[] }
  | { type: 'typing_indicator' };
```

ViewModels are added when a hook needs them. Don't pre-design.

### 2.5 Headless timeline / composer state (R3+)

`useTimelineController(channelId, channelType)` returns scroll-relevant state
(`items`, `loadOlder`, `isAtBottom`, `unreadAnchor`, `onScrollRangeChange`).
The actual virtualization and DOM lives in the web app — TanStack Virtual or
similar — because it's view-specific.

`useComposer(channelId, channelType)` returns `{ text, setText, replyTo,
setReplyTo, mentions, send, canSend, isSending }`. Editor implementation
(textarea / Lexical / Tiptap) lives in the web app.

---

## 3. What `@privchat/react` is NOT responsible for

This list is enforceable. New PRs adding any of the following belong in
`privchat-web` (or a separate package), not here.

| Concern                                                | Belongs to                                   |
| ------------------------------------------------------ | -------------------------------------------- |
| Visual components (`<MessageBubble>`, `<ChatLayout>`)  | `privchat-web` (or future `@privchat/react-ui`) |
| `shadcn/ui`, Tailwind, theming                         | `privchat-web`                               |
| Router (TanStack Router, React Router)                 | `privchat-web`                               |
| Page layouts, settings pages, group profile screens    | `privchat-web`                               |
| `BroadcastChannel` / leader election / multi-tab lock  | `privchat-web`                               |
| `SharedWorker` / `DedicatedWorker` instantiation       | `privchat-web` (uses adapter seam)           |
| `document.visibilitychange` policy / app-suspend       | `privchat-web`                               |
| Service Worker / push notification registration        | `privchat-web`                               |
| Media viewer, file uploader, image gallery             | `privchat-web`                               |
| TanStack Virtual / virtualized scroller implementation | `privchat-web`                               |
| Cocos node lifecycle, prefab binding                   | `@privchat/cocos`                            |
| Tauri IPC bridge                                       | future `@privchat/tauri`                     |

If a hook needs browser-specific APIs (`localStorage`, `BroadcastChannel`,
`document`), that's the signal it doesn't belong in this package — push the
behavior up into the host and expose a hook input parameter instead.

---

## 4. Phasing

### R0 — Minimum bootable (this skeleton)

- `ClientAdapter` interface + `DirectClientAdapter`
- `<PrivchatProvider>`
- `usePrivchatClient()`
- `useConnectionState()`

Goal: a `privchat-web` page can mount, see `disconnected`, call
`adapter`-wrapped `connect()` (via the host's own lifecycle code), and watch
the state flip to `authenticated`.

### R1 — Channel list + open conversation

Driven by the first real `privchat-web` page. Adapter will grow methods like
`observeChannelList`, `openConversation`, `cachedConversation`. Each addition
must come from a real UI need, not anticipation.

### R2 — Messages + send

`useMessages`, `useSendTextMessage`, `useOutbox`. ViewModel layer starts here
because raw `MessageRecord[]` will be insufficient for grouping / unread
divider / date separators.

### R3 — Headless timeline + composer

`useTimelineController`, `useComposer`. Goal: the web app's timeline component
is "pure rendering" with all behavior driven by hooks.

### R4+ — Read cursors, typing, presence, etc.

Added in the order `privchat-web` needs them. Stop before adding a hook that
has no UI consuming it.

---

## 5. Extension principles for future contributors

1. **One adapter method per real hook need.** Don't pre-declare the entire SDK
   surface on `PrivchatClientAdapter`. Each method on the adapter is a cost
   paid by every adapter implementation (Direct, Worker, Mock). Add methods
   when a hook requires them.

2. **`useSyncExternalStore` always.** No `useEffect` + `useState` for SDK
   subscriptions. If the hook can't be expressed as `useSyncExternalStore`,
   the SDK probably needs a synchronous-snapshot accessor added — surface that
   need to the SDK before working around it in React.

3. **No singletons.** Don't cache adapter results in module scope. Multiple
   `<PrivchatProvider>` mounts must work (Storybook, multi-account dev tools).

4. **No browser-only globals.** No `window`, `document`, `localStorage`,
   `BroadcastChannel`, `IndexedDB` direct usage. The SDK already manages IDB.
   Anything else is host territory.

5. **No visual deps.** No `framer-motion`, `radix`, `tailwind-variants`,
   `clsx`. If a contribution needs these, it belongs in the consuming app.

6. **ViewModels are pure functions.** Selector functions over SDK records.
   Side-effect-free, testable in isolation, no React imports.

---

## 6. Testing strategy

- `vitest` + `happy-dom` for hook tests.
- `@testing-library/react` for Provider mount / hook-under-Provider assertions.
- A `MockAdapter` test helper (lives in `tests/_helpers/`) implements
  `PrivchatClientAdapter` with a controllable event stream. Hooks are tested
  against this mock, not against a real `PrivchatClient`.
- Integration with the real SDK is verified at the `privchat-web` level
  (which has actual auth, IDB, timeline, etc.).

---

## 7. Open questions deferred

These are intentionally NOT decided in R0:

- **Suspense vs. snapshot-based loading.** R0 uses sync snapshots. If R2
  history loading needs Suspense, revisit there.
- **`useTransition` for marking-read batches.** Defer until profiling shows a
  real bottleneck.
- **Adapter error semantics.** Currently each method either resolves or
  throws. A typed error union may be needed once R2 introduces send failures
  surfaced to UI.
- **Hot module reloading for Provider.** The host (Vite) handles HMR; the
  Provider is an inert tree node.

Decisions land here once `privchat-web` forces them.
