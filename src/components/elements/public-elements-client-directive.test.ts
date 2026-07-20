import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// React cannot serialize a function (e.g. an onClick handler) into the RSC
// payload of a Server Component. Any Public*.tsx element that wires up a
// DOM event handler MUST be a Client Component ('use client' as the very
// first line), or every published page that renders it will 500. This test
// guards the whole class of bug, not just one instance of it.

const ELEMENTS_DIR = __dirname

const HANDLER_PATTERN = /\bon[A-Z][A-Za-z]*\s*=/

function isPublicElementFile(fileName: string): boolean {
  return fileName.startsWith('Public') && fileName.endsWith('.tsx') && !fileName.endsWith('.test.tsx')
}

describe('Public element client directive', () => {
  const files = fs.readdirSync(ELEMENTS_DIR).filter(isPublicElementFile)

  // Sanity check so this test can't silently pass on an empty directory.
  it('found Public*.tsx element files to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  const handlerBearingFiles = files.filter((fileName) => {
    const content = fs.readFileSync(path.join(ELEMENTS_DIR, fileName), 'utf8')
    return HANDLER_PATTERN.test(content)
  })

  // Sanity check so a future regex regression (e.g. narrowing back to a
  // fixed handler list) can't silently collapse this test to a vacuous pass.
  it('found at least one handler-bearing Public*.tsx file to guard', () => {
    expect(handlerBearingFiles.length).toBeGreaterThan(0)
  })

  for (const fileName of handlerBearingFiles) {
    const filePath = path.join(ELEMENTS_DIR, fileName)
    const content = fs.readFileSync(filePath, 'utf8')

    it(`${fileName} has 'use client' because it wires up a DOM event handler`, () => {
      const firstLine = content.split(/\r?\n/, 1)[0].trim()
      expect(firstLine === "'use client'" || firstLine === '"use client"').toBe(true)
    })
  }
})
