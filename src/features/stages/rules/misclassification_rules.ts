export type MisclassificationWarning =
  | 'attention_is_not_narrative'
  | 'policy_name_is_not_capital_confirmation'
  | 'price_action_is_not_pricing_adoption'
  | 'research_report_is_not_reality_validation'
  | 'partnership_is_not_order'
  | 'order_is_not_revenue'
  | 'revenue_is_not_profit'
  | 'branch_validation_is_not_parent_validation'
  | 'single_company_is_not_sector_validation'
  | 'high_heat_is_not_high_payoff'
  | 's6_is_not_safety';

export interface MisclassificationInput {
  onlyAttention?: boolean;
  onlyPolicyNaming?: boolean;
  onlyPriceAction?: boolean;
  onlyResearchReports?: boolean;
  onlyStrategicPartnership?: boolean;
  hasOrdersButNoRevenue?: boolean;
  hasRevenueButNoProfit?: boolean;
  onlyBranchEvidence?: boolean;
  onlySingleCompanyEvidence?: boolean;
  highHeatWithoutReality?: boolean;
  stage?: string;
}

export function detectMisclassificationWarnings(input: MisclassificationInput): MisclassificationWarning[] {
  const warnings: MisclassificationWarning[] = [];
  if (input.onlyAttention) warnings.push('attention_is_not_narrative');
  if (input.onlyPolicyNaming) warnings.push('policy_name_is_not_capital_confirmation');
  if (input.onlyPriceAction) warnings.push('price_action_is_not_pricing_adoption');
  if (input.onlyResearchReports) warnings.push('research_report_is_not_reality_validation');
  if (input.onlyStrategicPartnership) warnings.push('partnership_is_not_order');
  if (input.hasOrdersButNoRevenue) warnings.push('order_is_not_revenue');
  if (input.hasRevenueButNoProfit) warnings.push('revenue_is_not_profit');
  if (input.onlyBranchEvidence) warnings.push('branch_validation_is_not_parent_validation');
  if (input.onlySingleCompanyEvidence) warnings.push('single_company_is_not_sector_validation');
  if (input.highHeatWithoutReality) warnings.push('high_heat_is_not_high_payoff');
  if (input.stage === 'S6') warnings.push('s6_is_not_safety');
  return warnings;
}
