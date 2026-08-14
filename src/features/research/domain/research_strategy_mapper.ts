import type { StageGateInput } from '@/features/stages/domain/stages';

export interface DeepResearchProbeTarget {
  intent: 'capital_confirmation' | 'hard_reality' | 'stable_label' | 'independent_sources';
  required_source_classes: Array<'official' | 'company_primary' | 'academic'>;
  suggested_source_ids: string[];
  rationale: string;
}

export function buildDeepProbeTargets(whyNotHigherStage: string, gateInput?: StageGateInput | null): DeepResearchProbeTarget[] {
  const targets: DeepResearchProbeTarget[] = [];
  
  if (!gateInput) return targets;

  // S2 -> S3 barrier
  if (!gateInput.hasCapitalConfirmation && whyNotHigherStage.includes('CapitalConfirmation')) {
    targets.push({
      intent: 'capital_confirmation',
      required_source_classes: ['company_primary', 'official'],
      suggested_source_ids: ['sec_edgar', 'hkexnews', 'sse', 'szse'],
      rationale: 'Missing capital confirmation. Probing company primary disclosures and exchange filings for cap-ex, investments, or definitive agreements.',
    });
  }

  // S4 -> S5 barrier
  if (!gateInput.hasHardRealityEvidence && whyNotHigherStage.includes('HardRealityEvidence')) {
    targets.push({
      intent: 'hard_reality',
      required_source_classes: ['official', 'academic'],
      suggested_source_ids: ['clinicaltrials', 'pubmed', 'federal_register', 'fda'],
      rationale: 'Missing hard reality evidence. Probing academic, clinical, and regulatory sources for verifiable endpoint milestones.',
    });
  }

  return targets;
}
