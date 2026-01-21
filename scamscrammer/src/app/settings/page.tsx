'use client';

/**
 * Persona Settings Page
 *
 * Allows users to configure which personas are active and how they're selected
 * for incoming scam calls.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getAllPersonas, PersonaType, PersonaConfig } from '@/lib/personas';

interface PersonaSettings {
  enabledPersonas: PersonaType[];
  selectionMode: 'random' | 'round_robin' | 'fixed';
  fixedPersona?: PersonaType;
}

const DEFAULT_SETTINGS: PersonaSettings = {
  enabledPersonas: ['earl', 'gladys', 'kevin', 'brenda'],
  selectionMode: 'random',
};

const PERSONA_EMOJIS: Record<PersonaType, string> = {
  earl: '👴',
  gladys: '👵',
  kevin: '🧔',
  brenda: '💁',
};

const PERSONA_COLORS: Record<PersonaType, string> = {
  earl: 'border-orange-500 bg-orange-500/10',
  gladys: 'border-purple-500 bg-purple-500/10',
  kevin: 'border-green-500 bg-green-500/10',
  brenda: 'border-pink-500 bg-pink-500/10',
};

const PERSONA_TEXT_COLORS: Record<PersonaType, string> = {
  earl: 'text-orange-400',
  gladys: 'text-purple-400',
  kevin: 'text-green-400',
  brenda: 'text-pink-400',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<PersonaSettings>(DEFAULT_SETTINGS);
  const [personas] = useState<PersonaConfig[]>(getAllPersonas());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Save settings
  const saveSettings = useCallback(async (newSettings: PersonaSettings) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }, []);

  // Toggle persona enabled state
  const togglePersona = (personaId: PersonaType) => {
    const isEnabled = settings.enabledPersonas.includes(personaId);
    let newEnabled: PersonaType[];

    if (isEnabled) {
      // Don't allow disabling if it's the only one enabled
      if (settings.enabledPersonas.length === 1) {
        setMessage({ type: 'error', text: 'At least one persona must be enabled' });
        setTimeout(() => setMessage(null), 3000);
        return;
      }
      newEnabled = settings.enabledPersonas.filter(p => p !== personaId);

      // If the fixed persona was disabled, reset to first enabled
      const newSettings: PersonaSettings = {
        ...settings,
        enabledPersonas: newEnabled,
      };
      if (settings.fixedPersona === personaId) {
        newSettings.fixedPersona = newEnabled[0];
      }
      saveSettings(newSettings);
    } else {
      newEnabled = [...settings.enabledPersonas, personaId];
      saveSettings({ ...settings, enabledPersonas: newEnabled });
    }
  };

  // Change selection mode
  const changeSelectionMode = (mode: 'random' | 'round_robin' | 'fixed') => {
    const newSettings: PersonaSettings = {
      ...settings,
      selectionMode: mode,
    };
    if (mode === 'fixed' && !settings.fixedPersona) {
      newSettings.fixedPersona = settings.enabledPersonas[0];
    }
    saveSettings(newSettings);
  };

  // Change fixed persona
  const changeFixedPersona = (personaId: PersonaType) => {
    saveSettings({ ...settings, fixedPersona: personaId });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-1/3 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-800 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-gray-400 hover:text-white text-sm mb-4 inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold mt-2">Persona Settings</h1>
          <p className="text-gray-400 mt-2">
            Configure which AI personas answer scam calls and how they're selected.
          </p>
        </div>

        {/* Status message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-900/50 border border-green-500 text-green-300'
                : 'bg-red-900/50 border border-red-500 text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Selection Mode */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            Selection Mode
          </h2>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="space-y-4">
              <label className="flex items-start gap-4 p-4 rounded-lg bg-gray-700/50 cursor-pointer hover:bg-gray-700 transition">
                <input
                  type="radio"
                  name="selectionMode"
                  value="random"
                  checked={settings.selectionMode === 'random'}
                  onChange={() => changeSelectionMode('random')}
                  className="mt-1 w-5 h-5 text-blue-500"
                  disabled={saving}
                />
                <div>
                  <div className="font-medium">Random</div>
                  <div className="text-sm text-gray-400">
                    Randomly select a persona for each incoming call from the enabled list.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-4 p-4 rounded-lg bg-gray-700/50 cursor-pointer hover:bg-gray-700 transition">
                <input
                  type="radio"
                  name="selectionMode"
                  value="round_robin"
                  checked={settings.selectionMode === 'round_robin'}
                  onChange={() => changeSelectionMode('round_robin')}
                  className="mt-1 w-5 h-5 text-blue-500"
                  disabled={saving}
                />
                <div>
                  <div className="font-medium">Round Robin</div>
                  <div className="text-sm text-gray-400">
                    Cycle through enabled personas in order, giving each one a turn.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-4 p-4 rounded-lg bg-gray-700/50 cursor-pointer hover:bg-gray-700 transition">
                <input
                  type="radio"
                  name="selectionMode"
                  value="fixed"
                  checked={settings.selectionMode === 'fixed'}
                  onChange={() => changeSelectionMode('fixed')}
                  className="mt-1 w-5 h-5 text-blue-500"
                  disabled={saving}
                />
                <div className="flex-1">
                  <div className="font-medium">Always Use</div>
                  <div className="text-sm text-gray-400 mb-3">
                    Always use the same persona for every call.
                  </div>
                  {settings.selectionMode === 'fixed' && (
                    <select
                      value={settings.fixedPersona || settings.enabledPersonas[0]}
                      onChange={(e) => changeFixedPersona(e.target.value as PersonaType)}
                      className="bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm"
                      disabled={saving}
                    >
                      {settings.enabledPersonas.map(personaId => {
                        const persona = personas.find(p => p.id === personaId);
                        return (
                          <option key={personaId} value={personaId}>
                            {PERSONA_EMOJIS[personaId]} {persona?.name || personaId}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              </label>
            </div>
          </div>
        </section>

        {/* Active Personas */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-2xl">👥</span>
            Active Personas
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Toggle personas on/off. At least one must be enabled.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {personas.map(persona => {
              const isEnabled = settings.enabledPersonas.includes(persona.id);
              return (
                <div
                  key={persona.id}
                  className={`rounded-lg border-2 p-5 transition-all ${
                    isEnabled
                      ? PERSONA_COLORS[persona.id]
                      : 'border-gray-700 bg-gray-800/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{PERSONA_EMOJIS[persona.id]}</span>
                      <div>
                        <h3 className={`font-bold text-lg ${isEnabled ? PERSONA_TEXT_COLORS[persona.id] : 'text-gray-400'}`}>
                          {persona.name}
                        </h3>
                        <p className="text-sm text-gray-400">{persona.age} years old</p>
                      </div>
                    </div>
                    <button
                      onClick={() => togglePersona(persona.id)}
                      disabled={saving}
                      className={`relative w-14 h-7 rounded-full transition-colors ${
                        isEnabled ? 'bg-green-500' : 'bg-gray-600'
                      } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span
                        className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                          isEnabled ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-sm text-gray-300 mb-3">{persona.background}</p>
                  <p className="text-xs text-gray-500 italic">{persona.personality}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Persona Previews */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-2xl">💬</span>
            Persona Previews
          </h2>
          <div className="space-y-4">
            {personas.map(persona => (
              <div
                key={persona.id}
                className="bg-gray-800 rounded-lg p-6 border border-gray-700"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{PERSONA_EMOJIS[persona.id]}</span>
                  <div>
                    <h3 className={`font-bold ${PERSONA_TEXT_COLORS[persona.id]}`}>
                      {persona.fullName}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {persona.location} &bull; {persona.livingStatus}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Signature Phrases:</h4>
                  <div className="flex flex-wrap gap-2">
                    {persona.signaturePhrases.slice(0, 5).map((phrase, i) => (
                      <span
                        key={i}
                        className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded"
                      >
                        "{phrase}"
                      </span>
                    ))}
                    {persona.signaturePhrases.length > 5 && (
                      <span className="text-xs text-gray-500">
                        +{persona.signaturePhrases.length - 5} more
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Tangent Topics:</h4>
                  <div className="flex flex-wrap gap-2">
                    {persona.tangentTopics.slice(0, 4).map((topic, i) => (
                      <span
                        key={i}
                        className="text-xs bg-gray-700/50 text-gray-400 px-2 py-1 rounded border border-gray-600"
                      >
                        {topic.subject}
                      </span>
                    ))}
                    {persona.tangentTopics.length > 4 && (
                      <span className="text-xs text-gray-500">
                        +{persona.tangentTopics.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-700">
                  <button
                    className="text-sm text-gray-400 hover:text-white flex items-center gap-2 cursor-not-allowed opacity-50"
                    disabled
                    title="Voice preview coming soon"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    Preview Voice (Coming Soon)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-700 text-center text-gray-500 text-sm">
          Settings are saved automatically when you make changes.
        </div>
      </div>
    </div>
  );
}
