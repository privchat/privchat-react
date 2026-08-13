// 「转发」不是一种消息，也没有 forward RPC：它就是**用户以自己的身份把同一份内容
// 再发一次**，走的是和手选文件完全相同的 sendImage / sendVideo / sendFile。
//
// 这段规则放在这里而不是各端各写一份，是因为它已经被写错过两次：一次是文件名/MIME
// 取自本地消息（别的端发来的消息没有这些字段，于是图片被当成「文件」重发），一次是
// 消息类型取自 metadata（同样缺失，同样退化）。规则只有一份，才谈得上一起修。
import type { PrivchatClientAdapter } from './adapter/client-adapter.js';
import type { MessageItemVM } from './view-models/message.js';

/** 把一条消息重新发到某个会话。红包/转账/系统消息重发没有意义，直接拒绝。 */
export async function resendMessageTo(
  client: PrivchatClientAdapter,
  source: MessageItemVM,
  channelId: string,
  channelType: number,
): Promise<void> {
  const body = source.body;
  if (body.kind === 'text') {
    const text = body.text.trim();
    if (text === '') throw new Error('empty message');
    await client.sendTextMessage({
      channel_id: channelId,
      channel_type: channelType,
      from_uid: source.from_uid,
      content: text,
    });
    return;
  }

  const meta = 'metadata' in body ? (body.metadata as unknown as Record<string, unknown>) : undefined;
  const fileId = meta?.['file_id'];
  if (meta === undefined || fileId === undefined) {
    throw new Error(`cannot resend a ${body.kind} message`);
  }

  // 取回这份附件：明文用来发送，**服务端存的那串密文**一并带回。
  //
  // 🔴 带上密文不是「转发的特殊做法」——普通上传路径拿它去预检就能秒传。只取明文的话，
  // 发送侧会重新封装（新的随机 CEK/nonce），字节一变摘要就变，秒传永远不可能命中。
  const downloaded = await client.downloadAttachmentDetailed(String(fileId));

  // 🔴 类型、文件名、MIME 都以**服务端**为准：本地消息上的这些字段可能压根没有。
  const kind = downloaded.fileType ?? (meta['type'] as string | undefined) ?? body.kind;
  const filename =
    downloaded.originalFilename ||
    (meta['file_name'] as string | undefined) ||
    fallbackName(kind);
  const mime =
    downloaded.mimeType ||
    (downloaded.blob.type !== '' ? downloaded.blob.type : guessMime(filename));
  // 尺寸/时长只有源消息知道（`file/get_url` 不提供）。
  const num = (k: string): number => (typeof meta[k] === 'number' ? (meta[k] as number) : 0);

  const common = {
    channel_id: channelId,
    channel_type: channelType,
    file: downloaded.blob,
    filename,
    mime_type: mime,
    caption: body.text === '' ? undefined : body.text,
    sealed: downloaded.sealed,
  };

  if (kind === 'image') {
    await client.sendImage({ ...common, width: num('width'), height: num('height') });
    return;
  }
  if (kind === 'video') {
    await client.sendVideo({
      ...common,
      width: num('width'),
      height: num('height'),
      duration: num('duration'),
    });
    return;
  }
  // voice 也按普通文件发：Web/H5 没有语音录制入口，转发一条语音等价于转发它的文件。
  await client.sendFile(common);
}

function fallbackName(kind: string): string {
  if (kind === 'image') return 'image.jpg';
  if (kind === 'video') return 'video.mp4';
  if (kind === 'voice') return 'voice.m4a';
  return 'file.bin';
}

function guessMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const table: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', heic: 'image/heic', mp4: 'video/mp4', mov: 'video/quicktime',
    m4a: 'audio/mp4', mp3: 'audio/mpeg', pdf: 'application/pdf',
  };
  return table[ext] ?? 'application/octet-stream';
}
