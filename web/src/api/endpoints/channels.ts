import { http } from '../http';
import type { ApiResult } from '../http';
import type { ChannelAttachmentDTO, ChannelDTO, ChannelListItemDTO, ChannelMemberDTO, ChannelType, PaginationMeta } from '../types';

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

export function createChannel(input: {
  type: ChannelType;
  name?: string;
  departmentId?: string;
  memberIds?: string[];
}): Promise<ChannelDTO> {
  return http.post<ChannelDTO>('/channels', input).then((r) => r.data);
}

/** Get-or-create DM per CONTRACT.md §3.5 — 200 if a matching DM already exists, 201 if a new one was created. */
export function createOrGetDm(userIds: string[]): Promise<ChannelDTO> {
  return http.post<ChannelDTO>('/channels/dm', { userIds }).then((r) => r.data);
}

export function joinChannel(channelId: string): Promise<unknown> {
  return http.post(`/channels/${channelId}/join`).then((r) => r.data);
}

export function leaveChannel(channelId: string): Promise<unknown> {
  return http.post(`/channels/${channelId}/leave`).then((r) => r.data);
}

export function addMember(channelId: string, userId: string): Promise<ChannelMemberDTO> {
  return http.post<ChannelMemberDTO>(`/channels/${channelId}/members`, { userId }).then((r) => r.data);
}

export function removeMember(channelId: string, userId: string): Promise<void> {
  return http.delete(`/channels/${channelId}/members/${userId}`).then(() => undefined);
}

export function archiveChannel(channelId: string): Promise<unknown> {
  return http.post(`/channels/${channelId}/archive`).then((r) => r.data);
}

export function listAttachments(
  channelId: string,
  params: { type: 'image' | 'file'; page?: number; pageSize?: number },
): Promise<{ items: ChannelAttachmentDTO[]; meta: PaginationMeta }> {
  return http
    .get<ChannelAttachmentDTO[]>(`/channels/${channelId}/attachments`, { query: params })
    .then((r: ApiResult<ChannelAttachmentDTO[]>) => ({ items: r.data, meta: r.meta as PaginationMeta }));
}
