'use client'

import { useState } from 'react'
import { Check, Loader2, Send } from 'lucide-react'

export function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [organization, setOrganization] = useState('')
  const [role, setRole] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, organization, role, message }),
      })

      if (res.ok) {
        setSubmitted(true)
      } else {
        const data = await res.json()
        setError(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="waitlist" className="py-24 px-6">
      <div className="max-w-2xl mx-auto">
        {submitted ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-galli/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-galli" />
            </div>
            <h2 className="text-3xl font-bold mb-2">You&apos;re on the list!</h2>
            <p className="text-muted-foreground">
              We&apos;ll be in touch soon with early access details. Thank you for your interest in Galli Enterprise.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-10">
              <div className="text-xs font-semibold uppercase tracking-widest text-galli mb-3">
                EARLY ACCESS
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                Get Early Access
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                We&apos;re partnering with a small group of schools and programs to shape Galli Enterprise.
                Join the waitlist to lock in founding pricing.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition"
                />
              </div>

              {/* Name + Organization row */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Organization</label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="School or program name"
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Your Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition"
                >
                  <option value="">Select your role...</option>
                  <option value="coach">Coach</option>
                  <option value="athletic-director">Athletic Director</option>
                  <option value="school-admin">School Administrator</option>
                  <option value="teacher">Teacher</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Anything else? <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us about your program or what you're looking for..."
                  rows={3}
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !email}
                className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-full text-lg font-semibold hover:shadow-lg hover:shadow-galli/25 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Join the Waitlist
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  )
}
