import { describe, it, expect, vi } from 'vitest'

const createWorker = vi.fn()
vi.mock('tesseract.js', () => ({ createWorker }))

describe('getWorker', () => {
  it('retries after a failed load instead of caching the failure', async () => {
    const { getWorker } = await import('./ocr.js')
    createWorker.mockRejectedValueOnce(new Error('offline'))
    await expect(getWorker()).rejects.toThrow('offline')
    const worker = { recognize: vi.fn() }
    createWorker.mockResolvedValueOnce(worker)
    await expect(getWorker()).resolves.toBe(worker)
    expect(createWorker).toHaveBeenCalledTimes(2)
  })
})
