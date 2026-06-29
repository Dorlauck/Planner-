import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthScreen() {
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Compte créé ! Tu peux te connecter (vérifie tes mails si la confirmation est activée).')
        setMode('signin')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err.message ?? 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-app text-fg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 animate-fade-up">
          <h1 className="text-3xl font-semibold tracking-tight text-fg">Planner</h1>
          <p className="text-muted mt-1 text-sm">Organise ton projet, sans le complexifier.</p>
        </div>

        <div className="bg-surface border border-line rounded-2xl shadow-card p-7 animate-fade-up">
          <div className="flex gap-1 mb-6 p-1 bg-surface2 rounded-lg">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                mode === 'signin' ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                mode === 'signup' ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'
              }`}
            >
              Créer un compte
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.com"
                className="w-full px-4 py-2.5 rounded-lg border border-line bg-surface2 text-fg focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-faint"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-line bg-surface2 text-fg focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-faint"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {message && <p className="text-sm text-fg">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-accent text-accent-fg font-medium shadow-card hover:opacity-90 active:scale-[0.99] transition disabled:opacity-60"
            >
              {loading ? '…' : mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-faint mt-6">Tes données sont privées et protégées par RLS.</p>
      </div>
    </div>
  )
}
