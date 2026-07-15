import { db } from '@/lib/db'
import type { NotificationType } from '@/lib/notifications-format'

export interface NotifyActor {
  id: string | null
  name: string
  avatar?: string | null
}

interface BaseInput {
  type: NotificationType
  actor: NotifyActor
  entityUrl?: string
  contextText?: string
}

function toRow(userId: string, input: BaseInput) {
  return {
    userId,
    type: input.type,
    actorId: input.actor.id,
    actorName: input.actor.name,
    actorAvatar: input.actor.avatar ?? null,
    entityUrl: input.entityUrl ?? null,
    contextText: input.contextText ?? null,
  }
}

export async function createNotification(input: BaseInput & { userId: string }): Promise<void> {
  try {
    await db.notification.create({ data: toRow(input.userId, input) })
  } catch (e) {
    console.error('createNotification failed', e)
  }
}

export async function notifyFollowers(actorId: string, input: BaseInput): Promise<void> {
  try {
    const followers = await db.follow.findMany({
      where: { followingId: actorId },
      select: { followerId: true },
    })
    if (followers.length === 0) return
    await db.notification.createMany({
      data: followers.map((f) => toRow(f.followerId, input)),
    })
  } catch (e) {
    console.error('notifyFollowers failed', e)
  }
}

/** Fan out one notification to an explicit recipient list (see postNotifyTargets). */
export async function notifyHubMembers(userIds: string[], input: BaseInput): Promise<void> {
  try {
    if (userIds.length === 0) return
    await db.notification.createMany({
      data: userIds.map((userId) => toRow(userId, input)),
    })
  } catch (e) {
    console.error('notifyHubMembers failed', e)
  }
}
