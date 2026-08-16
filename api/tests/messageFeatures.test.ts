import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from './helpers/testServer';
import { registerAndLogin, bearer, uniqueEmail } from './helpers/factories';
import type { AuthedSession } from './helpers/factories';

describe('message reactions / threads / DM get-or-create', () => {
  let app: Express;
  let owner: AuthedSession;
  let member: AuthedSession;
  let channelId: string;

  beforeAll(async () => {
    app = buildApp();
    owner = await registerAndLogin(app);
    member = await registerAndLogin(app);

    const createRes = await request(app)
      .post('/api/v1/channels')
      .set('Authorization', bearer(owner.accessToken))
      .send({ type: 'public', name: `feature-tests-${uniqueEmail('c')}` });
    channelId = createRes.body.data.id;

    await request(app)
      .post(`/api/v1/channels/${channelId}/join`)
      .set('Authorization', bearer(member.accessToken));
  });

  describe('reactions — dedupe on toggle', () => {
    it('reacting twice with the same emoji is idempotent (no duplicate, no error)', async () => {
      const msgRes = await request(app)
        .post(`/api/v1/channels/${channelId}/messages`)
        .set('Authorization', bearer(owner.accessToken))
        .send({ body: 'react to me' });
      const messageId = msgRes.body.data.id;

      const first = await request(app)
        .put(`/api/v1/messages/${messageId}/reactions`)
        .set('Authorization', bearer(member.accessToken))
        .send({ emoji: '👍' });
      expect(first.status).toBe(200);
      expect(first.body.data.reactions).toEqual([
        expect.objectContaining({ emoji: '👍', count: 1, userIds: [member.userId], reactedByMe: true }),
      ]);
      // Regression: addReaction/removeReaction must return the full message DTO with
      // `sender` populated (not null) — an earlier bug fetched the message without the
      // sender include, which rendered as "Unknown user" in the client after reacting.
      expect(first.body.data.senderId).toBe(owner.userId);
      expect(first.body.data.sender).toEqual(expect.objectContaining({ id: owner.userId }));

      const second = await request(app)
        .put(`/api/v1/messages/${messageId}/reactions`)
        .set('Authorization', bearer(member.accessToken))
        .send({ emoji: '👍' });
      expect(second.status).toBe(200);
      // Still exactly one reaction row for this (message, user, emoji) — count stays 1, not 2.
      expect(second.body.data.reactions).toEqual([
        expect.objectContaining({ emoji: '👍', count: 1, userIds: [member.userId], reactedByMe: true }),
      ]);

      // A different emoji from the same user adds a second, distinct group.
      const differentEmoji = await request(app)
        .put(`/api/v1/messages/${messageId}/reactions`)
        .set('Authorization', bearer(member.accessToken))
        .send({ emoji: '🎉' });
      expect(differentEmoji.status).toBe(200);
      expect(differentEmoji.body.data.reactions).toHaveLength(2);

      // Removing is idempotent too — removing something already gone still succeeds.
      const remove = await request(app)
        .delete(`/api/v1/messages/${messageId}/reactions`)
        .set('Authorization', bearer(member.accessToken))
        .send({ emoji: '👍' });
      expect(remove.status).toBe(200);
      expect(remove.body.data.reactions).toEqual([expect.objectContaining({ emoji: '🎉' })]);
      expect(remove.body.data.sender).toEqual(expect.objectContaining({ id: owner.userId }));

      const removeAgain = await request(app)
        .delete(`/api/v1/messages/${messageId}/reactions`)
        .set('Authorization', bearer(member.accessToken))
        .send({ emoji: '👍' });
      expect(removeAgain.status).toBe(200);
    });

    it('a non-member of the channel cannot react (403)', async () => {
      const outsider = await registerAndLogin(app);
      const msgRes = await request(app)
        .post(`/api/v1/channels/${channelId}/messages`)
        .set('Authorization', bearer(owner.accessToken))
        .send({ body: 'members only' });

      const res = await request(app)
        .put(`/api/v1/messages/${msgRes.body.data.id}/reactions`)
        .set('Authorization', bearer(outsider.accessToken))
        .send({ emoji: '👍' });
      expect(res.status).toBe(403);
    });
  });

  describe('threads — replies excluded from the main channel timeline', () => {
    it('a reply does not appear in GET /channels/:id/messages but does appear in GET /messages/:id/replies', async () => {
      const parentRes = await request(app)
        .post(`/api/v1/channels/${channelId}/messages`)
        .set('Authorization', bearer(owner.accessToken))
        .send({ body: 'parent message' });
      const parentId = parentRes.body.data.id;

      const replyRes = await request(app)
        .post(`/api/v1/channels/${channelId}/messages`)
        .set('Authorization', bearer(member.accessToken))
        .send({ body: 'a reply', replyToMessageId: parentId });
      expect(replyRes.status).toBe(201);
      const replyId = replyRes.body.data.id;

      const timeline = await request(app)
        .get(`/api/v1/channels/${channelId}/messages`)
        .set('Authorization', bearer(owner.accessToken));
      expect(timeline.status).toBe(200);
      const timelineIds = timeline.body.data.map((m: { id: string }) => m.id);
      expect(timelineIds).toContain(parentId);
      expect(timelineIds).not.toContain(replyId);

      const parentInTimeline = timeline.body.data.find((m: { id: string }) => m.id === parentId);
      expect(parentInTimeline.replyCount).toBe(1);
      expect(parentInTimeline.lastReplyAt).not.toBeNull();

      const repliesRes = await request(app)
        .get(`/api/v1/messages/${parentId}/replies`)
        .set('Authorization', bearer(owner.accessToken));
      expect(repliesRes.status).toBe(200);
      const replyIds = repliesRes.body.data.map((m: { id: string }) => m.id);
      expect(replyIds).toEqual([replyId]);
    });
  });

  describe('DM get-or-create idempotency', () => {
    it('POST /channels/dm returns the same channel on repeated calls instead of creating duplicates', async () => {
      const userA = await registerAndLogin(app);
      const userB = await registerAndLogin(app);

      const first = await request(app)
        .post('/api/v1/channels/dm')
        .set('Authorization', bearer(userA.accessToken))
        .send({ userIds: [userB.userId] });
      expect(first.status).toBe(201);
      const channelIdFirst = first.body.data.id;

      const second = await request(app)
        .post('/api/v1/channels/dm')
        .set('Authorization', bearer(userA.accessToken))
        .send({ userIds: [userB.userId] });
      expect(second.status).toBe(200);
      expect(second.body.data.id).toBe(channelIdFirst);

      // Symmetric: the other member requesting the same pair also gets the existing channel.
      const third = await request(app)
        .post('/api/v1/channels/dm')
        .set('Authorization', bearer(userB.accessToken))
        .send({ userIds: [userA.userId] });
      expect(third.status).toBe(200);
      expect(third.body.data.id).toBe(channelIdFirst);
    });
  });
});
