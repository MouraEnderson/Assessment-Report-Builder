function safeText(value, fallback = '-') {
  if (value == null || value === '') return fallback;
  if (Array.isArray(value)) return value.map((item) => safeText(item, '')).filter(Boolean).join('; ') || fallback;
  return String(value);
}

function compactArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function flattenFlowSteps(flows) {
  const steps = [];

  compactArray(flows).forEach((flow) => {
    compactArray(flow.steps).forEach((step) => {
      steps.push({
        flow_name: safeText(flow.name),
        flow_type: safeText(flow.type),
        order: safeText(step.order),
        input: safeText(step.input),
        activity: safeText(step.activity),
        responsible: safeText(step.responsible),
        output: safeText(step.output),
        system: safeText(step.system),
        area: safeText(step.area),
        issue: safeText(step.issue)
      });
    });
  });

  return steps.length ? steps : [{
    flow_name: 'Fluxo nao evidenciado',
    flow_type: 'Pendente',
    order: '-',
    input: 'Nao evidenciado no rascunho importado.',
    activity: 'Nao evidenciado no rascunho importado.',
    responsible: '-',
    output: '-',
    system: '-',
    area: '-',
    issue: 'Registrar pergunta aberta para validacao.'
  }];
}

function buildRadarRows(gapRadar) {
  const rows = compactArray(gapRadar).map((item) => {
    const score = Math.max(0, Math.min(5, Math.round(Number(item.score || 0))));

    return {
      category: safeText(item.category),
      score: safeText(score),
      level_0: score >= 0 ? 'X' : '',
      level_1: score >= 1 ? 'X' : '',
      level_2: score >= 2 ? 'X' : '',
      level_3: score >= 3 ? 'X' : '',
      level_4: score >= 4 ? 'X' : '',
      level_5: score >= 5 ? 'X' : '',
      source_gaps_text: safeText(item.source_gaps)
    };
  });

  return rows.length ? rows : [{
    category: 'Maturidade nao evidenciada',
    score: '-',
    level_0: '',
    level_1: '',
    level_2: '',
    level_3: '',
    level_4: '',
    level_5: '',
    source_gaps_text: 'Nao evidenciado no rascunho importado.'
  }];
}

function buildReportModel(assessment) {
  const source = assessment && typeof assessment === 'object' ? assessment : {};
  const client = source.client || {};
  const metadata = source.metadata || {};
  const executiveSummary = source.executive_summary || {};

  const cover = {
    title: 'Assessment de Engenharia',
    client_name: safeText(client.name, 'Cliente nao informado'),
    business_area: safeText(client.business_area, 'Area nao informada'),
    assessment_type: safeText(metadata.assessment_type, 'Assessment'),
    generated_at: safeText(metadata.updated_at || metadata.created_at, '')
  };
  const executive = {
    current_state: safeText(executiveSummary.current_state, 'Nao evidenciado no rascunho importado.'),
    main_pains: compactArray(executiveSummary.main_pains).map((pain) => safeText(pain)),
    overall_maturity: safeText(executiveSummary.overall_maturity, 'Nao avaliada'),
    evidence: safeText(executiveSummary.evidence, 'Nao evidenciado no rascunho importado.')
  };

  return {
    cover_client_name: cover.client_name,
    cover_business_area: cover.business_area,
    cover_assessment_type: cover.assessment_type,
    cover_generated_at: cover.generated_at,
    executive_current_state: executive.current_state,
    executive_main_pains: executive.main_pains,
    executive_overall_maturity: executive.overall_maturity,
    executive_evidence: executive.evidence,
    cover: {
      ...cover
    },
    executive: {
      ...executive
    },
    systems: compactArray(source.software_map).map((item) => ({
      area: safeText(item.area),
      software: safeText(item.software),
      usage: safeText(item.usage),
      pain_points_text: safeText(item.pain_points),
      opportunities_text: safeText(item.opportunities),
      evidence: safeText(item.evidence),
      confidence: safeText(item.confidence)
    })),
    processes: compactArray(source.process_map).map((item) => ({
      name: safeText(item.name),
      owner_area: safeText(item.owner_area),
      systems_text: safeText(item.systems),
      pain_points_text: safeText(item.pain_points),
      evidence: safeText(item.evidence),
      confidence: safeText(item.confidence)
    })),
    gaps: compactArray(source.gap_map).map((item) => ({
      description: safeText(item.description),
      category: safeText(item.category),
      impact: safeText(item.impact),
      recommendation: safeText(item.recommendation),
      evidence: safeText(item.evidence),
      status: safeText(item.status)
    })),
    gap_radar: buildRadarRows(source.gap_radar),
    flow_steps: flattenFlowSteps(source.flows),
    risks: compactArray(source.risks).map((item) => ({
      description: safeText(item.description),
      probability: safeText(item.probability),
      impact: safeText(item.impact),
      mitigation: safeText(item.mitigation),
      evidence: safeText(item.evidence)
    })),
    recommendations: compactArray(source.recommendations).map((item) => ({
      title: safeText(item.title),
      description: safeText(item.description),
      priority: safeText(item.priority),
      effort: safeText(item.effort),
      status: safeText(item.status)
    })),
    roadmap: compactArray(source.roadmap).map((item) => ({
      phase: safeText(item.phase),
      title: safeText(item.title),
      description: safeText(item.description),
      dependencies_text: safeText(item.dependencies)
    })),
    open_questions: compactArray(source.open_questions).map((item) => ({
      question: safeText(item.question),
      topic: safeText(item.topic),
      responsible: safeText(item.responsible),
      status: safeText(item.status)
    }))
  };
}

module.exports = {
  buildReportModel
};
