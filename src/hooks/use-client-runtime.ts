import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  createClientRuntime,
  resolveRuntimeBanner,
  type ClientRuntime,
  type ConnectionState,
  type ConnectivityRuntimeState,
  type RuntimeBannerKind,
  type SendQueueRuntimeState,
  type SyncRuntimeState,
} from '@privchat/sdk';
import type { SequencedSdkEvent } from '@privchat/sdk';
import type { PrivchatClientAdapter } from '../adapter/client-adapter.js';
import { usePrivchatClient } from './use-privchat-client.js';

/**
 * P4.2 运行时可靠性层（CLIENT_GLOBAL_STATE §17）的 react 接入。
 *
 * 每个 adapter 共享**一个** runtime 实例（单一运行时真源），由真实 SDK 事件喂：
 * connection_state_changed（含显式 reconnecting）/ auth_expired / session_expired /
 * outbox 快照 / navigator online·offline。UI 只订阅这里，不各自判断连接/同步/发送态。
 */
const runtimes = new WeakMap<object, ClientRuntime>();

export function getClientRuntime(adapter: PrivchatClientAdapter): ClientRuntime {
  const key = adapter as unknown as object;
  const existing = runtimes.get(key);
  if (existing !== undefined) return existing;
  const runtime = createClientRuntime({
    onConnectionStateChanged: (cb) =>
      adapter.observeEvents((env: SequencedSdkEvent) => {
        if (env.event.type === 'connection_state_changed') {
          cb(env.event as unknown as { state: ConnectionState });
        }
      }),
    onAuthExpired: (cb) =>
      adapter.observeEvents((env: SequencedSdkEvent) => {
        if (env.event.type === 'auth_expired' || env.event.type === 'session_expired') {
          cb(env.event);
        }
      }),
    observeOutbox: (cb) => adapter.observeOutbox(cb),
  });
  // 已连接后才挂载的组件：用当前连接态给 connectivity + sync 切片补种子（事件总线只发
  // 增量，自动登录在 UI 挂载前就已 authenticated，组件永远收不到那次 transition 事件）。
  // seedConnectionState 复用与真实事件完全相同的映射，因此 connectivity.authenticated 会
  // 被正确置真 —— 否则 banner 会在一个完全正常的连接上误报「已断开/offline」。
  const current = adapter.connectionState();
  if (current !== 'disconnected') {
    runtime.seedConnectionState(current);
  }
  runtimes.set(key, runtime);
  return runtime;
}

export interface ClientRuntimeSnapshot {
  connectivity: ConnectivityRuntimeState;
  sync: SyncRuntimeState;
  send: SendQueueRuntimeState;
  runtime: ClientRuntime;
}

/** 订阅三条运行态切片（useSyncExternalStore，同步返回当前值）。 */
export function useClientRuntime(): ClientRuntimeSnapshot {
  const adapter = usePrivchatClient();
  const runtime = useMemo(() => getClientRuntime(adapter), [adapter]);

  const connectivity = useSyncExternalStore(
    useCallback((cb) => runtime.connectivity.subscribe(cb), [runtime]),
    useCallback(() => runtime.connectivity.getState(), [runtime]),
    useCallback(() => runtime.connectivity.getState(), [runtime]),
  );
  const sync = useSyncExternalStore(
    useCallback((cb) => runtime.sync.subscribe(cb), [runtime]),
    useCallback(() => runtime.sync.getState(), [runtime]),
    useCallback(() => runtime.sync.getState(), [runtime]),
  );
  const send = useSyncExternalStore(
    useCallback((cb) => runtime.send.subscribe(cb), [runtime]),
    useCallback(() => runtime.send.getState(), [runtime]),
    useCallback(() => runtime.send.getState(), [runtime]),
  );
  return { connectivity, sync, send, runtime };
}

/**
 * 状态条唯一决策（与 App/`resolveRuntimeBanner` 同一固定优先级）：
 * AuthExpired > 断网 > [已认证: busy > syncing > connected短暂] > reconnecting > connecting > offline。
 */
export function useRuntimeBanner(
  hasStartedConnectionFlow: boolean,
  showConnectedBanner = false,
): RuntimeBannerKind {
  const { connectivity, sync } = useClientRuntime();
  return resolveRuntimeBanner(connectivity, sync, hasStartedConnectionFlow, showConnectedBanner);
}
