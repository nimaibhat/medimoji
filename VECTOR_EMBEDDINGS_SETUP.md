# Vector Embeddings Setup

This document explains how to use the vector embedding functionality in the Medimoji application.

## Overview

The vector embedding system allows you to:
- Process articles and convert them into vector embeddings
- Store embeddings in Firebase Firestore
- Search for similar content using semantic similarity
- Manage and query your knowledge base

## Environment Variables

Make sure you have the following environment variables set in your `.env.local` file:

```env
# OpenAI API Key (required for generating embeddings)
OPENAI_API_KEY=your_openai_api_key_here

# Firebase Configuration (required for storing embeddings)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key
```

## API Endpoints

### 1. Process Article
**POST** `/api/process-article`

Process an article and store its vector embeddings.

**Request Body:**
```json
{
  "content": "Your article content here...",
  "title": "Article Title",
  "author": "Author Name (optional)",
  "url": "https://example.com/article (optional)",
  "publishedDate": "2024-01-01 (optional)",
  "replaceExisting": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully processed article with 5 chunks",
  "data": {
    "embeddingsCount": 5,
    "articleTitle": "Article Title",
    "processingTime": 1250
  }
}
```

### 2. Search Embeddings
**POST** `/api/search-embeddings`

Search for similar content using text queries.

**Request Body:**
```json
{
  "query": "your search query",
  "limit": 10,
  "threshold": 0.7,
  "useTextSearch": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Found 3 similar results",
  "data": {
    "results": [
      {
        "id": "article-chunk-0",
        "content": "Relevant content snippet...",
        "metadata": {
          "title": "Article Title",
          "author": "Author Name",
          "chunkIndex": 0,
          "totalChunks": 5
        },
        "similarity": 0.85
      }
    ],
    "query": "your search query",
    "totalResults": 3,
    "searchTime": 150
  }
}
```

### 3. Manage Embeddings
**GET** `/api/manage-embeddings?action=stats`
**GET** `/api/manage-embeddings?action=get-article&articleTitle=Title`
**DELETE** `/api/manage-embeddings`

Manage and query your stored embeddings.

## Usage Examples

### 1. Process an Article

```typescript
import { EmbeddingUtils } from '@/lib/embedding-utils';

const result = await EmbeddingUtils.processArticleFromSource(
  "Your article content here...",
  {
    title: "Understanding Vector Embeddings",
    author: "Dr. Jane Smith",
    url: "https://example.com/article",
    publishedDate: "2024-01-01"
  }
);

if (result.success) {
  console.log(`Processed ${result.embeddingsCount} chunks in ${result.processingTime}ms`);
} else {
  console.error(`Error: ${result.error}`);
}
```

### 2. Search for Similar Content

```typescript
import { EmbeddingUtils } from '@/lib/embedding-utils';

const searchResult = await EmbeddingUtils.searchSimilarContent(
  "chest pain symptoms",
  {
    limit: 5,
    threshold: 0.7
  }
);

if (searchResult.success) {
  searchResult.results.forEach(result => {
    console.log(`${result.title}: ${result.similarity.toFixed(2)} similarity`);
    console.log(result.content);
  });
}
```

### 3. Get Embedding Statistics

```typescript
import { EmbeddingUtils } from '@/lib/embedding-utils';

const summary = await EmbeddingUtils.getEmbeddingSummary();

if (summary.success && summary.stats) {
  console.log(`Total embeddings: ${summary.stats.totalEmbeddings}`);
  console.log(`Unique articles: ${summary.stats.uniqueArticles}`);
  console.log(`Average chunks per article: ${summary.stats.averageChunksPerArticle.toFixed(1)}`);
}
```

## Testing

Visit `/test-embeddings` in your application to test the vector embedding functionality with a user-friendly interface.

## How It Works

1. **Article Processing**: Articles are split into chunks (1000 characters each with 200 character overlap)
2. **Embedding Generation**: Each chunk is converted to a vector using OpenAI's `text-embedding-3-small` model
3. **Storage**: Embeddings are stored in Firebase Firestore with metadata
4. **Search**: Queries are converted to embeddings and compared using cosine similarity
5. **Results**: Most similar chunks are returned with similarity scores

## Performance Considerations

- **Chunk Size**: Default is 1000 characters with 200 character overlap
- **Batch Processing**: Embeddings are generated in batches of 10 to respect rate limits
- **Caching**: Consider implementing caching for frequently accessed embeddings
- **Indexing**: For large datasets, consider using a dedicated vector database like Pinecone or Weaviate

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**: Ensure all required environment variables are set
2. **OpenAI Rate Limits**: The system includes delays between batches to respect rate limits
3. **Firebase Permissions**: Ensure your Firebase service account has read/write permissions
4. **Memory Usage**: Large articles may consume significant memory during processing

### Debug Mode

Set `NODE_ENV=development` to see detailed logging information.

## Future Enhancements

- Support for different embedding models
- Batch processing of multiple articles
- Real-time embedding updates
- Advanced filtering and faceted search
- Integration with external vector databases
- Embedding visualization tools

