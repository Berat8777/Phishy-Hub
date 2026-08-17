import { ChannelMember } from '../../models';
import { AI_BOT_USER_ID, type UserRole } from '../../utils/constants';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import * as messageService from '../message.service';
import type { MessageDTO } from '../message.service';
import { getIo } from '../../sockets';
import { broadcastMessageUpdated, broadcastNewMessage } from '../../sockets/broadcast';
import { consumeAiRateLimit } from './rateLimit';
import { answerQuestion, type AiEmitFn } from './aiQuery.service';

const MENTION_TOKEN_RE = new RegExp(`<@${AI_BOT_USER_ID}>`, 'i');
const MENTION_PREFIX_RE = /^@ai\b/i;

/** The bot's own DB role — only used for the `editMessage` permission check below, never for RBAC gating a real user. */
const AI_BOT_ROLE: UserRole = 'employee';

function safeBroadcast(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    logger.debug({ err }, 'ai aiMention.service: skipped realtime broadcast');
  }
}

function tryGetIo() {
  try {
    return getIo();
  } catch {
    return null;
  }
}

function isMentioned(body: string): boolean {
  return MENTION_TOKEN_RE.test(body) || MENTION_PREFIX_RE.test(body);
}

function extractQuestion(body: string): string {
  return body.replace(MENTION_TOKEN_RE, ' ').replace(MENTION_PREFIX_RE, ' ').replace(/^[:,]/, '').trim();
}

/** Idempotent — the bot must be a channel member before `createMessage()`'s `assertChannelMember` check will let it post. */
async function ensureBotMembership(channelId: string): Promise<void> {
  await ChannelMember.findOrCreate({
    where: { channelId, userId: AI_BOT_USER_ID },
    defaults: { channelId, userId: AI_BOT_USER_ID, channelRole: 'member', joinedAt: new Date() },
  });
}

async function postBotMessage(channelId: string, body: string, replyToMessageId: string | null): Promise<MessageDTO> {
  const message = await messageService.createMessage({ channelId, senderId: AI_BOT_USER_ID, body, replyToMessageId });
  const dto = await messageService.toMessageDTO(message);
  const io = tryGetIo();
  if (io) safeBroadcast(() => broadcastNewMessage(io, dto));
  return dto;
}

/** Single update once generation completes/fails — never per streamed token (see aiQuery.service.ts for the token-by-token socket events instead). */
async function updateBotMessage(messageId: string, body: string): Promise<void> {
  const message = await messageService.editMessage(AI_BOT_USER_ID, AI_BOT_ROLE, messageId, body);
  const dto = await messageService.toMessageDTO(message);
  const io = tryGetIo();
  if (io) safeBroadcast(() => broadcastMessageUpdated(io, dto));
}

function buildEmit(channelId: string, askerId: string): AiEmitFn {
  return (evt) => {
    const io = tryGetIo();
    if (!io) return;
    try {
      io.to(`channel:${channelId}`).to(`user:${askerId}`).emit(evt.event, evt.payload);
    } catch (err) {
      logger.debug({ err }, 'ai aiMention.service: failed to emit ai:answer event');
    }
  };
}

/**
 * `@ai` chat-mention entry point — called fire-and-forget from BOTH
 * message.controller.ts (REST create) and sockets/handlers/message.handler.ts,
 * immediately after their existing broadcast call. Deliberately NOT called
 * from message.service.ts::createMessage itself (that module stays
 * sockets-free by convention, and calling this from there would also fire
 * for every message, not just ones that were actually broadcast).
 */
export async function handleMessageForAiMention(messageDTO: MessageDTO, senderRole: UserRole): Promise<void> {
  // Loop prevention: never react to the bot's own messages (including its
  // own placeholder posts below re-triggering this).
  if (messageDTO.senderId === AI_BOT_USER_ID) return;
  if (!messageDTO.body || !isMentioned(messageDTO.body)) return;

  if (!env.ai.enabled) return;

  const replyToMessageId = messageDTO.replyToMessageId ?? null;

  if (!env.ai.allowedRoles.includes(senderRole)) {
    await ensureBotMembership(messageDTO.channelId);
    await postBotMessage(
      messageDTO.channelId,
      'Üzgünüm, @ai asistanını kullanma yetkin yok.',
      replyToMessageId,
    );
    return;
  }

  if (!consumeAiRateLimit(messageDTO.senderId)) {
    await ensureBotMembership(messageDTO.channelId);
    await postBotMessage(
      messageDTO.channelId,
      'Çok fazla istek gönderdin, lütfen birkaç dakika sonra tekrar dene.',
      replyToMessageId,
    );
    return;
  }

  await ensureBotMembership(messageDTO.channelId);

  const question = extractQuestion(messageDTO.body);
  if (!question) {
    await postBotMessage(
      messageDTO.channelId,
      'Merhaba! Bana bir soru sormak için `@ai <sorunuz>` yazabilirsin — örn. `@ai leave request onay akışı nasıl çalışıyor?`',
      replyToMessageId,
    );
    return;
  }

  const placeholder = await postBotMessage(messageDTO.channelId, 'Düşünüyorum...', replyToMessageId);
  const emit = buildEmit(messageDTO.channelId, messageDTO.senderId);

  try {
    const result = await answerQuestion({
      userId: messageDTO.senderId,
      role: senderRole,
      question,
      channelId: messageDTO.channelId,
      messageId: placeholder.id,
      emit,
    });
    await updateBotMessage(placeholder.id, result.answer || '(Yanıt alınamadı.)');
  } catch (err) {
    logger.warn({ err }, 'ai aiMention.service: answerQuestion failed');
    await updateBotMessage(placeholder.id, 'Üzgünüm, bu soruyu yanıtlarken bir hata oluştu.');
  }
}
