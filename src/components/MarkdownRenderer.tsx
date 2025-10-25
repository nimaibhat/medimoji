'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css'; // You can change this to other themes

interface MarkdownRendererProps {
  content: string;
  className?: string;
  theme?: 'light' | 'dark';
}

export default function MarkdownRenderer({ content, className = '', theme = 'light' }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom styling for different elements
          h1: ({ children }) => (
            <h1 className={`text-2xl font-bold mb-4 mt-6 first:mt-0 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={`text-xl font-semibold mb-3 mt-5 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={`text-lg font-medium mb-2 mt-4 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-700'}`}>
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className={`mb-3 leading-relaxed ${theme === 'dark' ? 'text-white' : 'text-gray-700'}`}>
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className={`list-disc list-inside mb-3 space-y-1 ${theme === 'dark' ? 'text-white' : 'text-gray-700'}`}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className={`list-decimal list-inside mb-3 space-y-1 ${theme === 'dark' ? 'text-white' : 'text-gray-700'}`}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className={theme === 'dark' ? 'text-white' : 'text-gray-700'}>
              {children}
            </li>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className={`px-1.5 py-0.5 rounded text-sm font-mono ${
                  theme === 'dark' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {children}
                </code>
              );
            }
            return (
              <code className={className}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className={`p-4 rounded-lg overflow-x-auto mb-4 ${
              theme === 'dark' 
                ? 'bg-gray-800 text-gray-100' 
                : 'bg-gray-900 text-gray-100'
            }`}>
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className={`border-l-4 border-blue-500 pl-4 italic mb-3 ${
              theme === 'dark' ? 'text-gray-200' : 'text-gray-600'
            }`}>
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border border-gray-200 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className={`px-4 py-2 text-left text-sm font-medium border-b border-gray-200 ${
              theme === 'dark' ? 'text-white' : 'text-gray-700'
            }`}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className={`px-4 py-2 text-sm border-b border-gray-200 ${
              theme === 'dark' ? 'text-gray-200' : 'text-gray-600'
            }`}>
              {children}
            </td>
          ),
          a: ({ children, href }) => (
            <a 
              href={href} 
              className={`underline ${
                theme === 'dark' 
                  ? 'text-blue-300 hover:text-blue-100' 
                  : 'text-blue-600 hover:text-blue-800'
              }`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className={`font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className={`italic ${
              theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
            }`}>
              {children}
            </em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
