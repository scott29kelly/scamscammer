'use client';

/**
 * TagBadges Component
 *
 * Displays tags as colored badges with scam type detection colors.
 * Supports interactive mode for adding/removing tags.
 */

import { useState } from 'react';
import { getTagColor, formatTagLabel, ScamType, getScamTypeColor } from '@/lib/tagging';

interface TagBadgesProps {
  tags: string[];
  editable?: boolean;
  onTagsChange?: (tags: string[]) => void;
  size?: 'sm' | 'md' | 'lg';
  maxDisplay?: number;
  showAnalyzeButton?: boolean;
  onAnalyze?: () => Promise<void>;
  analyzing?: boolean;
}

// Known scam type tags that get special styling
const SCAM_TYPE_TAGS = Object.values(ScamType).map((t) =>
  t.replace('_', '-')
);

export default function TagBadges({
  tags,
  editable = false,
  onTagsChange,
  size = 'md',
  maxDisplay,
  showAnalyzeButton = false,
  onAnalyze,
  analyzing = false,
}: TagBadgesProps) {
  const [showAll, setShowAll] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const displayedTags =
    maxDisplay && !showAll ? tags.slice(0, maxDisplay) : tags;
  const hiddenCount = maxDisplay ? tags.length - maxDisplay : 0;

  const handleRemoveTag = (tagToRemove: string) => {
    if (onTagsChange) {
      onTagsChange(tags.filter((tag) => tag !== tagToRemove));
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && onTagsChange) {
      const normalizedTag = newTag
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_');
      if (!tags.includes(normalizedTag)) {
        onTagsChange([...tags, normalizedTag]);
      }
      setNewTag('');
      setIsAddingTag(false);
    }
  };

  const getTagStyle = (tag: string) => {
    const normalizedTag = tag.toLowerCase().replace('-', '_');
    const isScamType = SCAM_TYPE_TAGS.includes(tag);

    if (isScamType) {
      const scamType = normalizedTag as ScamType;
      const color = getScamTypeColor(scamType);
      return {
        backgroundColor: `${color}20`,
        borderColor: `${color}60`,
        color: color,
      };
    }

    const color = getTagColor(normalizedTag);
    return {
      backgroundColor: `${color}15`,
      borderColor: `${color}40`,
      color: color,
    };
  };

  if (tags.length === 0 && !editable && !showAnalyzeButton) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {displayedTags.map((tag) => {
        const style = getTagStyle(tag);
        const isScamType = SCAM_TYPE_TAGS.includes(tag);

        return (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 rounded-full border font-medium ${sizeClasses[size]} ${
              isScamType ? 'font-semibold' : ''
            }`}
            style={style}
          >
            {isScamType && <span className="mr-0.5">🎯</span>}
            {formatTagLabel(tag)}
            {editable && (
              <button
                onClick={() => handleRemoveTag(tag)}
                className="ml-1 hover:opacity-70 transition-opacity"
                type="button"
                aria-label={`Remove ${tag} tag`}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </span>
        );
      })}

      {/* Show more button */}
      {hiddenCount > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className={`text-gray-400 hover:text-white ${sizeClasses[size]} transition-colors`}
          type="button"
        >
          +{hiddenCount} more
        </button>
      )}

      {/* Show less button */}
      {showAll && maxDisplay && tags.length > maxDisplay && (
        <button
          onClick={() => setShowAll(false)}
          className={`text-gray-400 hover:text-white ${sizeClasses[size]} transition-colors`}
          type="button"
        >
          Show less
        </button>
      )}

      {/* Add tag input */}
      {editable && !isAddingTag && (
        <button
          onClick={() => setIsAddingTag(true)}
          className={`inline-flex items-center gap-1 rounded-full border border-dashed border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300 ${sizeClasses[size]} transition-colors`}
          type="button"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add tag
        </button>
      )}

      {/* Add tag form */}
      {editable && isAddingTag && (
        <div className="inline-flex items-center gap-1">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddTag();
              } else if (e.key === 'Escape') {
                setIsAddingTag(false);
                setNewTag('');
              }
            }}
            placeholder="Enter tag..."
            className={`bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-sm w-24 focus:outline-none focus:border-blue-500`}
            autoFocus
          />
          <button
            onClick={handleAddTag}
            className="text-green-400 hover:text-green-300"
            type="button"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </button>
          <button
            onClick={() => {
              setIsAddingTag(false);
              setNewTag('');
            }}
            className="text-gray-400 hover:text-gray-300"
            type="button"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Analyze button */}
      {showAnalyzeButton && onAnalyze && (
        <button
          onClick={onAnalyze}
          disabled={analyzing}
          className={`inline-flex items-center gap-1 rounded-full border border-blue-500/50 text-blue-400 hover:bg-blue-500/20 ${sizeClasses[size]} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          type="button"
        >
          {analyzing ? (
            <>
              <svg
                className="w-3 h-3 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              Auto-analyze
            </>
          )}
        </button>
      )}

      {/* Empty state */}
      {tags.length === 0 && !editable && !showAnalyzeButton && (
        <span className="text-gray-500 text-sm">No tags</span>
      )}
    </div>
  );
}

/**
 * Compact version for lists
 */
export function TagBadgesList({ tags, max = 3 }: { tags: string[]; max?: number }) {
  if (tags.length === 0) {
    return <span className="text-gray-500 text-xs">No tags</span>;
  }

  const displayedTags = tags.slice(0, max);
  const remaining = tags.length - max;

  return (
    <div className="flex flex-wrap gap-1">
      {displayedTags.map((tag) => {
        const normalizedTag = tag.toLowerCase().replace('-', '_');
        const isScamType = SCAM_TYPE_TAGS.includes(tag);
        const color = isScamType
          ? getScamTypeColor(normalizedTag as ScamType)
          : getTagColor(normalizedTag);

        return (
          <span
            key={tag}
            className="inline-flex items-center text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${color}20`,
              color: color,
            }}
          >
            {formatTagLabel(tag)}
          </span>
        );
      })}
      {remaining > 0 && (
        <span className="text-gray-500 text-xs">+{remaining}</span>
      )}
    </div>
  );
}
