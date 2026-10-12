export interface VectorEmbedding {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface VectorStore {
  upsert(embeddings: VectorEmbedding[]): Promise<void>;
  search(queryVector: number[], limit?: number): Promise<VectorSearchResult[]>;
}

/**
 * A lightweight, in-memory implementation of VectorStore using cosine similarity.
 * Suitable for the current SQLite transition phase.
 */
export class InMemoryVectorStore implements VectorStore {
  private embeddings: VectorEmbedding[] = [];

  async upsert(embeddings: VectorEmbedding[]): Promise<void> {
    const newIds = new Set(embeddings.map(e => e.id));
    this.embeddings = this.embeddings.filter(e => !newIds.has(e.id));
    this.embeddings.push(...embeddings);
  }

  async search(queryVector: number[], limit = 10): Promise<VectorSearchResult[]> {
    const results = this.embeddings.map(embedding => {
      return {
        id: embedding.id,
        score: this.cosineSimilarity(queryVector, embedding.vector),
        metadata: embedding.metadata,
      };
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must be of the same length');
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
