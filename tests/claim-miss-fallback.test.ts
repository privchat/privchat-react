import { describe, expect, it } from 'vitest';
import { RpcError } from '@privchat/sdk';

import { claimMissShouldReupload } from '../src/adapter/direct-adapter.js';

/** 秒传 claim 没成 → 退回整传；其它错误照常抛。
 *
 *  🔴 这条盯的是**判据读哪个字段**。码在 `RpcError.response.code` 上；读成
 *  `e.code` 的话判据恒为 false，回退形同虚设，claim 一 miss 整条附件发送就失败
 *  ——而且不报任何异常，只是「发不出去」。真实的 `RpcError` 对象是这里唯一有效的
 *  输入，手搓 `{ code: 10201 }` 测不出这个。 */
describe('claimMissShouldReupload', () => {
  const rpcError = (code: number) =>
    new RpcError('file/claim_existing', { code, message: 'x', data: undefined } as never);

  it('内容拿不到时退回整传', () => {
    // 10201 = ResourceNotFound，服务端 `ServerError::NotFound` 的协议码。
    expect(claimMissShouldReupload(rpcError(10201))).toBe(true);
  });

  it('其它失败不吞成一次上传', () => {
    // 参数错传一遍还是错；无权就是无权；瞬时竞争该重试而不是重传几 MB。
    for (const code of [10001, 10203, 10500, 10502]) {
      expect(claimMissShouldReupload(rpcError(code))).toBe(false);
    }
  });

  it('不是 RpcError 的一律不退回', () => {
    for (const other of [new Error('boom'), { response: { code: 10201 } }, null, undefined]) {
      expect(claimMissShouldReupload(other)).toBe(false);
    }
  });
});
