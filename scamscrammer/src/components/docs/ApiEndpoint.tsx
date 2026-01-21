'use client';

import { useState } from 'react';
import CodeBlock from './CodeBlock';
import ParamsTable, { type Parameter } from './ParamsTable';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiEndpointProps {
  method: HttpMethod;
  path: string;
  description: string;
  parameters?: Parameter[];
  queryParameters?: Parameter[];
  requestBody?: {
    description?: string;
    example: string;
  };
  exampleResponse: string;
  responseDescription?: string;
  deprecated?: boolean;
}

const methodColors: Record<HttpMethod, string> = {
  GET: 'bg-green-500/20 text-green-400 border-green-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  PATCH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

/**
 * Reusable API endpoint documentation component
 */
export default function ApiEndpoint({
  method,
  path,
  description,
  parameters = [],
  queryParameters = [],
  requestBody,
  exampleResponse,
  responseDescription,
  deprecated = false,
}: ApiEndpointProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Parse path to highlight parameters
  const renderPath = () => {
    const parts = path.split(/(\/:[\w]+|\{[\w]+\})/g);
    return parts.map((part, index) => {
      if (part.startsWith('/:') || part.startsWith('{')) {
        const paramName = part.replace(/^[/:]|\{|\}/g, '');
        return (
          <span key={index} className="text-orange-400">
            {part.startsWith('/:') ? '/:' : '{'}
            <span className="text-orange-300">{paramName}</span>
            {part.startsWith('{') ? '}' : ''}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div
      className={`rounded-xl border bg-gray-800/50 overflow-hidden ${
        deprecated ? 'border-yellow-500/30 opacity-75' : 'border-gray-700'
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 text-xs font-bold uppercase rounded border ${methodColors[method]}`}
          >
            {method}
          </span>
          <code className="text-gray-200 font-mono text-sm">{renderPath()}</code>
          {deprecated && (
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              Deprecated
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-6 border-t border-gray-700/50">
          {/* Description */}
          <div className="pt-4">
            <p className="text-gray-300">{description}</p>
          </div>

          {/* Path Parameters */}
          {parameters.length > 0 && (
            <div>
              <ParamsTable parameters={parameters} title="Path Parameters" />
            </div>
          )}

          {/* Query Parameters */}
          {queryParameters.length > 0 && (
            <div>
              <ParamsTable parameters={queryParameters} title="Query Parameters" />
            </div>
          )}

          {/* Request Body */}
          {requestBody && (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Request Body</h4>
              {requestBody.description && (
                <p className="text-sm text-gray-400 mb-3">{requestBody.description}</p>
              )}
              <CodeBlock code={requestBody.example} language="json" />
            </div>
          )}

          {/* Example Request */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Example Request</h4>
            <CodeBlock
              code={`curl -X ${method} "https://scamscrammer.com${path.replace(/:(\w+)/g, '{$1}')}"`}
              language="curl"
              title="cURL"
            />
          </div>

          {/* Example Response */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3">
              Response
              {responseDescription && (
                <span className="font-normal text-gray-500 ml-2">
                  - {responseDescription}
                </span>
              )}
            </h4>
            <CodeBlock
              code={exampleResponse}
              language="json"
              title="Response (200 OK)"
            />
          </div>
        </div>
      )}
    </div>
  );
}
