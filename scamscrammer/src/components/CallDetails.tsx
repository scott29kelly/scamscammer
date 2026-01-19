'use client';

import { useState } from 'react';
import type { CallResponse } from '@/types';

interface CallDetailsProps {
  call: CallResponse;
  onUpdate?: (updates: { rating?: number; notes?: string; tags?: string[] }) => Promise<void>;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatPhoneNumber(phone: string): string {
  // Format US phone numbers as (XXX) XXX-XXXX
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-600';
    case 'IN_PROGRESS':
      return 'bg-blue-600';
    case 'RINGING':
      return 'bg-yellow-600';
    case 'FAILED':
    case 'NO_ANSWER':
      return 'bg-red-600';
    default:
      return 'bg-gray-600';
  }
}

export default function CallDetails({ call, onUpdate }: CallDetailsProps) {
  const [rating, setRating] = useState(call.rating || 0);
  const [notes, setNotes] = useState(call.notes || '');
  const [newTag, setNewTag] = useState('');
  const [tags, setTags] = useState(call.tags || []);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const handleRatingChange = async (newRating: number) => {
    setRating(newRating);
    if (onUpdate) {
      setIsSaving(true);
      await onUpdate({ rating: newRating });
      setIsSaving(false);
      showSavedMessage();
    }
  };

  const handleNotesBlur = async () => {
    if (notes !== (call.notes || '') && onUpdate) {
      setIsSaving(true);
      await onUpdate({ notes });
      setIsSaving(false);
      showSavedMessage();
    }
  };

  const handleAddTag = async () => {
    const trimmedTag = newTag.trim().toLowerCase();
    if (!trimmedTag || tags.includes(trimmedTag)) {
      setNewTag('');
      return;
    }

    const newTags = [...tags, trimmedTag];
    setTags(newTags);
    setNewTag('');

    if (onUpdate) {
      setIsSaving(true);
      await onUpdate({ tags: newTags });
      setIsSaving(false);
      showSavedMessage();
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(newTags);

    if (onUpdate) {
      setIsSaving(true);
      await onUpdate({ tags: newTags });
      setIsSaving(false);
      showSavedMessage();
    }
  };

  const showSavedMessage = () => {
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      {/* Header with status and save indicator */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(call.status)}`}>
            {call.status.replace('_', ' ')}
          </span>
          {isSaving && (
            <span className="text-sm text-gray-400">Saving...</span>
          )}
          {showSaved && (
            <span className="text-sm text-green-400">Saved!</span>
          )}
        </div>
        <div className="text-sm text-gray-400">
          ID: {call.twilioSid}
        </div>
      </div>

      {/* Call info grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider">From</label>
          <p className="text-white font-medium">{formatPhoneNumber(call.fromNumber)}</p>
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider">To</label>
          <p className="text-white font-medium">{formatPhoneNumber(call.toNumber)}</p>
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider">Duration</label>
          <p className="text-white font-medium">{formatDuration(call.duration)}</p>
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider">Date</label>
          <p className="text-white font-medium">
            {new Date(call.createdAt).toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* Rating */}
      <div className="mb-6">
        <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
          Entertainment Rating
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleRatingChange(star)}
              className={`text-2xl transition-transform hover:scale-110 ${
                star <= rating ? 'text-yellow-400' : 'text-gray-600'
              }`}
              title={`Rate ${star} star${star !== 1 ? 's' : ''}`}
            >
              ★
            </button>
          ))}
          {rating > 0 && (
            <button
              onClick={() => handleRatingChange(0)}
              className="ml-2 text-xs text-gray-500 hover:text-gray-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="mb-6">
        <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
          Tags
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-700 rounded-full text-sm text-gray-200"
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="text-gray-400 hover:text-white ml-1"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            placeholder="Add a tag..."
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddTag}
            disabled={!newTag.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white text-sm transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Add notes about this call..."
          rows={3}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  );
}
