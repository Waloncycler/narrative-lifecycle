import type { VectorStore, VectorEmbedding } from './vector_store';
import type { DocumentChunk, EvidenceCandidate } from '@/features/intake/types/intake';

export interface TextEmbedder {
  embed(text: string): Promise<number[]>;
}

export class DummyTextEmbedder implements TextEmbedder {
  // A dummy embedder that returns random vectors for testing
  async embed(text: string): Promise<number[]> {
    const vec = [];
    for (let i = 0; i < 1536; i++) {
      vec.push(Math.random() * 2 - 1);
    }
    return vec;
  }
}

export class VectorizationService {
  constructor(
    private readonly vectorStore: VectorStore,
    private readonly embedder: TextEmbedder
  ) {}

  async vectorizeDocumentChunks(chunks: DocumentChunk[]): Promise<void> {
    const embeddings: VectorEmbedding[] = await Promise.all(
      chunks.map(async (chunk) => ({
        id: `chunk_${chunk.chunk_id}`,
        vector: await this.embedder.embed(chunk.text),
        metadata: {
          type: 'document_chunk',
          raw_document_id: chunk.raw_document_id,
          index: chunk.index,
          start_offset: chunk.start_offset,
          end_offset: chunk.end_offset,
        },
      }))
    );
    await this.vectorStore.upsert(embeddings);
  }

  async vectorizeEvidenceCandidates(candidates: EvidenceCandidate[]): Promise<void> {
    const embeddings: VectorEmbedding[] = await Promise.all(
      candidates.map(async (candidate) => ({
        id: `candidate_${candidate.candidate_id}`,
        vector: await this.embedder.embed(candidate.original_quote),
        metadata: {
          type: 'evidence_candidate',
          raw_document_id: candidate.raw_document_id,
          chunk_id: candidate.chunk_id,
          provenance_id: candidate.provenance_id,
        },
      }))
    );
    await this.vectorStore.upsert(embeddings);
  }
}
