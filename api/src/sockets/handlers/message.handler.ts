import { Server } from 'socket.io';
import * as messageService from '../../services/message.service';
import { broadcastMessageRead, broadcastNewMessage } from '../broadcast';
import { ackError, ackSuccess } from '../ack';
import { logger } from '../../utils/logger';
import type { AppSocket } from '../index';

export function registerMessageHandlers(io: Server, socket: AppSocket): void {
  socket.on(
    'message:send',
    async (
      payload: { channelId: string; body?: string; replyToMessageId?: string; tempId?: string },
      ack?: (res: unknown) => void,
    ) => {
      try {
        const message = await messageService.createMessage({
          channelId: payload.channelId,
          senderId: socket.data.user.id,
          body: payload.body,
          replyToMessageId: payload.replyToMessageId,
        });
        const dto = await messageService.toMessageDTO(message);

        broadcastNewMessage(io, dto, payload.tempId);
        ack?.(ackSuccess(dto));
      } catch (err) {
        logger.warn({ err }, 'message:send failed');
        ack?.(ackError(err));
      }
    },
  );

  socket.on(
    'message:read',
    async (payload: { channelId: string; lastReadMessageId: string }, ack?: (res: unknown) => void) => {
      try {
        const result = await messageService.markRead(socket.data.user.id, payload.channelId, payload.lastReadMessageId);
        broadcastMessageRead(io, result);
        ack?.(ackSuccess(result));
      } catch (err) {
        ack?.(ackError(err));
      }
    },
  );
}
