'use client';

import { useState } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  title?: string;
}

/**
 * Syntax highlighted code block component for API documentation
 */
export default function CodeBlock({
  code,
  language = 'json',
  showLineNumbers = false,
  title,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const lines = code.split('\n');

  // Simple JSON syntax highlighting
  const highlightJson = (text: string): React.ReactNode[] => {
    const tokens: React.ReactNode[] = [];

    // Regex patterns for JSON tokens
    const patterns = [
      { regex: /^("(?:\\.|[^"\\])*")(\s*:)/, type: 'key' }, // Object key
      { regex: /^("(?:\\.|[^"\\])*")/, type: 'string' }, // String value
      { regex: /^(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/, type: 'number' }, // Number
      { regex: /^(true|false)/, type: 'boolean' }, // Boolean
      { regex: /^(null)/, type: 'null' }, // Null
      { regex: /^([{}[\]])/, type: 'bracket' }, // Brackets
      { regex: /^([:,])/, type: 'punctuation' }, // Punctuation
      { regex: /^(\s+)/, type: 'whitespace' }, // Whitespace
    ];

    let remaining = text;
    let keyIndex = 0;

    while (remaining.length > 0) {
      let matched = false;

      for (const { regex, type } of patterns) {
        const match = remaining.match(regex);
        if (match) {
          const value = match[1] || match[0];
          const colon = match[2] || '';

          let className = '';
          switch (type) {
            case 'key':
              className = 'text-purple-400';
              break;
            case 'string':
              className = 'text-green-400';
              break;
            case 'number':
              className = 'text-orange-400';
              break;
            case 'boolean':
              className = 'text-blue-400';
              break;
            case 'null':
              className = 'text-gray-500';
              break;
            case 'bracket':
              className = 'text-gray-300';
              break;
            case 'punctuation':
              className = 'text-gray-400';
              break;
            default:
              className = '';
          }

          if (className) {
            tokens.push(
              <span key={keyIndex++} className={className}>
                {value}
              </span>
            );
            if (colon) {
              tokens.push(
                <span key={keyIndex++} className="text-gray-400">
                  {colon}
                </span>
              );
            }
          } else {
            tokens.push(<span key={keyIndex++}>{value}</span>);
          }

          remaining = remaining.slice(match[0].length);
          matched = true;
          break;
        }
      }

      if (!matched) {
        // If no pattern matches, just add the character
        tokens.push(<span key={keyIndex++}>{remaining[0]}</span>);
        remaining = remaining.slice(1);
      }
    }

    return tokens;
  };

  // Simple bash/curl syntax highlighting
  const highlightBash = (text: string): React.ReactNode => {
    return text.split('\n').map((line, lineIndex) => {
      const parts: React.ReactNode[] = [];
      let remaining = line;
      let partIndex = 0;

      // Highlight curl and common flags
      remaining = remaining.replace(
        /^(curl|wget|http|GET|POST|PUT|DELETE|PATCH)/g,
        '\u0001$1\u0002'
      );
      remaining = remaining.replace(
        /(\s)(-[A-Za-z]+|--[a-z-]+)/g,
        '$1\u0003$2\u0004'
      );
      remaining = remaining.replace(
        /(https?:\/\/[^\s'"]+)/g,
        '\u0005$1\u0006'
      );
      remaining = remaining.replace(
        /("(?:\\.|[^"\\])*")/g,
        '\u0007$1\u0008'
      );

      let i = 0;
      while (i < remaining.length) {
        if (remaining[i] === '\u0001') {
          const end = remaining.indexOf('\u0002', i);
          parts.push(
            <span key={partIndex++} className="text-green-400 font-semibold">
              {remaining.slice(i + 1, end)}
            </span>
          );
          i = end + 1;
        } else if (remaining[i] === '\u0003') {
          const end = remaining.indexOf('\u0004', i);
          parts.push(
            <span key={partIndex++} className="text-purple-400">
              {remaining.slice(i + 1, end)}
            </span>
          );
          i = end + 1;
        } else if (remaining[i] === '\u0005') {
          const end = remaining.indexOf('\u0006', i);
          parts.push(
            <span key={partIndex++} className="text-blue-400">
              {remaining.slice(i + 1, end)}
            </span>
          );
          i = end + 1;
        } else if (remaining[i] === '\u0007') {
          const end = remaining.indexOf('\u0008', i);
          parts.push(
            <span key={partIndex++} className="text-orange-400">
              {remaining.slice(i + 1, end)}
            </span>
          );
          i = end + 1;
        } else {
          // Collect regular text
          let text = '';
          while (
            i < remaining.length &&
            !['\u0001', '\u0003', '\u0005', '\u0007'].includes(remaining[i])
          ) {
            text += remaining[i];
            i++;
          }
          if (text) {
            parts.push(<span key={partIndex++}>{text}</span>);
          }
        }
      }

      return (
        <span key={lineIndex}>
          {parts}
          {lineIndex < text.split('\n').length - 1 && '\n'}
        </span>
      );
    });
  };

  const renderHighlightedCode = () => {
    if (language === 'json') {
      return lines.map((line, index) => (
        <div key={index} className="table-row">
          {showLineNumbers && (
            <span className="table-cell pr-4 text-gray-600 select-none text-right w-8">
              {index + 1}
            </span>
          )}
          <span className="table-cell">{highlightJson(line)}</span>
        </div>
      ));
    } else if (language === 'bash' || language === 'curl') {
      return (
        <div className="table-row">
          <span className="table-cell">{highlightBash(code)}</span>
        </div>
      );
    }

    // Plain text fallback
    return lines.map((line, index) => (
      <div key={index} className="table-row">
        {showLineNumbers && (
          <span className="table-cell pr-4 text-gray-600 select-none text-right w-8">
            {index + 1}
          </span>
        )}
        <span className="table-cell">{line}</span>
      </div>
    ));
  };

  const languageLabel: Record<string, string> = {
    json: 'JSON',
    bash: 'Bash',
    curl: 'cURL',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
  };

  return (
    <div className="rounded-lg overflow-hidden border border-gray-700 bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          {title && <span className="text-sm text-gray-300 font-medium">{title}</span>}
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-700 text-gray-400">
            {languageLabel[language] || language.toUpperCase()}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-4 overflow-x-auto">
        <pre className="text-sm font-mono text-gray-300">
          <code className="table">{renderHighlightedCode()}</code>
        </pre>
      </div>
    </div>
  );
}
