'use client';

import { useState } from 'react';

interface SearchResult {
  id: string;
  content: string;
  metadata: {
    title: string;
    author?: string;
    url?: string;
    publishedDate?: string;
    chunkIndex: number;
    totalChunks: number;
  };
  similarity: number;
  distance?: number;
}

export default function TestEmbeddingsPage() {
  const [articleContent, setArticleContent] = useState('');
  const [articleTitle, setArticleTitle] = useState('');
  const [articleAuthor, setArticleAuthor] = useState('');
  const [articleUrl, setArticleUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const processArticle = async () => {
    if (!articleContent.trim() || !articleTitle.trim()) {
      setMessage('Please provide both article content and title');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/process-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: articleContent,
          title: articleTitle,
          author: articleAuthor || undefined,
          url: articleUrl || undefined,
          replaceExisting: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✅ Successfully processed article with ${data.data.embeddingsCount} chunks in ${data.data.processingTime}ms`);
      } else {
        setMessage(`❌ Error: ${data.message}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const searchEmbeddings = async () => {
    if (!searchQuery.trim()) {
      setMessage('Please enter a search query');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/search-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 5,
          threshold: 0.7,
          useTextSearch: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSearchResults(data.data.results);
        setMessage(`✅ Found ${data.data.totalResults} results in ${data.data.searchTime}ms`);
      } else {
        setMessage(`❌ Error: ${data.message}`);
        setSearchResults([]);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getStats = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/process-article');
      const data = await response.json();

      if (data.success) {
        setMessage(`📊 Stats: ${data.data.totalEmbeddings} embeddings across ${data.data.uniqueArticles} articles (avg ${data.data.averageChunksPerArticle.toFixed(1)} chunks/article)`);
      } else {
        setMessage(`❌ Error: ${data.message}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Vector Embeddings Test</h1>
        
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('✅') ? 'bg-green-100 text-green-800' : 
            message.includes('❌') ? 'bg-red-100 text-red-800' : 
            'bg-blue-100 text-blue-800'
          }`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Process Article Section */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Process Article</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Article Title *
                </label>
                <input
                  type="text"
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter article title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Author
                </label>
                <input
                  type="text"
                  value={articleAuthor}
                  onChange={(e) => setArticleAuthor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter author name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={articleUrl}
                  onChange={(e) => setArticleUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter article URL"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Article Content *
                </label>
                <textarea
                  value={articleContent}
                  onChange={(e) => setArticleContent(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter the full article content here..."
                />
              </div>

              <button
                onClick={processArticle}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Process Article'}
              </button>
            </div>
          </div>

          {/* Search Section */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Search Embeddings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Query
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your search query"
                />
              </div>

              <button
                onClick={searchEmbeddings}
                disabled={loading}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>

              <button
                onClick={getStats}
                disabled={loading}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Get Stats'}
              </button>
            </div>
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-8 bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Search Results</h3>
            <div className="space-y-4">
              {searchResults.map((result, index) => (
                <div key={result.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">
                      {result.metadata.title} (Chunk {result.metadata.chunkIndex + 1}/{result.metadata.totalChunks})
                    </h4>
                    <span className="text-sm text-gray-500">
                      Similarity: {(result.similarity * 100).toFixed(1)}%
                    </span>
                  </div>
                  {result.metadata.author && (
                    <p className="text-sm text-gray-600 mb-2">By {result.metadata.author}</p>
                  )}
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {result.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sample Article */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Sample Article (for testing)</h3>
          <button
            onClick={() => {
              setArticleTitle('Understanding Vector Embeddings in AI');
              setArticleAuthor('Dr. Jane Smith');
              setArticleUrl('https://example.com/vector-embeddings');
              setArticleContent(`Vector embeddings are a fundamental concept in artificial intelligence and machine learning. They represent text, images, or other data as dense vectors in a high-dimensional space, enabling computers to understand and work with complex relationships between different pieces of information.

The key advantage of vector embeddings is their ability to capture semantic meaning. Words or phrases with similar meanings are positioned close to each other in the vector space, while unrelated concepts are farther apart. This property makes embeddings incredibly useful for tasks like semantic search, recommendation systems, and natural language processing.

In the context of medical applications, vector embeddings can be used to understand patient symptoms, medical conditions, and treatment protocols. For example, symptoms like "chest pain" and "angina" would be positioned close to each other in the embedding space, allowing AI systems to recognize their relationship even if they're expressed differently.

The process of creating embeddings typically involves training neural networks on large datasets. These networks learn to map input data to vectors in a way that preserves semantic relationships. Popular embedding models include Word2Vec, GloVe, and more recently, transformer-based models like those from OpenAI.

Vector embeddings have revolutionized how we approach information retrieval and understanding. They enable more intuitive and accurate search capabilities, better recommendation systems, and more sophisticated AI applications across various domains.`);
            }}
            className="bg-blue-100 text-blue-800 py-2 px-4 rounded-md hover:bg-blue-200 transition-colors"
          >
            Load Sample Article
          </button>
        </div>
      </div>
    </div>
  );
}

