import { describe, it, expect } from 'vitest'
import { isBlockedIp, parseMetadata } from './link-preview'

describe('isBlockedIp', () => {
  it('blocks loopback / private / link-local / metadata / unspecified', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.5.5', '172.31.255.255', '192.168.0.1', '169.254.169.254', '0.0.0.0', '::1', 'fc00::1', 'fe80::1', '::']) {
      expect(isBlockedIp(ip), ip).toBe(true)
    }
  })
  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:2800:220:1::']) {
      expect(isBlockedIp(ip), ip).toBe(false)
    }
  })
  it('blocks 172.16–31 but allows 172.32+', () => {
    expect(isBlockedIp('172.15.0.1')).toBe(false)
    expect(isBlockedIp('172.32.0.1')).toBe(false)
    expect(isBlockedIp('172.20.0.1')).toBe(true)
  })
})

describe('parseMetadata', () => {
  const base = 'https://shop.example.com/p/123'
  it('reads og tags and resolves a relative image', () => {
    const html = `<html><head>
      <meta property="og:title" content="Cool Mug">
      <meta property="og:image" content="/img/mug.jpg">
      <meta property="og:description" content="A very cool mug">
      <meta property="product:price:amount" content="19.99">
    </head></html>`
    expect(parseMetadata(html, base)).toEqual({
      title: 'Cool Mug',
      image: 'https://shop.example.com/img/mug.jpg',
      description: 'A very cool mug',
      price: '19.99',
    })
  })
  it('falls back to <title> and twitter:image, decodes entities', () => {
    const html = `<html><head><title>Tea &amp; Cups</title>
      <meta name="twitter:image" content="https://cdn.example.com/x.png"></head></html>`
    const r = parseMetadata(html, base)
    expect(r.title).toBe('Tea & Cups')
    expect(r.image).toBe('https://cdn.example.com/x.png')
  })
  it('returns empty object when nothing is present', () => {
    expect(parseMetadata('<html></html>', base)).toEqual({})
  })
})
