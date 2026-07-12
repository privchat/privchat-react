import { useCallback, useEffect, useState } from 'react';
import type { GroupApprovalItem } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';

/**
 * 群入群申请审批（P6-3-4，CLIENT_GLOBAL_STATE §26）。三端（h5/web）共用的唯一群审批状态机——
 * 不各自调 SDK。第一版拉取式（进页/处理后刷新，无推送）：
 *  - 挂载即 refresh；approve/reject 成功后本地移除该行（乐观），pendingCount 随之下降；
 *  - error 可见（终态），RPC 失败会抛出供调用方兜底提示（成功才移除）。
 *
 * operator_id 由 SDK 从当前 session 自填（与 App requireCurrentUserId 语义一致）。
 */
export interface GroupApprovalsState {
  items: GroupApprovalItem[];
  pendingCount: number;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
  approve: (requestId: string) => Promise<boolean>;
  reject: (requestId: string, reason?: string) => Promise<boolean>;
}

export function useGroupApprovals(groupId: string | undefined): GroupApprovalsState {
  const adapter = usePrivchatClient();
  const [items, setItems] = useState<GroupApprovalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (groupId === undefined || groupId === '') return;
    setLoading(true);
    setError(false);
    try {
      const resp = await adapter.groupApprovalList(groupId);
      setItems(resp.requests);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [adapter, groupId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const drop = (requestId: string) =>
    setItems((xs) => xs.filter((x) => x.request_id !== requestId));

  const approve = useCallback(
    async (requestId: string) => {
      const resp = await adapter.groupApprovalHandle(requestId, true);
      if (resp.success) drop(requestId);
      return resp.success;
    },
    [adapter],
  );

  const reject = useCallback(
    async (requestId: string, reason?: string) => {
      const resp = await adapter.groupApprovalHandle(requestId, false, reason);
      if (resp.success) drop(requestId);
      return resp.success;
    },
    [adapter],
  );

  return { items, pendingCount: items.length, loading, error, refresh, approve, reject };
}
