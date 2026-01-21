/**
 * Settings API Route
 *
 * Manages persona selection settings. For MVP, settings are stored
 * server-side in a JSON file or memory. In production, consider
 * using a database Settings model.
 *
 * GET /api/settings - Retrieve current settings
 * PATCH /api/settings - Update settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { PersonaType } from '@/lib/personas/types';
import { isValidPersonaType, getPersonaTypes } from '@/lib/personas';
import fs from 'fs';
import path from 'path';

export interface PersonaSettings {
  enabledPersonas: PersonaType[];
  selectionMode: 'random' | 'round_robin' | 'fixed';
  fixedPersona?: PersonaType;
  lastUsedPersonaIndex?: number;
}

const DEFAULT_SETTINGS: PersonaSettings = {
  enabledPersonas: ['earl', 'gladys', 'kevin', 'brenda'],
  selectionMode: 'random',
  fixedPersona: undefined,
  lastUsedPersonaIndex: 0,
};

const SETTINGS_FILE = path.join(process.cwd(), '.settings.json');

/**
 * Load settings from file or return defaults
 */
function loadSettings(): PersonaSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save settings to file
 */
function saveSettings(settings: PersonaSettings): void {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}

/**
 * GET /api/settings
 * Retrieve current persona settings
 */
export async function GET(): Promise<NextResponse> {
  try {
    const settings = loadSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings
 * Update persona settings
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const currentSettings = loadSettings();

    // Validate enabledPersonas if provided
    if (body.enabledPersonas !== undefined) {
      if (!Array.isArray(body.enabledPersonas)) {
        return NextResponse.json(
          { error: 'enabledPersonas must be an array' },
          { status: 400 }
        );
      }

      // Ensure at least one persona is enabled
      if (body.enabledPersonas.length === 0) {
        return NextResponse.json(
          { error: 'At least one persona must be enabled' },
          { status: 400 }
        );
      }

      // Validate all persona types
      const validTypes = getPersonaTypes();
      for (const persona of body.enabledPersonas) {
        if (!isValidPersonaType(persona)) {
          return NextResponse.json(
            { error: `Invalid persona type: ${persona}. Valid types: ${validTypes.join(', ')}` },
            { status: 400 }
          );
        }
      }
    }

    // Validate selectionMode if provided
    if (body.selectionMode !== undefined) {
      const validModes = ['random', 'round_robin', 'fixed'];
      if (!validModes.includes(body.selectionMode)) {
        return NextResponse.json(
          { error: `Invalid selection mode. Valid modes: ${validModes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate fixedPersona if provided and mode is 'fixed'
    if (body.selectionMode === 'fixed' || currentSettings.selectionMode === 'fixed') {
      const fixedPersona = body.fixedPersona ?? currentSettings.fixedPersona;
      if (body.selectionMode === 'fixed' && !fixedPersona) {
        return NextResponse.json(
          { error: 'fixedPersona is required when selectionMode is "fixed"' },
          { status: 400 }
        );
      }

      if (fixedPersona && !isValidPersonaType(fixedPersona)) {
        return NextResponse.json(
          { error: `Invalid fixed persona: ${fixedPersona}` },
          { status: 400 }
        );
      }

      // Ensure fixed persona is in enabled list
      const enabledList = body.enabledPersonas ?? currentSettings.enabledPersonas;
      if (fixedPersona && !enabledList.includes(fixedPersona)) {
        return NextResponse.json(
          { error: 'Fixed persona must be in the enabled personas list' },
          { status: 400 }
        );
      }
    }

    // Merge and save settings
    const updatedSettings: PersonaSettings = {
      ...currentSettings,
      ...(body.enabledPersonas !== undefined && { enabledPersonas: body.enabledPersonas }),
      ...(body.selectionMode !== undefined && { selectionMode: body.selectionMode }),
      ...(body.fixedPersona !== undefined && { fixedPersona: body.fixedPersona }),
      ...(body.lastUsedPersonaIndex !== undefined && { lastUsedPersonaIndex: body.lastUsedPersonaIndex }),
    };

    saveSettings(updatedSettings);

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
