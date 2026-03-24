/**
 * Cynea AI Engine — Simulated inference layer.
 * In production this connects to Cynea's ML model endpoints.
 * For demo purposes it returns realistic engineering analysis results.
 */

function randomBetween(min, max, decimals = 1) {
  return +(Math.random() * (max - min) + min).toFixed(decimals);
}

const engines = {
  'structural-analysis': (input) => {
    const d = typeof input === 'string' ? JSON.parse(input) : input;
    const span = d.span || 10;
    const load = d.load || 30;
    const moment = +(span * span * load / 8).toFixed(1);
    const shear = +(span * load / 2).toFixed(1);
    const sf = randomBetween(1.8, 3.5);
    return {
      analysis_type: d.type || 'beam',
      max_bending_moment_kNm: moment,
      max_shear_force_kN: shear,
      max_deflection_mm: randomBetween(8, 25),
      safety_factor: sf,
      utilisation_ratio: randomBetween(0.45, 0.85),
      recommended_section: ['UB 457x191x67', 'UB 533x210x82', 'UB 356x171x51'][Math.floor(Math.random() * 3)],
      status: sf > 1.5 ? 'PASS' : 'REVIEW REQUIRED',
      notes: 'Analysis performed per Eurocode 3 (EN 1993-1-1). Self-weight included. Lateral-torsional buckling checked.',
    };
  },

  'design-optimisation': (input) => {
    const d = typeof input === 'string' ? JSON.parse(input) : input;
    return {
      original_mass_kg: randomBetween(120, 500),
      optimised_mass_kg: randomBetween(60, 300),
      mass_reduction_pct: randomBetween(18, 42),
      suggested_material: ['Aluminium 6061-T6', 'Steel S355', 'Titanium Ti-6Al-4V', 'Carbon Fibre Composite'][Math.floor(Math.random() * 4)],
      topology_iterations: Math.floor(randomBetween(150, 800, 0)),
      stress_hotspots: Math.floor(randomBetween(2, 8, 0)),
      design_variants_generated: Math.floor(randomBetween(3, 12, 0)),
      confidence: randomBetween(0.82, 0.97, 2),
      recommendation: 'Optimised geometry reduces material cost by approximately ' + randomBetween(15, 35, 0) + '% while maintaining required safety factors.',
    };
  },

  'predictive-maintenance': (input) => {
    const d = typeof input === 'string' ? JSON.parse(input) : input;
    const risk = randomBetween(0.1, 0.95, 2);
    const components = ['Main bearing', 'Gearbox assembly', 'Hydraulic seal', 'Drive motor', 'Coupling'];
    return {
      equipment_id: d.equipment || 'EQUIP-001',
      overall_health_score: +(1 - risk).toFixed(2),
      risk_score: risk,
      predicted_failure_component: components[Math.floor(Math.random() * components.length)],
      estimated_days_to_failure: Math.floor(randomBetween(5, 120, 0)),
      confidence: randomBetween(0.78, 0.96, 2),
      vibration_trend: risk > 0.6 ? 'INCREASING' : 'STABLE',
      temperature_status: risk > 0.7 ? 'ELEVATED' : 'NORMAL',
      recommended_action: risk > 0.7 ? 'Schedule immediate maintenance' : risk > 0.4 ? 'Plan maintenance within 30 days' : 'Continue monitoring',
      maintenance_priority: risk > 0.7 ? 'CRITICAL' : risk > 0.4 ? 'HIGH' : 'ROUTINE',
    };
  },

  'compliance-checker': (input) => {
    const d = typeof input === 'string' ? JSON.parse(input) : input;
    const score = randomBetween(65, 98, 0);
    const standards = ['ISO 9001:2015', 'Eurocode 2', 'ASME B31.3', 'BS 5950', 'OSHA 1926'];
    return {
      standard_checked: d.standard || standards[Math.floor(Math.random() * standards.length)],
      compliance_score: score,
      total_clauses_checked: Math.floor(randomBetween(45, 200, 0)),
      compliant_clauses: Math.floor(score * 1.5),
      non_compliant: Math.floor(randomBetween(1, 8, 0)),
      warnings: Math.floor(randomBetween(2, 12, 0)),
      critical_findings: score < 80 ? Math.floor(randomBetween(1, 3, 0)) : 0,
      top_issue: 'Section ' + randomBetween(3, 12, 0) + '.' + randomBetween(1, 8, 0) + ' — ' + ['Missing documentation', 'Calculation verification needed', 'Load combination incomplete', 'Material certification gap'][Math.floor(Math.random() * 4)],
      overall_status: score >= 90 ? 'COMPLIANT' : score >= 75 ? 'MINOR GAPS' : 'ACTION REQUIRED',
    };
  },

  'risk-analyser': (input) => {
    const d = typeof input === 'string' ? JSON.parse(input) : input;
    const risks = [
      { risk: 'Ground condition uncertainty', category: 'Technical' },
      { risk: 'Supply chain disruption', category: 'Procurement' },
      { risk: 'Regulatory approval delays', category: 'Legal' },
      { risk: 'Labour shortage', category: 'Resource' },
      { risk: 'Scope creep', category: 'Management' },
      { risk: 'Weather-related delays', category: 'Environmental' },
      { risk: 'Subcontractor performance', category: 'Resource' },
      { risk: 'Design change requests', category: 'Technical' },
    ];
    const selected = risks.sort(() => Math.random() - 0.5).slice(0, Math.floor(randomBetween(3, 6, 0)));
    return {
      project: d.project || 'Engineering Project',
      overall_risk_level: selected.length > 4 ? 'HIGH' : selected.length > 2 ? 'MEDIUM' : 'LOW',
      risk_score: randomBetween(25, 85, 0),
      risks_identified: selected.map(r => ({
        ...r,
        probability: randomBetween(0.2, 0.85, 2),
        impact: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][Math.floor(Math.random() * 4)],
      })),
      mitigation_strategies: selected.length * 2,
      cost_contingency_recommended_pct: randomBetween(5, 20, 0),
      schedule_buffer_recommended_days: Math.floor(randomBetween(10, 60, 0)),
    };
  },

  'qc-vision': (input) => ({
    inspection_id: 'QC-' + Date.now().toString(36).toUpperCase(),
    components_inspected: Math.floor(randomBetween(10, 100, 0)),
    defects_detected: Math.floor(randomBetween(0, 8, 0)),
    defect_types: ['Surface crack', 'Dimensional deviation', 'Weld porosity', 'Surface roughness'].slice(0, Math.floor(randomBetween(1, 4, 0))),
    pass_rate_pct: randomBetween(92, 100),
    confidence: randomBetween(0.91, 0.99, 2),
    resolution_dpi: 300,
    recommendation: 'Batch approved for release with minor observations noted.',
  }),

  'energy-thermal': (input) => ({
    energy_consumption_kwh: randomBetween(15000, 80000, 0),
    peak_thermal_load_kw: randomBetween(200, 1500, 0),
    efficiency_rating: randomBetween(0.72, 0.95, 2),
    annual_savings_potential_pct: randomBetween(8, 28),
    carbon_reduction_tonnes: randomBetween(12, 150),
    optimisation_opportunities: Math.floor(randomBetween(3, 10, 0)),
    payback_period_months: Math.floor(randomBetween(6, 36, 0)),
    recommendation: 'Implement variable speed drives and heat recovery system for optimal efficiency gains.',
  }),

  'document-intelligence': (input) => ({
    pages_processed: Math.floor(randomBetween(5, 200, 0)),
    entities_extracted: Math.floor(randomBetween(50, 500, 0)),
    drawings_classified: Math.floor(randomBetween(2, 50, 0)),
    tables_detected: Math.floor(randomBetween(3, 30, 0)),
    bom_items_found: Math.floor(randomBetween(10, 150, 0)),
    cross_references_validated: Math.floor(randomBetween(5, 40, 0)),
    anomalies: ['Missing revision block on Sheet 4', 'Dimension conflict between GA and detail drawings', 'Outdated standard reference (BS 449 superseded)'].slice(0, Math.floor(randomBetween(0, 3, 0))),
    confidence: randomBetween(0.88, 0.97, 2),
    processing_summary: 'Document set parsed successfully. Key data extracted and indexed.',
  }),

  'environmental-impact': (input) => ({
    carbon_footprint_tCO2e: randomBetween(500, 15000),
    embodied_carbon_kgCO2_per_m2: randomBetween(200, 800),
    lifecycle_stage_breakdown: {
      materials: randomBetween(40, 60) + '%',
      construction: randomBetween(10, 25) + '%',
      operation: randomBetween(20, 40) + '%',
      end_of_life: randomBetween(2, 8) + '%',
    },
    esg_score: randomBetween(55, 95, 0),
    regulatory_compliance: 'Meets current requirements',
    reduction_opportunities: Math.floor(randomBetween(3, 8, 0)),
    recommendation: 'Substitute ' + randomBetween(15, 30, 0) + '% of Portland cement with GGBS to reduce embodied carbon by approximately ' + randomBetween(10, 25, 0) + '%.',
  }),

  'supply-chain': (input) => ({
    suppliers_analysed: Math.floor(randomBetween(20, 100, 0)),
    avg_lead_time_days: Math.floor(randomBetween(14, 90, 0)),
    cost_optimisation_pct: randomBetween(5, 18),
    risk_score: randomBetween(0.15, 0.65, 2),
    alternative_suppliers_found: Math.floor(randomBetween(3, 15, 0)),
    inventory_recommendation: 'Increase safety stock for critical long-lead items by ' + randomBetween(10, 30, 0) + '%.',
    procurement_savings_estimate: '£' + Math.floor(randomBetween(15000, 250000, 0)).toLocaleString(),
  }),

  'piping-flow': (input) => ({
    pipe_segments_analysed: Math.floor(randomBetween(10, 80, 0)),
    total_pressure_drop_bar: randomBetween(0.5, 8.0),
    max_velocity_m_s: randomBetween(1.5, 6.0),
    reynolds_number: Math.floor(randomBetween(4000, 200000, 0)),
    flow_regime: 'Turbulent',
    recommended_pipe_size: ['DN50', 'DN80', 'DN100', 'DN150', 'DN200'][Math.floor(Math.random() * 5)],
    material_recommendation: ['Carbon Steel A106', 'Stainless 316L', 'Duplex 2205'][Math.floor(Math.random() * 3)],
    code_compliance: 'ASME B31.3 verified',
  }),

  'geotechnical': (input) => ({
    soil_classification: ['Sandy Clay (CL)', 'Silty Sand (SM)', 'Gravelly Clay (GC)', 'Lean Clay (CL)'][Math.floor(Math.random() * 4)],
    bearing_capacity_kPa: randomBetween(100, 400),
    settlement_mm: randomBetween(5, 45),
    water_table_depth_m: randomBetween(1.5, 12),
    foundation_recommendation: ['Pad foundations', 'Strip foundations', 'Piled foundations', 'Raft foundation'][Math.floor(Math.random() * 4)],
    pile_depth_m: randomBetween(8, 25),
    liquefaction_risk: ['Low', 'Moderate', 'High'][Math.floor(Math.random() * 3)],
    confidence: randomBetween(0.80, 0.95, 2),
    notes: 'Based on ' + Math.floor(randomBetween(3, 12, 0)) + ' boreholes. Additional investigation recommended for deep foundations.',
  }),
};

function runAnalysis(moduleSlug, inputData) {
  const start = Date.now();
  const engine = engines[moduleSlug];
  if (!engine) {
    return { result: { error: 'Module engine not available' }, processingTime: 0 };
  }
  const result = engine(inputData);
  const processingTime = Date.now() - start + Math.floor(Math.random() * 2000) + 500;
  return { result, processingTime };
}

module.exports = { runAnalysis };
