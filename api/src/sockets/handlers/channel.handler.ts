import { Server } from 'socket.io';
import { assertChannelMember } from '../../services/authz.service';
import { ackError, ackSuccess } from '../ack';
import type { AppSocket } from '../index';

export function registerChannelHandlers(_io: Server, socket: AppSocket): void {
  socket.on('channel:join', async (payload: { channelId: string }, ack?: (res: unknown) => void) => {
    try {
      await assertChannelMember(socket.data.user.id, payload.channelId);
      await socket.join(`channel:${payload.channelId}`);
      ack?.(ackSuccess({ channelId: payload.channelId }));
    } catch (err) {
      ack?.(ackError(err));
    }
  });

  socket.on('channel:leave', async (payload: { channelId: string }, ack?: (res: unknown) => void) => {
    try {
      await socket.leave(`channel:${payload.channelId}`);
      ack?.(ackSuccess({ channelId: payload.channelId }));
    } catch (err) {
      ack?.(ackError(err));
    }
  });
}
