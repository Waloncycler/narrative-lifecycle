import type { NarrativeMemory } from './reactivation';

export class MemoryService {
  private readonly memories: NarrativeMemory[];

  constructor(memories: NarrativeMemory[]) {
    this.memories = memories;
  }

  lookup(topicId: string): NarrativeMemory | undefined {
    return this.memories.find((memory) => memory.topic_id === topicId);
  }

  requiresMemoryLookup(topicId: string): boolean {
    return this.lookup(topicId) !== undefined;
  }
}
