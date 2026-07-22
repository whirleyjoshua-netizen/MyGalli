import { describe, it, expect } from 'vitest'
import { leadGenEmail } from './email'

describe('leadGenEmail', () => {
  it('includes the preset message and a download button when a file is present', () => {
    const { subject, html } = leadGenEmail({
      name: 'Sarah',
      message: 'Enjoy the <guide>!',
      fileUrl: 'https://blob/x.pdf',
      fileName: 'guide.pdf',
    })
    expect(subject).toBeTruthy()
    expect(html).toContain('Hi Sarah')
    expect(html).toContain('https://blob/x.pdf')
    expect(html).toContain('guide.pdf')
    // message HTML-escaped
    expect(html).toContain('Enjoy the &lt;guide&gt;!')
    expect(html).not.toContain('Enjoy the <guide>!')
  })

  it('omits the download button when there is no file', () => {
    const { html } = leadGenEmail({ message: 'Here is your code: SAVE10' })
    expect(html).toContain('SAVE10')
    expect(html).not.toContain('href="https://blob')
  })

  it('greets generically when no name is given', () => {
    const { html } = leadGenEmail({ message: 'x' })
    expect(html).toContain('Hi there')
  })

  it('escapes a name so it cannot inject markup', () => {
    const { html } = leadGenEmail({ name: '<b>evil</b>', message: 'x' })
    expect(html).not.toContain('<b>evil</b>')
    expect(html).toContain('&lt;b&gt;evil&lt;/b&gt;')
  })

  it('renders newlines in the message as line breaks', () => {
    const { html } = leadGenEmail({ message: 'line one\nline two' })
    expect(html).toContain('line one<br/>line two')
  })
})
