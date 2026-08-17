import { http } from '../http';
import type { ApiResult } from '../http';
import type { ChannelDTO, ChannelListItemDTO, ChannelMemberDTO, ChannelType, PaginationMeta } from '../types';

export function listChannels(params?: {
  type?: ChannelType;
  page?: number;
  pageSize?: number;
}): Promise<{ items: ChannelListItemDTO[]; meta: PaginationMeta }> {
  return http
    .get<ChannelListItemDTO[]>('/channels', { query: params })
    .then((r: ApiResult<ChannelListItemDTO[]>) => ({ items: r.data, meta: r.meta as PaginationMeta }));
}

export function getChannel(channelId: string): Promise<ChannelDTO> {
  return http.get<ChannelDTO>(`/channels/${channelId}`).then((r) => r.data);
}

export function listMembers(channelId: string): Promise<ChannelMemberDTO[]> {
  return http.get<ChannelMemberDTO[]>(`/channels/${channelId}/members`).then((r) => r.data);
}
