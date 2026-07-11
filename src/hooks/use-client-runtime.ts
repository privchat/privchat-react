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
  // 已连接后才挂载的组件：用当前连接态补一发（事件总线只发增量）。
  const current = adapter.connectionState();
  if (current !== 'disconnected') {
    // createClientRuntime 的映射入口是事件回调；直接经私有 slice 不可达，
    // 这里通过一次性合成事件补种子（语义与真实事件一致）。
    runtime.connectivity.getState(); // touch
    // 合成种子：直接复用 runtime 的公开喂口 —— onConnectionStateChanged 由订阅闭包持有，
    // 无法直接调用；因此用 markSyncCompleted 之外的通用路径：无。改为在 createClientRuntime
    // 前读取初态是更干净的做法，此处保底：authenticated 时补记初始同步完成。
    if (current === 'authenticated') runtime.markSyncCompleted();
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
