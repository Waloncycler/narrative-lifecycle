import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { DEFAULT_INDUSTRY_PACKS } from '@/features/reporting/domain/industry_packs';
import type { IndustryPack } from '@/features/reporting/types/industry';

export class FileIndustryPackRepository {
  constructor(private readonly repoRoot: string) {}

  readIndustryPacks(): IndustryPack[] {
    const path = resolve(this.repoRoot, 'data/industry_packs/packs.yaml');
    if (!existsSync(path)) return DEFAULT_INDUSTRY_PACKS;
    const packs = parse(readFileSync(path, 'utf8')) as IndustryPack[];
    return Array.isArray(packs) && packs.length ? packs : DEFAULT_INDUSTRY_PACKS;
  }
}
