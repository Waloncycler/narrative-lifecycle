import { describe, expect, it } from 'vitest';
import { matchFrontierEcosystem, FRONTIER_ECOSYSTEM_REGISTRY } from '../src/features/narrative/domain/intelligent_topic_resolver';
import { AutonomousFeedbackService } from '../src/features/research/io/autonomous_feedback_service';
import type { TopicRegistry } from '../src/features/narrative/types/topic_resolution';
import { DbTopicRegistryRepository } from '../src/platform/io/db_topic_registry_repository';
import { DbAutonomousResearchRepository } from '../src/platform/io/db_autonomous_research_repository';

describe('universal intelligent resolution and self evolution', () => {
  const testCases = [
    // 1. English Academic Paper (Solid State Battery with Chemical Formula & Mechanism)
    {
      category: 'English ArXiv/Nature Paper (Material Formula)',
      text: '[2410.08921v1] High-conductivity Li10GeP2S12 (LGPS) sulfide solid electrolyte with in-situ dendrite suppression achieves 450 Wh/kg full-cell density',
      expectedTopic: 'solid_state_battery',
      expectedBranch: 'solid_state_sulfide',
    },
    // 2. Oxide Ceramic Solid State (Garnet / LLZO)
    {
      category: 'Oxide Ceramic Solid State (LLZO / LATP)',
      text: 'QuantumScape reports breakthrough in ceramic LLZO garnet separator with cold isostatic pressing (CIP) for zero-pressure lithium metal anode cells',
      expectedTopic: 'solid_state_battery',
      expectedBranch: 'solid_state_oxide',
    },
    // 3. Clinical Trial Regulatory Record (FDA NCT / BCI)
    {
      category: 'FDA / ClinicalTrials.gov Record (BCI & Neuromodulation)',
      text: 'NCT06214589: Early Feasibility Study of Synchron Stentrode Endovascular Brain-Computer Interface for Patients with Severe Quadriplegia',
      expectedTopic: 'bci',
      expectedBranch: 'bci_medical_rehab',
    },
    // 4. Low-Altitude Economy CAAC Type Certificate Official Document
    {
      category: 'Official Airworthiness Regulatory Certification (CAAC TC / eVTOL)',
      text: '中国民用航空局华东管理局向峰飞航空正式颁发V2000CG无人驾驶电动垂直起降航空器型号合格证(TC证)，标志着吨级载物eVTOL适航审定取得里程碑突破',
      expectedTopic: 'provisional_low_altitude_economy',
      expectedBranch: 'evtol_aircraft_certification',
    },
    // 5. Nuclear Fusion High-Temp Superconducting Magnet (Lawson Criterion / Q>1)
    {
      category: 'Nuclear Fusion Superconducting Magnet & Physics Milestone',
      text: 'Commonwealth Fusion Systems achieves 20 Tesla field on REBCO high-temperature superconducting magnet for SPARC tokamak Q>1 net energy demonstration',
      expectedTopic: 'provisional_nuclear_fusion_advanced_nuclear',
      expectedBranch: 'fusion_hightemp_superconducting',
    },
    // 6. Humanoid Robotics Joint Actuator & Planetary Roller Screw
    {
      category: 'Humanoid Robotics Hardware & Actuators',
      text: 'Tesla Optimus Gen-2 integrated custom planetary roller screws and 6-axis force torque tactile sensors on dexterous hands for automotive factory pilot testing',
      expectedTopic: 'humanoid_robotics',
      expectedBranch: 'humanoid_actuators_hardware',
    },
    // 7. AI Computing Infrastructure & 1.6T CPO Silicon Optics
    {
      category: 'AI Computing Infrastructure & Silicon Optics',
      text: 'Broadcom and Innolight unveil 1.6T OSFP transceivers and CPO co-packaged optics switch for 100K GPU AI computing clusters with immersion liquid cooling',
      expectedTopic: 'provisional_computing_infrastructure',
      expectedBranch: 'optical_networking_cpo',
    },
    // 8. Biotech ADC Global License-Out & Payload Mechanism
    {
      category: 'Biotech ADC Global License-Out & Payload Mechanism',
      text: 'AstraZeneca and Daiichi Sankyo announce global expansion of T-DXd topoisomerase I inhibitor ADC for pan-tumor indications with $6B commercial milestone potential',
      expectedTopic: 'provisional_antibody_drug_conjugates',
      expectedBranch: 'adc_nextgen_platforms',
    },
    // 9. Targeted Radiopharmaceuticals (Actinium / Lutetium-177)
    {
      category: 'Targeted Radiopharmaceuticals & Isotopes',
      text: 'Novartis receives FDA Fast Track designation for novel 177Lu-PSMA radiopharmaceutical targeted radioligand therapy in metastatic prostate cancer Phase 3',
      expectedTopic: 'provisional_radiopharmaceuticals',
      expectedBranch: 'radio_targeted_therapy',
    },
    // 10. Quantum Computing Superconducting Qubit Error Mitigation
    {
      category: 'Quantum Computing Error Correction',
      text: 'Google Quantum AI demonstrates surface code quantum error correction below physical error threshold on 105 superconducting physical qubits',
      expectedTopic: 'provisional_quantum_computing',
      expectedBranch: 'quantum_superconducting_hardware',
    },
    // 11. Advanced Packaging (CoWoS / Chiplet Silicon Interposer)
    {
      category: 'Semiconductor Advanced Packaging & Chiplet',
      text: 'TSMC expands CoWoS-L wafer-level advanced packaging capacity with silicon interposers and hybrid bonding for next-generation AI accelerators',
      expectedTopic: 'provisional_advanced_packaging',
      expectedBranch: 'packaging_25d_cowos',
    },
    // 12. Negative / Non-Theme Filter Check
    {
      category: 'Negative Filtering (Consumer Battery Noise)',
      text: 'Consumer smartphone maker releases budget fast-charging power bank and portable lithium accessory for standard electronics',
      expectedTopic: null,
      expectedBranch: null,
    },
  ];

  it('accurately resolves multi-lingual and multi-source technology signals', () => {
    for (const tc of testCases) {
      const result = matchFrontierEcosystem(tc.text);
      if (tc.expectedTopic === null) {
        expect(result).toBeNull();
      } else {
        expect(result?.topic_id).toBe(tc.expectedTopic);
        if (tc.expectedBranch) {
          expect(result?.branch_id).toBe(tc.expectedBranch);
        }
      }
    }
  });

  it('evaluates runs and produces an autonomous feedback report and next cycle plan', () => {
    const repoRoot = process.cwd();
    const feedbackService = new AutonomousFeedbackService(repoRoot);
    const topicRepo = new DbTopicRegistryRepository(repoRoot);
    const autoRepo = new DbAutonomousResearchRepository(repoRoot);

    const feedback = feedbackService.evaluateRun({
      runId: `test_run_${Date.now()}`,
      session: null,
      promotionReport: null,
      registry: topicRepo.readTopicRegistry(),
      operationalEvidence: autoRepo.readOperationalEvidence(),
    });

    expect(feedback.artifact_type).toBe('autonomous_feedback_report');
    expect(feedback.topic_gaps.length).toBeGreaterThan(0);
    expect(feedback.next_cycle_plan.priority_topics.length).toBeGreaterThan(0);
  });
});
