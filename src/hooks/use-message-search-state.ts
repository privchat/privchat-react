import { useCallback, useEffect, useRef, useState } from 'react';
import { isServerBusySignal, type MessageHistorySearchHit } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';
import { getClientRuntime } from './use-client-runtime.js';

/**
 * P5 统一搜索状态（CLIENT_GLOBAL_STATE §17.6 / Cross-client SearchState）。
 *
 * 此前 web/h5/App 各自内联实现 debounce/过期丢弃/分页/loading——本 hook 是**三端 TS 侧的
 * 唯一搜索状态机**（App/Kotlin 侧行为等价）：
 *  - 400ms debounce、<2 字符跳过（server 强制 2..=64）
 *  - request-id 守卫丢弃过期 in-flight（换词/清词后旧响应不落地）
 *  - keyset cursor 分页 loadMore
 *  - **error 终态可见**（不再静默→误显示"无结果"）；busy/限流类失败喂运行时层
 *    （isServerBusySignal → ClientRuntime.onServerBusySignal → 统一「服务繁忙」横幅）。
 */
export interface MessageSearchState {
  query: string;
  setQuery: (q: string) => void;
  hits: MessageHistorySearchHit[];
  searching: boolean;
  loadingMore: boolean;
  /** 一轮搜索已完成（区分「无结果」与「未搜索」）。 */
  searched: boolean;
  /** 终态失败（UI 应显示本地化错误而非「无结果」）。 */
  error: boolean;
  nextCursor: string | null;
  loadMore: () => void;
  reset: () => void;
}

export interface UseMessageSearchStateOptions {
  /** 限定单会话（in-chat scope）；缺省全局。 */
  channelId?: number;
  limit?: number;
  debounceMs?: number;
  minChars?: number;
}

export function useMessageSearchState(
  opts: UseMessageSearchStateOptions = {},
): MessageSearchState {
  const { channelId, limit, debounceMs = 400, minChars = 2 } = opts;
  const adapter = usePrivchatClient();

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<MessageHistorySearchHit[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(false);
  const reqIdRef = useRef(0);

  const feedRuntimeOnFailure = useCallback(
    (err: unknown) => {
      const text = err instanceof Error ? err.message : String(err);
      if (isServerBusySignal(null, text)) {
        getClientRuntime(adapter).onServerBusySignal();
      }
    },
    [adapter],
  );

  useEffect(() => {
    const q = query.trim();
    setHits([]);
    setNextCursor(null);
    setSearched(false);
    setError(false);
    if (q.length < minChars) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const reqId = ++reqIdRef.current;
    const timer = setTimeout(() => {
      adapter
        .messageHistorySearch(q, { channelId, limit })
        .then((resp) => {
          if (reqIdRef.current !== reqId) return;
          setHits(resp.hits);
          setNextCursor(resp.next_cursor ?? null);
          setSearched(true);
        })
        .catch((err: unknown) => {
          if (reqIdRef.current !== reqId) return;
          feedRuntimeOnFailure(err);
          setError(true);
          setSearched(true);
        })
        .finally(() => {
          if (reqIdRef.current === reqId) setSearching(false);
        });
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [query, channelId, limit, debounceMs, minChars, adapter, feedRuntimeOnFailure]);

  const loadMore = useCallback(() => {
    const q = query.trim();
    if (nextCursor === null || q.length < minChars || loadingMore) return;
    setLoadingMore(true);
    const reqId = reqIdRef.current;
    adapter
      .messageHistorySearch(q, { channelId, cursor: nextCursor, limit })
      .then((resp) => {
        if (reqIdRef.current !== reqId) return;
        setHits((prev) => [...prev, ...resp.hits]);
        setNextCursor(resp.next_cursor ?? null);
      })
      .catch((err: unknown) => {
        if (reqIdRef.current !== reqId) return;
        feedRuntimeOnFailure(err);
        setError(true);
      })
      .finally(() => setLoadingMore(false));
  }, [adapter, channelId, limit, loadingMore, minChars, nextCursor, query, feedRuntimeOnFailure]);

  const reset = useCallback(() => {
    reqIdRef.current += 1;
    setQuery('');
    setHits([]);
    setNextCursor(null);
    setSearching(false);
    setLoadingMore(false);
    setSearched(false);
    setError(false);
  }, []);

  return {
    query,
    setQuery,
    hits,
    searching,
    loadingMore,
    searched,
    error,
    nextCursor,
    loadMore,
    reset,
  };
}
