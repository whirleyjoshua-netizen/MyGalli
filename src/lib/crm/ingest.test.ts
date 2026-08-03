import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    crmContact: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    crmActivity: { findUnique: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('./stages', () => ({ ensureStages: vi.fn() }))

import { db } from '@/lib/db'
import { ensureStages } from './stages'
import { ingestLead } from './ingest'

const base = {
  displayId: 'd1',
  email: 'ada@x.com',
  name: 'Ada',
  source: 'booking' as const,
  sourceId: 'bk1',
  summary: 'Booked a call',
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.display.findUnique as any).mockResolvedValue({ id: 'd1', userId: 'u1' })
  ;(ensureStages as any).mockResolvedValue([{ id: 'stage-new', order: 0 }, { id: 'stage-2', order: 1 }])
  ;(db.crmContact.findUnique as any).mockResolvedValue(null)
  ;(db.crmContact.create as any).mockResolvedValue({ id: 'c1' })
  ;(db.crmActivity.findUnique as any).mockResolvedValue(null)
  ;(db.crmActivity.create as any).mockResolvedValue({ id: 'a1' })
})

describe('ingestLead', () => {
  it('creates a contact in the first stage on first touch', async () => {
    await ingestLead(base)

    expect(db.crmContact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: 'u1',
        stageId: 'stage-new',
        mergeKey: 'ada@x.com',
        email: 'ada@x.com',
        name: 'Ada',
      }),
    })
    expect(db.crmActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: 'c1',
        source: 'booking',
        sourceId: 'bk1',
        displayId: 'd1',
        summary: 'Booked a call',
      }),
    })
  })

  it('merges onto the existing contact when the email matches', async () => {
    ;(db.crmContact.findUnique as any).mockResolvedValue({ id: 'existing', name: 'Ada', email: 'ada@x.com' })

    await ingestLead(base)

    expect(db.crmContact.create).not.toHaveBeenCalled()
    expect(db.crmActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ contactId: 'existing' }),
    })
  })

  it('normalizes case and whitespace before merging', async () => {
    await ingestLead({ ...base, email: '  ADA@X.com ' })

    expect(db.crmContact.findUnique).toHaveBeenCalledWith({
      where: { ownerId_mergeKey: { ownerId: 'u1', mergeKey: 'ada@x.com' } },
    })
  })

  it('backfills a missing name onto an existing contact', async () => {
    ;(db.crmContact.findUnique as any).mockResolvedValue({ id: 'existing', name: null, email: 'ada@x.com' })

    await ingestLead(base)

    expect(db.crmContact.update).toHaveBeenCalledWith({
      where: { id: 'existing' },
      data: { name: 'Ada', updatedAt: expect.any(Date) },
    })
  })

  it('never overwrites a name the owner may have edited, but still bumps updatedAt', async () => {
    ;(db.crmContact.findUnique as any).mockResolvedValue({ id: 'existing', name: 'Ada Lovelace', email: 'ada@x.com' })

    await ingestLead({ ...base, name: 'ada' })

    expect(db.crmContact.update).toHaveBeenCalledWith({
      where: { id: 'existing' },
      data: { updatedAt: expect.any(Date) },
    })
    const arg = (db.crmContact.update as any).mock.calls[0][0]
    expect(arg.data.name).toBeUndefined()
  })

  it('bumps updatedAt on a repeat touch from an already-named existing contact (the common case)', async () => {
    // This is the exact case the old code skipped: the contact already
    // exists and already has a name, so no name backfill happens — but a
    // new activity was still written and the sort key must track it.
    ;(db.crmContact.findUnique as any).mockResolvedValue({ id: 'existing', name: 'Ada Lovelace', email: 'ada@x.com' })

    await ingestLead(base)

    expect(db.crmContact.update).toHaveBeenCalledWith({
      where: { id: 'existing' },
      data: { updatedAt: expect.any(Date) },
    })
  })

  it('drops the lead entirely when there is no usable email', async () => {
    await ingestLead({ ...base, email: 'not-an-email' })

    expect(db.crmContact.create).not.toHaveBeenCalled()
    expect(db.crmActivity.create).not.toHaveBeenCalled()
  })

  it('logs a repeated (source, sourceId) only once', async () => {
    ;(db.crmActivity.findUnique as any).mockResolvedValue({ id: 'already' })

    await ingestLead(base)

    expect(db.crmActivity.create).not.toHaveBeenCalled()
  })

  it('is a no-op for an unknown display', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(null)

    await ingestLead(base)

    expect(db.crmContact.create).not.toHaveBeenCalled()
    expect(db.crmActivity.create).not.toHaveBeenCalled()
  })

  it('swallows and logs a database failure rather than throwing', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(db.crmContact.create as any).mockRejectedValue(new Error('db down'))

    await expect(ingestLead(base)).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()

    spy.mockRestore()
  })

  describe('never throws — all rejection points are guarded', () => {
    const rejectionCases = [
      {
        name: 'db.display.findUnique rejection',
        setup: () => {
          ;(db.display.findUnique as any).mockRejectedValue(new Error('display lookup failed'))
        },
      },
      {
        name: 'ensureStages rejection',
        setup: () => {
          ;(ensureStages as any).mockRejectedValue(new Error('stages lookup failed'))
        },
      },
      {
        name: 'db.crmContact.findUnique rejection',
        setup: () => {
          ;(db.crmContact.findUnique as any).mockRejectedValue(new Error('contact lookup failed'))
        },
      },
      {
        name: 'db.crmContact.create rejection',
        setup: () => {
          ;(db.crmContact.create as any).mockRejectedValue(new Error('contact create failed'))
        },
      },
      {
        name: 'db.crmContact.update rejection (backfill path)',
        setup: () => {
          ;(db.crmContact.findUnique as any).mockResolvedValue({ id: 'existing', name: null, email: 'ada@x.com' })
          ;(db.crmContact.update as any).mockRejectedValue(new Error('contact update failed'))
        },
      },
      {
        name: 'db.crmActivity.findUnique rejection',
        setup: () => {
          ;(db.crmActivity.findUnique as any).mockRejectedValue(new Error('activity lookup failed'))
        },
      },
      {
        name: 'db.crmActivity.create rejection',
        setup: () => {
          ;(db.crmActivity.create as any).mockRejectedValue(new Error('activity create failed'))
        },
      },
    ]

    for (const { name, setup } of rejectionCases) {
      it(`handles ${name}`, async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        setup()

        await expect(ingestLead(base)).resolves.toBeUndefined()
        expect(spy).toHaveBeenCalled()

        spy.mockRestore()
      })
    }
  })
})
