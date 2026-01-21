interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string;
}

interface ParamsTableProps {
  parameters: Parameter[];
  title?: string;
}

/**
 * Parameters table component for API endpoint documentation
 */
export default function ParamsTable({ parameters, title }: ParamsTableProps) {
  if (parameters.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden">
      {title && (
        <h4 className="text-sm font-semibold text-gray-300 mb-3">{title}</h4>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 font-semibold text-gray-300 bg-gray-800/50">
                Name
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-300 bg-gray-800/50">
                Type
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-300 bg-gray-800/50">
                Required
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-300 bg-gray-800/50">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {parameters.map((param) => (
              <tr
                key={param.name}
                className="hover:bg-gray-800/30 transition-colors"
              >
                <td className="py-3 px-4">
                  <code className="text-purple-400 font-mono text-sm bg-purple-500/10 px-1.5 py-0.5 rounded">
                    {param.name}
                  </code>
                </td>
                <td className="py-3 px-4">
                  <code className="text-blue-400 font-mono text-sm">
                    {param.type}
                  </code>
                </td>
                <td className="py-3 px-4">
                  {param.required ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
                      Required
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-400">
                      Optional
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-gray-400">
                  {param.description}
                  {param.default && (
                    <span className="block mt-1 text-xs text-gray-500">
                      Default: <code className="text-gray-400">{param.default}</code>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type { Parameter };
