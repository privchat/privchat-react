# `@privchat/react`

Headless React integration layer for [`@privchat/sdk`](../privchat-sdk-typescript/).
Provides a `Provider`, hooks, and ViewModel selectors. Does **not** ship visual
components, a router, or browser multi-tab logic — those belong to the
consuming app (e.g. `privchat-web`).

> **Status:** R0 skeleton. Currently `private: true` (workspace-only). Will
> graduate to a published `@privchat/react` once `privchat-web` exercises the
> hook surface against real UI.

---

## Scope

See [`docs/PRIVCHAT_REACT_ARCHITECTURE.md`](./docs/PRIVCHAT_REACT_ARCHITECTURE.md)
for the full boundary contract. Short version:

| In scope                                                  | Out of scope (lives in `privchat-web` / host app) |
| --------------------------------------------------------- | ------------------------------------------------- |
| `<PrivchatProvider>` + `useContext` plumbing              | Visual components (bubbles, lists, layout)        |
| `useSyncExternalStore`-based hooks over SDK events        | `shadcn/ui`, Tailwind, theming                    |
| ViewModel selectors over SDK records                      | Router, page composition                          |
| Headless timeline / composer state controllers (R3+)      | `BroadcastChannel`, multi-tab leader election     |
| `PrivchatClientAdapter` seam for direct / worker setups   | `SharedWorker` / `DedicatedWorker` instantiation  |
| Pure logic; no browser globals                            | Media viewer, file uploader, virtualization       |

---

## Install (local development)

This package links to the SDK via `file:`. From the workspace root:

```bash
cd privchat-sdk-typescript && npm install && npm run build
cd ../privchat-react && npm install
```

`react` is declared as a `peerDependency` so that the consuming app owns the
single React copy. Two React copies → `Invalid Hook Call` at runtime.

---

## R0 surface

```tsx
import { PrivchatClient } from '@privchat/sdk';
import {
  PrivchatProvider,
  DirectClientAdapter,
  useConnectionState,
  usePrivchatClient,
} from '@privchat/react';

const client = new PrivchatClient({ transport });
const adapter = new DirectClientAdapter(client);

function App() {
  return (
    <PrivchatProvider adapter={adapter}>
      <ConnectionBadge />
    </PrivchatProvider>
  );
}

function ConnectionBadge() {
  const state = useConnectionState();
  return <span data-state={state}>{state}</span>;
}
```

The Provider does **not** call `connect()`, `authenticate()`, or `dispose()` —
the host owns lifecycle because policy varies sharply between web (visibility
+ multi-tab), Tauri (single process), and Cocos (scene transitions).

---

## Roadmap

| Phase | Surface                                                        | Driven by                            |
| ----- | -------------------------------------------------------------- | ------------------------------------ |
| R0    | Provider, adapter, `usePrivchatClient`, `useConnectionState`   | this skeleton                        |
| R1    | Channel list, open conversation                                | first `privchat-web` real page       |
| R2    | Messages, send, outbox + first ViewModels                      | timeline page in `privchat-web`      |
| R3    | Headless timeline / composer controllers                       | scroll & input in `privchat-web`     |
| R4+   | Read cursors, typing, presence                                 | feature-by-feature                   |

Each phase ships only when a real UI need surfaces. No speculative API.

---

## License

Apache-2.0
