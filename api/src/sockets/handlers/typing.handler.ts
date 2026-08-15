import { Server } from 'socket.io';
import type { AppSocket } from '../index';

function emitTyping(socket: AppSocket, channelId: string, isTyping: boolean): void {
  // socket.to() (not io.to()) — broadcasts to the room excluding the sender,
  // per architecture doc §4 ("gönderen hariç broadcast").
  socket.to(`channel:${channelId}`).emit('typing', {
    channelId,
    userId: socket.data.user.id,
    isTyping,
  });
}

export function registerTypingHandlers(_io: Server, socket: AppSocket): void {
  socket.on('typing:start', (payload: { channelId: string }) => {
    emitTyping(socket, payload.channelId, true);
  });

  socket.on('typing:stop', (payload: { channelId: string }) => {
    emitTyping(socket, payload.channelId, false);
  });
}
