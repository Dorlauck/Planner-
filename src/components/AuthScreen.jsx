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
    <div className="min-h-screen bg-sunrise flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / brand */}
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sunrise-warm shadow-soft mb-4">
            <span className="text-3xl">🌅</span>
          </div>
          <h1 className="text-4xl font-serif font-semibold text-dusk-900">Sunrise</h1>
          <p className="text-dusk-500 mt-1">
            Objectifs · Habitudes · Journée · Journal
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur rounded-3xl shadow-soft p-8 animate-fade-up">
          <div className="flex gap-2 mb-6 p-1 bg-peach-50 rounded-full">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 rounded-full text-sm font-medium transition ${
                mode === 'signin' ? 'bg-white shadow-card text-peach-600' : 'text-dusk-400'
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-full text-sm font-medium transition ${
                mode === 'signup' ? 'bg-white shadow-card text-peach-600' : 'text-dusk-400'
              }`}
            >
              Créer un compte
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-dusk-500 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.com"
                className="w-full px-4 py-3 rounded-xl border border-peach-100 bg-cream focus:outline-none focus:ring-2 focus:ring-peach-300"
              />
            </div>
            <div>
              <label className="block text-sm text-dusk-500 mb-1">Mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-peach-100 bg-cream focus:outline-none focus:ring-2 focus:ring-peach-300"
              />
            </div>

            {error && <p className="text-sm text-coral-600">{error}</p>}
            {message && <p className="text-sm text-peach-600">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-sunrise-warm text-white font-medium shadow-soft hover:opacity-95 transition disabled:opacity-60"
            >
              {loading ? '…' : mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-dusk-400 mt-6">
          Tes données sont privées et protégées par RLS.
        </p>
      </div>
    </div>
  )
}
