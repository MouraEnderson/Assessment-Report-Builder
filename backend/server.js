const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const Ajv2020 = require('ajv/dist/2020');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Header,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} = require('docx');

const app = express();
const port = Number(process.env.PORT || 10000);
const serviceVersion = process.env.SERVICE_VERSION || '0.4.3';
const widgetBuild = `assessment-${serviceVersion}`;
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const configuredGeminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const geminiModel = configuredGeminiModel === 'gemini-1.5-flash' ? 'gemini-2.5-flash' : configuredGeminiModel;
const maxAiInputCharacters = Number(process.env.AI_MAX_INPUT_CHARS || 60000);
const aiGenerationTimeoutMs = Number(process.env.AI_GENERATION_TIMEOUT_MS || 110000);

const frontendPath = path.resolve(__dirname, '..', 'frontend');
const schemaPath = path.resolve(__dirname, 'schemas', 'assessment.schema.json');
const assessmentSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateSchema = ajv.compile(assessmentSchema);

const allowedSourceTypes = new Set([
  'manual_text',
  'local_upload',
  'bookmark_manual',
  'official_library',
  'not_selected'
]);

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, frameguard: false }));
app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

function applyNoCacheHeaders(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

function sendFrontendFile(filename, contentType) {
  return function (req, res) {
    const absolutePath = path.join(frontendPath, filename);

    if (!fs.existsSync(absolutePath)) {
      return res.status(500).json({
        ok: false,
        error: 'FRONTEND_FILE_MISSING',
        message: `Arquivo não encontrado no container: ${filename}`
      });
    }

    applyNoCacheHeaders(res);
    res.type(contentType);
    return res.sendFile(absolutePath);
  };
}

function healthPayload() {
  return {
    ok: true,
    service: 'assessment-report-builder-backend',
    version: serviceVersion,
    build: widgetBuild,
    entrypoint: 'server.js',
    widget_runtime: '3DDashboard Additional App',
    public_entrypoint: '/',
    widget_entrypoint: 'frontend/widget.html',
    runtime: 'frontend/assets/js/assessment-runtime.js',
    css: 'frontend/assets/css/assessment.css',
    ai_max_input_characters: maxAiInputCharacters,
    ai_generation_timeout_ms: aiGenerationTimeoutMs,
    authentication_boundary: '3DEXPERIENCE session stays in frontend WAFData; Render never receives CAS/cookies/tokens',
    environment: process.env.NODE_ENV || 'development',
    schema: 'assessment.schema.json'
  };
}

function normalizeValidationErrors(errors = []) {
  return errors.map((error) => ({
    path: error.instancePath || '/',
    keyword: error.keyword,
    message: error.message || 'Erro de validação.',
    params: error.params
  }));
}

function assessmentQualityWarnings(assessment) {
  const review = assessment && assessment.quality_review && typeof assessment.quality_review === 'object'
    ? assessment.quality_review
    : null;
  const warnings = [];

  if (!review) {
    warnings.push({
      code: 'QUALITY_REVIEW_MISSING',
      message: 'quality_review ausente; execute IA V2 ou revise manualmente antes de envio oficial.',
      severity: 'warning',
      related_section: 'quality_review'
    });
    return warnings;
  }

  if (review.readiness === 'draft') {
    warnings.push({
      code: 'QUALITY_REVIEW_DRAFT',
      message: review.summary || 'Assessment marcado como rascunho; exige revisao humana.',
      severity: 'warning',
      related_section: 'quality_review'
    });
  }

  if (review.generic_content_risk === 'Alto') {
    warnings.push({
      code: 'GENERIC_CONTENT_RISK_HIGH',
      message: 'Risco alto de conteudo generico no assessment.',
      severity: 'warning',
      related_section: 'quality_review'
    });
  }

  (Array.isArray(review.warnings) ? review.warnings : []).forEach((item) => {
    warnings.push({
      code: safeText(item.code, 'QUALITY_WARNING'),
      message: safeText(item.message, 'Ponto de qualidade pendente de revisao.'),
      severity: safeText(item.severity, 'warning'),
      related_section: item.related_section || null
    });
  });

  return warnings;
}

function isAiProviderQuotaError(error) {
  const message = String(error && error.message ? error.message : '');
  return /429|quota|rate limit|too many requests|RESOURCE_EXHAUSTED/i.test(message);
}

function assessmentQualityBlockingIssues(assessment) {
  const review = assessment && assessment.quality_review && typeof assessment.quality_review === 'object'
    ? assessment.quality_review
    : null;
  const issues = [];

  if (!review) return issues;

  if (review.readiness === 'blocked') {
    issues.push({
      code: 'QUALITY_REVIEW_BLOCKED',
      message: review.summary || 'Assessment bloqueado pela revisao de qualidade.',
      severity: 'blocking',
      related_section: 'quality_review'
    });
  }

  (Array.isArray(review.blocking_issues) ? review.blocking_issues : []).forEach((item) => {
    issues.push({
      code: safeText(item.code, 'QUALITY_BLOCKING_ISSUE'),
      message: safeText(item.message, 'Bloqueio de qualidade pendente de revisao.'),
      severity: 'blocking',
      related_section: item.related_section || null
    });
  });

  return issues;
}

function validateAssessment(assessment) {
  const valid = validateSchema(assessment);
  return {
    valid: Boolean(valid),
    errors: valid ? [] : normalizeValidationErrors(validateSchema.errors),
    warnings: assessmentQualityWarnings(assessment)
  };
}

function geminiEnabled() {
  return Boolean(geminiApiKey.trim());
}

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function normalizeExtractedText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');

  if (first < 0 || last < first) {
    const error = new Error('A IA nao retornou um objeto JSON.');
    error.code = 'AI_RESPONSE_JSON_MISSING_OBJECT';
    throw error;
    throw new Error('A IA não retornou um objeto JSON.');
  }

  try {
    return JSON.parse(candidate.slice(first, last + 1));
  } catch (parseError) {
    const error = new Error('A IA retornou JSON malformado. O assessment nao foi salvo porque nao passou pelo contrato oficial.');
    error.code = 'AI_RESPONSE_JSON_INVALID';
    error.parse_message = parseError.message;
    throw error;
  }
}

function safeText(value) {
  if (value == null || value === '') return '-';
  if (Array.isArray(value)) return value.filter(Boolean).join('; ') || '-';
  return String(value);
}

const DOCX_COLORS = {
  navy: '0F172A',
  blue: '2555D9',
  blueDark: '1F3F9A',
  teal: '0F766E',
  blueLight: 'EAF0FF',
  cyanLight: 'E8F7FF',
  grayText: '475569',
  grayBorder: 'CBD5E1',
  grayFill: 'F8FAFC',
  green: 'DDF7E8',
  greenDark: '166534',
  yellow: 'FFF4CC',
  yellowDark: 'A16207',
  orange: 'FFE3C2',
  orangeDark: 'C2410C',
  red: 'FFE0E0',
  redDark: 'B91C1C',
  white: 'FFFFFF'
};

function textRun(text, options = {}) {
  return new TextRun({
    text: safeText(text),
    bold: Boolean(options.bold),
    italics: Boolean(options.italics),
    color: options.color || DOCX_COLORS.navy,
    size: options.size || 20,
    allCaps: Boolean(options.allCaps)
  });
}

function docParagraph(text, options = {}) {
  return new Paragraph({
    heading: options.heading,
    alignment: options.alignment,
    spacing: {
      before: options.before || 0,
      after: options.after == null ? 160 : options.after,
      line: options.line || 276
    },
    children: [textRun(text, options)]
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function emptyBorders() {
  const border = { style: BorderStyle.NONE, size: 0, color: DOCX_COLORS.white };
  return { top: border, bottom: border, left: border, right: border };
}

function lineBorder(color = DOCX_COLORS.grayBorder, size = 8) {
  return { style: BorderStyle.SINGLE, size, color };
}

function cardBorders(color = DOCX_COLORS.grayBorder, size = 8) {
  const border = lineBorder(color, size);
  return { top: border, bottom: border, left: border, right: border };
}

function cell(text, bold = false, options = {}) {
  return new TableCell({
    columnSpan: options.columnSpan,
    width: options.width,
    verticalAlign: options.verticalAlign || VerticalAlign.CENTER,
    shading: options.fill
      ? {
          type: ShadingType.CLEAR,
          fill: options.fill,
          color: 'auto'
      }
      : undefined,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    borders: options.noBorder ? emptyBorders() : cardBorders(options.borderColor || DOCX_COLORS.grayBorder, options.borderSize || 1),
    children: [
      new Paragraph({
        alignment: options.alignment,
        spacing: { after: 0 },
        children: [
          textRun(text, {
            bold,
            size: options.size || 18,
            color: options.color || DOCX_COLORS.navy,
            allCaps: options.allCaps
          })
        ]
      })
    ]
  });
}

function docTable(headers, rows, options = {}) {
  const safeRows = Array.isArray(rows) && rows.length ? rows : [['Sem dados estruturados.']];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: options.fixed ? TableLayoutType.FIXED : undefined,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((header) => cell(header, true, {
          fill: options.headerFill || DOCX_COLORS.blue,
          color: DOCX_COLORS.white,
          allCaps: true,
          size: 17
        }))
      }),
      ...safeRows.map((row, rowIndex) => new TableRow({
        children: row.map((value) => cell(value, false, {
          fill: rowIndex % 2 === 0 ? DOCX_COLORS.white : DOCX_COLORS.grayFill
        }))
      }))
    ]
  });
}

function mapRows(items, mapper) {
  return Array.isArray(items) && items.length ? items.map(mapper) : [];
}

function sectionTitle(number, title, subtitle) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell(number, true, {
            fill: DOCX_COLORS.blue,
            color: DOCX_COLORS.white,
            size: 24,
            alignment: AlignmentType.CENTER
          }),
          cell(title, true, {
            fill: DOCX_COLORS.blueLight,
            color: DOCX_COLORS.blueDark,
            size: 24
          })
        ]
      }),
      ...(subtitle ? [
        new TableRow({
          children: [
            cell(subtitle, false, {
              columnSpan: 2,
              fill: DOCX_COLORS.grayFill,
              color: DOCX_COLORS.grayText,
              size: 18
            })
          ]
        })
      ] : [])
    ]
  });
}

function callout(title, body, fill = DOCX_COLORS.cyanLight) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell(title, true, {
            fill,
            color: DOCX_COLORS.blueDark,
            size: 19
          }),
          cell(body, false, {
            fill,
            color: DOCX_COLORS.navy,
            size: 19
          })
        ]
      })
    ]
  });
}

function scoreColor(score) {
  const value = Number(score || 0);
  if (value >= 4) return DOCX_COLORS.red;
  if (value >= 3) return DOCX_COLORS.orange;
  if (value >= 2) return DOCX_COLORS.yellow;
  return DOCX_COLORS.green;
}

function impactFill(impact) {
  const normalized = safeText(impact).toLowerCase();
  if (normalized.includes('cr')) return DOCX_COLORS.red;
  if (normalized.includes('alto')) return DOCX_COLORS.orange;
  if (normalized.includes('m')) return DOCX_COLORS.yellow;
  return DOCX_COLORS.green;
}

function buildCover(assessment) {
  const client = assessment.client || {};
  const metadata = assessment.metadata || {};
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          children: [
            visualCell('ASSESSMENT REPORT BUILDER', ['Diagnostico de processos, sistemas, gaps e roadmap'], {
              columnSpan: 2,
              fill: DOCX_COLORS.blue,
              titleColor: DOCX_COLORS.white,
              bodyColor: DOCX_COLORS.white,
              titleSize: 22,
              bodySize: 18,
              alignment: AlignmentType.CENTER,
              borderColor: DOCX_COLORS.blue
            })
          ]
        }),
        new TableRow({
          children: [
            visualCell(textValue(client.name, 'Cliente nao informado'), [textValue(client.business_area, 'Area principal nao informada')], {
              columnSpan: 2,
              fill: DOCX_COLORS.blueLight,
              titleColor: DOCX_COLORS.blueDark,
              titleSize: 34,
              bodySize: 20,
              alignment: AlignmentType.CENTER,
              borderColor: DOCX_COLORS.blueLight
            })
          ]
        }),
        new TableRow({
          children: [
            visualCell('Escopo', [textValue(client.assessment_scope, 'Escopo pendente de revisao')], {
              fill: DOCX_COLORS.white,
              borderColor: DOCX_COLORS.grayBorder
            }),
            visualCell('Status', [
              `Geracao: ${textValue(metadata.generation_mode, 'nao informada')}`,
              `Versao: ${textValue(metadata.version, serviceVersion)}`,
              `Criado em: ${textValue(metadata.created_at, '-')}`
            ], {
              fill: DOCX_COLORS.grayFill,
              borderColor: DOCX_COLORS.grayBorder
            })
          ]
        })
      ]
    }),
    docParagraph('Documento editavel gerado a partir do assessment.json validado. Requer revisao humana antes de envio oficial.', {
      alignment: AlignmentType.CENTER,
      color: DOCX_COLORS.grayText,
      size: 18,
      before: 260
    }),
    pageBreak()
  ];
}

function buildExecutiveSnapshot(assessment) {
  const summary = assessment.executive_summary || {};
  return [
    sectionTitle('01', 'Leitura executiva', 'Resumo objetivo do contexto, maturidade percebida e dores principais.'),
    callout('Resumo do estado atual', textValue(summary.current_state, 'Resumo executivo nao identificado no rascunho.'), DOCX_COLORS.blueLight),
    visualGrid([
      { title: 'Maturidade geral', lines: [textValue(summary.overall_maturity, 'Nao avaliada')] },
      { title: 'Confianca da leitura', lines: [textValue(summary.confidence, 'Nao avaliada')] },
      { title: 'Evidencia principal', lines: [textValue(summary.evidence, 'Nao informada')] }
    ], 3, (item) => visualCell(item.title, item.lines, {
      fill: DOCX_COLORS.grayFill,
      borderColor: DOCX_COLORS.grayBorder,
      alignment: AlignmentType.CENTER
    })),
    docParagraph('Principais dores identificadas', { heading: HeadingLevel.HEADING_2, before: 220 }),
    visualGrid(compactLines(summary.main_pains, 6).map((pain, index) => ({
      title: `Dor ${index + 1}`,
      lines: [pain]
    })), 2, (item) => visualCell(item.title, item.lines, {
      fill: DOCX_COLORS.yellow,
      borderColor: DOCX_COLORS.yellowDark
    }))
  ];
}

function buildSoftwareLandscape(assessment) {
  const software = Array.isArray(assessment.software_map) ? assessment.software_map : [];
  const processes = Array.isArray(assessment.process_map) ? assessment.process_map : [];
  return [
    pageBreak(),
    sectionTitle('02', 'Mapa de softwares e processos', 'Representacao visual editavel dos sistemas, usos, integracoes e processos identificados.'),
    docParagraph('Mapa de softwares', { heading: HeadingLevel.HEADING_2 }),
    visualGrid(software, 3, (item) => visualCell(textValue(item.software, 'Software nao informado'), [
      `Area: ${textValue(item.area, 'nao informada')}`,
      `Uso: ${textValue(item.usage, 'nao informado')}`,
      `Integracoes: ${textValue(item.integrations, 'nao evidenciadas')}`,
      `Dores: ${textValue(item.pain_points, 'nao evidenciadas')}`
    ], {
      fill: DOCX_COLORS.white,
      borderColor: DOCX_COLORS.blueDark
    })),
    docParagraph('Processos identificados', { heading: HeadingLevel.HEADING_2, before: 260 }),
    visualGrid(processes, 2, (item) => visualCell(textValue(item.name, 'Processo nao informado'), [
      `Area responsavel: ${textValue(item.owner_area, 'nao informada')}`,
      `Sistemas: ${textValue(item.systems, 'nao evidenciados')}`,
      `Dores: ${textValue(item.pain_points, 'nao evidenciadas')}`,
      `Evidencia: ${textValue(item.evidence, 'nao informada')}`
    ], {
      fill: DOCX_COLORS.cyanLight,
      borderColor: DOCX_COLORS.teal
    }))
  ];
}

function buildRadarVisualRows(assessment) {
  const rows = Array.isArray(assessment.gap_radar) ? assessment.gap_radar : [];
  return rows.length ? rows : [{ category: 'Maturidade nao evidenciada', score: 0, source_gaps: [] }];
}

function buildGapAnalysis(assessment) {
  const gapCards = Array.isArray(assessment.gap_map) ? assessment.gap_map.slice(0, 8) : [];
  const radarRows = buildRadarVisualRows(assessment);
  return [
    pageBreak(),
    sectionTitle('03', 'Gaps e maturidade', 'Gaps em formato visual e radar editavel baseado na criticidade informada no assessment.'),
    docParagraph('Mapa de gaps', { heading: HeadingLevel.HEADING_2 }),
    visualGrid(gapCards, 2, (item) => visualCell(textValue(item.category, 'Gap'), [
      textValue(item.description, 'Descricao nao informada'),
      `Impacto: ${textValue(item.impact, 'nao avaliado')}`,
      `Recomendacao: ${textValue(item.recommendation, 'nao informada')}`
    ], {
      fill: impactFill(item.impact),
      borderColor: scoreColor(item.impact === 'Crítico' ? 5 : item.impact === 'Alto' ? 4 : item.impact === 'Médio' ? 3 : 2),
      bodyColor: DOCX_COLORS.navy
    })),
    docParagraph('Radar de gaps', { heading: HeadingLevel.HEADING_2, before: 260 }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          children: radarRows.slice(0, 6).map((item) => {
            const score = Math.max(0, Math.min(5, Math.round(Number(item.score || 0))));
            return visualCell(textValue(item.category, 'Categoria'), [
              `Atual: ${score}/5`,
              `Meta: 5/5`,
              `Gaps: ${textValue(item.source_gaps, 'nao informados')}`,
              `${'■'.repeat(score)}${'□'.repeat(5 - score)}`
            ], {
              fill: scoreColor(score),
              borderColor: DOCX_COLORS.blueDark,
              alignment: AlignmentType.CENTER,
              titleSize: 15,
              bodySize: 15
            });
          })
        })
      ]
    }),
    docParagraph('Premissa: este radar e editavel no Word e reflete os scores do assessment.json. O grafico Radar nativo do Office fica como proxima etapa de OOXML/chart, para evitar falso objeto nativo.', {
      color: DOCX_COLORS.grayText,
      size: 16
    })
  ];
}

function buildFlowVisual(flow) {
  const steps = Array.isArray(flow.steps) ? flow.steps : [];
  const visualSteps = steps.length ? steps : [{ order: 1, activity: 'Fluxo nao estruturado', area: '-', system: '-', input: '-', output: '-', issue: '-' }];
  const rows = [];
  for (let index = 0; index < visualSteps.length; index += 3) {
    const rowSteps = visualSteps.slice(index, index + 3);
    while (rowSteps.length < 3) rowSteps.push(null);
    rows.push(new TableRow({
      children: rowSteps.map((step) => {
        if (!step) return spacerCell();
        return visualCell(`${textValue(step.order, index + 1)}. ${textValue(step.activity, 'Atividade')}`, [
          `Area: ${textValue(step.area, '-')}`,
          `Sistema: ${textValue(step.system, '-')}`,
          `Entrada: ${textValue(step.input, '-')}`,
          `Saida: ${textValue(step.output, '-')}`,
          `Ponto critico: ${textValue(step.issue, 'nao informado')}`
        ], {
          fill: flow.type === 'TO-BE' ? DOCX_COLORS.green : DOCX_COLORS.blueLight,
          borderColor: flow.type === 'TO-BE' ? DOCX_COLORS.greenDark : DOCX_COLORS.blueDark,
          titleSize: 15,
          bodySize: 14
        });
      })
    }));
    if (index + 3 < visualSteps.length) {
      rows.push(new TableRow({
        children: [
          visualCell('continua', ['sequencia do fluxo abaixo'], {
            columnSpan: 3,
            fill: DOCX_COLORS.white,
            borderColor: DOCX_COLORS.grayBorder,
            alignment: AlignmentType.CENTER,
            titleSize: 14,
            bodySize: 14
          })
        ]
      }));
    }
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows
  });
}

function buildFlowSection(assessment) {
  const children = [
    pageBreak(),
    sectionTitle('04', 'Fluxos AS-IS e TO-BE', 'Fluxos visuais editaveis reconstruidos a partir das etapas extraidas pela IA.')
  ];
  const flows = Array.isArray(assessment.flows) ? assessment.flows : [];
  if (!flows.length) {
    children.push(visualGrid([{ title: 'Fluxos nao identificados', lines: ['O rascunho nao trouxe etapas suficientes para montar um fluxo visual.'] }], 1, (item) => visualCell(item.title, item.lines, { fill: DOCX_COLORS.grayFill, borderColor: DOCX_COLORS.grayBorder })));
    return children;
  }
  flows.forEach((flow) => {
    children.push(docParagraph(`${textValue(flow.type, 'Fluxo')} - ${textValue(flow.name, 'Sem nome')}`, { heading: HeadingLevel.HEADING_2, before: 240 }));
    children.push(callout('Evidencia do fluxo', `${textValue(flow.evidence, 'Nao informada')} | Confianca: ${textValue(flow.confidence, 'Nao avaliada')}`, flow.type === 'TO-BE' ? DOCX_COLORS.green : DOCX_COLORS.cyanLight));
    children.push(buildFlowVisual(flow));
  });
  return children;
}

function buildRecommendationsAndRoadmap(assessment) {
  const recommendations = Array.isArray(assessment.recommendations) ? assessment.recommendations : [];
  const roadmap = Array.isArray(assessment.roadmap) ? assessment.roadmap : [];
  const risks = Array.isArray(assessment.risks) ? assessment.risks : [];
  const questions = Array.isArray(assessment.open_questions) ? assessment.open_questions : [];
  return [
    pageBreak(),
    sectionTitle('05', 'Riscos, recomendacoes e roadmap', 'Priorizacao visual para transformar diagnostico em plano de execucao.'),
    docParagraph('Riscos identificados', { heading: HeadingLevel.HEADING_2 }),
    visualGrid(risks.slice(0, 6), 2, (item) => visualCell(textValue(item.description, 'Risco'), [
      `Probabilidade: ${textValue(item.probability, 'nao avaliada')}`,
      `Impacto: ${textValue(item.impact, 'nao avaliado')}`,
      `Mitigacao: ${textValue(item.mitigation, 'nao informada')}`
    ], {
      fill: impactFill(item.impact),
      borderColor: DOCX_COLORS.redDark
    })),
    docParagraph('Recomendacoes', { heading: HeadingLevel.HEADING_2, before: 260 }),
    visualGrid(recommendations.slice(0, 6), 2, (item) => visualCell(textValue(item.title, 'Recomendacao'), [
      textValue(item.description, 'Descricao nao informada'),
      `Prioridade: ${textValue(item.priority, 'nao avaliada')}`,
      `Esforco: ${textValue(item.effort, 'nao avaliado')}`,
      `Gaps relacionados: ${textValue(item.related_gaps, 'nao informados')}`
    ], {
      fill: item.priority === 'Crítica' || item.priority === 'Alta' ? DOCX_COLORS.orange : DOCX_COLORS.green,
      borderColor: item.priority === 'Crítica' || item.priority === 'Alta' ? DOCX_COLORS.orangeDark : DOCX_COLORS.greenDark
    })),
    docParagraph('Roadmap em ondas', { heading: HeadingLevel.HEADING_2, before: 260 }),
    visualGrid(roadmap, 3, (item) => visualCell(textValue(item.phase, 'Onda'), [
      textValue(item.title, 'Titulo nao informado'),
      textValue(item.description, 'Descricao nao informada'),
      `Dependencias: ${textValue(item.dependencies, 'nao informadas')}`
    ], {
      fill: DOCX_COLORS.blueLight,
      borderColor: DOCX_COLORS.blueDark,
      alignment: AlignmentType.CENTER
    })),
    ...(questions.length ? [
      docParagraph('Perguntas abertas', { heading: HeadingLevel.HEADING_2, before: 260 }),
      visualGrid(questions.slice(0, 4), 2, (item) => visualCell(textValue(item.topic, 'Pergunta'), [
        textValue(item.question, 'Pergunta nao informada'),
        `Responsavel: ${textValue(item.responsible, 'nao informado')}`,
        `Status: ${textValue(item.status, 'Aberta')}`
      ], {
        fill: DOCX_COLORS.grayFill,
        borderColor: DOCX_COLORS.grayBorder
      }))
    ] : [])
  ];
}

function buildAuditAppendix(assessment) {
  return [
    pageBreak(),
    sectionTitle('AP', 'Apendice tecnico', 'Tabelas mantidas apenas para auditoria, revisao e rastreabilidade do assessment.json.'),
    docParagraph('Softwares', { heading: HeadingLevel.HEADING_2 }),
    docTable(['Area', 'Software', 'Uso', 'Dores', 'Integracoes', 'Oportunidades'], mapRows(assessment.software_map, (item) => [
      item.area,
      item.software,
      item.usage,
      item.pain_points,
      item.integrations,
      item.opportunities
    ]), { fixed: true }),
    docParagraph('Gaps', { heading: HeadingLevel.HEADING_2 }),
    docTable(['Gap', 'Categoria', 'Impacto', 'Classificacao', 'Recomendacao', 'Status'], mapRows(assessment.gap_map, (item) => [
      item.description,
      item.category,
      item.impact,
      item.classification,
      item.recommendation,
      item.status
    ]), { fixed: true }),
    docParagraph('Controle de revisao', { heading: HeadingLevel.HEADING_2 }),
    docTable(['Secao', 'Status'], Object.entries(assessment.review_status || {}).map(([key, value]) => [key, value]), { fixed: true })
  ];
}

function buildDocxChildren(assessment) {
  return [
    ...buildCover(assessment),
    ...buildExecutiveSnapshot(assessment),
    ...buildSoftwareLandscape(assessment),
    ...buildGapAnalysis(assessment),
    ...buildFlowSection(assessment),
    ...buildRecommendationsAndRoadmap(assessment),
    ...buildAuditAppendix(assessment)
  ];
}

async function buildAssessmentDocx(assessment) {
  const client = assessment.client || {};
  const doc = new Document({
    creator: 'Assessment Report Builder',
    title: `${textValue(client.name, 'Assessment')} - Assessment`,
    description: 'Assessment visual editavel gerado a partir do assessment.json validado.',
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 }
        }
      },
      headers: {
        default: new Header({
          children: [docParagraph('Assessment Report Builder', {
            alignment: AlignmentType.RIGHT,
            color: DOCX_COLORS.grayText,
            size: 16,
            after: 0
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                textRun('Pagina ', { color: DOCX_COLORS.grayText, size: 16 }),
                new TextRun({ children: [PageNumber.CURRENT], color: DOCX_COLORS.grayText, size: 16 })
              ]
            })
          ]
        })
      },
      children: buildDocxChildren(assessment)
    }]
  });
  return Packer.toBuffer(doc);
}

function normalizeSource(source, fallbackType) {
  const safeSource = source && typeof source === 'object' ? source : {};
  const requestedType = typeof safeSource.type === 'string' ? safeSource.type : fallbackType;
  const type = allowedSourceTypes.has(requestedType) ? requestedType : fallbackType;

  return {
    type,
    filename: normalizeOptionalString(safeSource.filename),
    origin_reference: normalizeOptionalString(safeSource.origin_reference),
    received_at: type === 'not_selected' ? null : new Date().toISOString()
  };
}

function createAssessmentDraft(input) {
  const transcriptText = input.transcript_text.trim();
  const now = new Date().toISOString();
  const client = input.client && typeof input.client === 'object' ? input.client : {};
  const wordCount = countWords(transcriptText);

  return {
    metadata: {
      assessment_id: `ASSESS-${Date.now()}`,
      version: '0.1',
      status: 'draft',
      assessment_type: input.assessment_type || 'plm_assessment',
      generation_mode: input.generation_mode || 'consultivo',
      created_at: now,
      updated_at: now
    },
    client: {
      name: normalizeOptionalString(client.name),
      business_area: normalizeOptionalString(client.business_area),
      assessment_scope: null,
      participants: []
    },
    input_sources: {
      transcript: normalizeSource(input.transcript_source, 'manual_text'),
      template: normalizeSource(input.template_source, 'not_selected')
    },
    executive_summary: {
      current_state: null,
      main_pains: [],
      overall_maturity: null,
      evidence: null,
      confidence: 'Não avaliada'
    },
    meeting_summary: {
      raw_length: transcriptText.length,
      word_count: wordCount,
      note: 'Estrutura inicial criada sem conclusões automáticas.',
      raw_excerpt: transcriptText.slice(0, 500)
    },
    software_map: [],
    process_map: [],
    gap_map: [],
    gap_radar: [],
    flows: [],
    risks: [],
    recommendations: [],
    roadmap: [],
    report_model: normalizeReportModel({}),
    quality_review: normalizeQualityReview({
      readiness: 'draft',
      score: 0,
      summary: 'Contrato IA V2 inicial criado sem analise consultiva automatica.',
      warnings: [{
        code: 'AI_V2_NOT_GENERATED',
        message: 'Report model consultivo ainda nao foi gerado.',
        severity: 'warning',
        related_section: 'report_model'
      }],
      evidence_gaps: ['Executar Prompt V2 para gerar analise consultiva baseada em evidencia.'],
      generic_content_risk: 'NÃ£o avaliado',
      required_human_review: true
    }),
    open_questions: [],
    appendix: {
      transcript_processing_status: 'received',
      ai_extraction_status: 'not_implemented'
    },
    review_status: {
      executive_summary: 'Pendente',
      software_map: 'Pendente',
      gap_map: 'Pendente',
      flows: 'Pendente',
      recommendations: 'Pendente'
    }
  };
}

function buildAssessmentPrompt(input) {
  const client = input.client && typeof input.client === 'object' ? input.client : {};
  const transcriptText = normalizeExtractedText(input.transcript_text).slice(0, maxAiInputCharacters);

  return [
    'Você é um consultor sênior de PLM, engenharia de produto, processos, sistemas e 3DEXPERIENCE.',
    'Sua tarefa é transformar o conteúdo de um assessment em um assessment.json estritamente válido.',
    '',
    'Regras obrigatórias:',
    '- Responda somente com JSON válido, sem markdown e sem explicações fora do JSON.',
    '- Use exatamente o contrato descrito abaixo; não adicione propriedades fora do schema.',
    '- Não invente fatos. Quando inferir algo, registre como hipótese ou confiança menor.',
    '- O documento importado é a única fonte de verdade. Não reutilize narrativa, tecnologias, fluxos, produtos ou nomes de clientes de exemplos anteriores.',
    '- Não inclua termos técnicos específicos, softwares, produtos, siglas ou processos que não apareçam no conteúdo importado, exceto como pergunta aberta.',
    '- Cada item em software_map, process_map, gap_map, flows e risks deve ter evidence baseado em trecho ou síntese fiel do documento importado.',
    '- Se o rascunho for genérico ou incompleto, gere menos itens com maior fidelidade em vez de preencher listas com suposições.',
    '- Separe fatos observados de hipóteses: use classification=Fato somente quando houver evidência clara; caso contrário use Hipótese ou Pendência.',
    '- Toda recomendação deve estar ligada a evidência, gap ou risco quando possível.',
    '- Se faltar informação, use null, arrays vazios ou open_questions.',
    '- Todos os textos devem ficar em português do Brasil.',
    '- O campo review_status deve iniciar como Pendente.',
    '',
    'Enums importantes:',
    '- confidence: Baixa, Média, Alta, Não avaliada.',
    '- reviewState: Pendente, Revisado, Aprovado, Rejeitado, Regenerar.',
    '- gap classification: Fato, Hipótese, Pendência.',
    '- flow type: AS-IS ou TO-BE.',
    '',
    'Cliente informado:',
    JSON.stringify({
      name: normalizeOptionalString(client.name),
      business_area: normalizeOptionalString(client.business_area),
      assessment_type: input.assessment_type || 'plm_assessment',
      generation_mode: input.generation_mode || 'consultivo',
      transcript_source: input.transcript_source || { type: 'local_upload' },
      template_source: input.template_source || { type: 'not_selected' }
    }, null, 2),
    '',
    'Schema JSON oficial:',
    JSON.stringify(assessmentSchema),
    '',
    'Conteúdo importado do assessment:',
    transcriptText
  ].join('\n');
}

function buildAssessmentPromptV2(input) {
  const client = input.client && typeof input.client === 'object' ? input.client : {};
  const transcriptText = normalizeExtractedText(input.transcript_text).slice(0, maxAiInputCharacters);

  return [
    'Voce e um consultor senior de PLM, engenharia de produto, processos, sistemas, integracoes e 3DEXPERIENCE.',
    'Prompt: IA V2 consultiva.',
    'Sua tarefa e transformar o conteudo de um assessment em um assessment.json estritamente valido e consultivo.',
    'Nao seja apenas um parser: gere diagnostico, narrativa, relacoes, fluxos, roadmap e revisao de qualidade quando houver evidencia.',
    '',
    'Regras obrigatorias:',
    '- Responda somente com JSON valido, sem markdown e sem explicacoes fora do JSON.',
    '- Use exatamente o contrato descrito abaixo; nao adicione propriedades fora do schema.',
    '- Nao invente fatos. Quando inferir algo, registre como hipotese ou confianca menor.',
    '- O documento importado e a unica fonte de verdade. Nao reutilize narrativa, tecnologias, fluxos, produtos ou nomes de clientes de exemplos anteriores.',
    '- Nao inclua termos tecnicos especificos, softwares, produtos, siglas ou processos que nao aparecam no conteudo importado, exceto como pergunta aberta.',
    '- Cada item em software_map, process_map, gap_map, flows e risks deve ter evidence baseado em trecho ou sintese fiel do documento importado.',
    '- Se o rascunho for generico ou incompleto, gere menos itens com maior fidelidade em vez de preencher listas com suposicoes.',
    '- Separe fatos observados de hipoteses: use classification=Fato somente quando houver evidencia clara; caso contrario use Hipotese ou Pendencia.',
    '- Toda recomendacao deve estar ligada a evidencia, gap ou risco quando possivel.',
    '- Se faltar informacao, use null, arrays vazios ou open_questions.',
    '- Todos os textos devem ficar em portugues do Brasil.',
    '- O campo review_status deve iniciar como Pendente.',
    '- Preencha report_model sempre que o conteudo permitir; ele deve orientar o relatorio final, nao repetir apenas listas.',
    '- Preencha quality_review avaliando se o resultado esta pronto, fraco, generico ou bloqueado por falta de evidencia.',
    '- Se o rascunho nao sustentar um relatorio confiavel, defina quality_review.readiness como blocked ou draft e explique o motivo.',
    '',
    'Enums importantes:',
    '- confidence: Baixa, Media, Alta, Nao avaliada.',
    '- reviewState: Pendente, Revisado, Aprovado, Rejeitado, Regenerar.',
    '- gap classification: Fato, Hipotese, Pendencia.',
    '- flow type: AS-IS ou TO-BE.',
    '- quality readiness: blocked, draft, review_ready.',
    '- quality severity: info, warning, blocking.',
    '- Limites obrigatorios de volume para manter JSON valido:',
    '  - software_map: maximo 8 itens.',
    '  - process_map: maximo 8 itens.',
    '  - gap_map: maximo 10 itens.',
    '  - risks: maximo 8 itens.',
    '  - recommendations: maximo 10 itens.',
    '  - roadmap: maximo 6 ondas.',
    '  - report_model.software_network.nodes: maximo 10 nodes.',
    '  - report_model.software_network.links: maximo 12 links.',
    '  - report_model.process_flows: maximo 4 fluxos, maximo 8 passos por fluxo.',
    '  - report_model.gap_analysis: maximo 10 gaps.',
    '  - report_model.maturity_radar: maximo 8 categorias.',
    '  - Textos narrativos devem ser objetivos; nao gere texto longo quando um paragrafo curto resolve.',
    '',
    'Tarefas consultivas obrigatorias:',
    '1. Extracao fiel: identifique cliente, contexto, sistemas, processos, dores, riscos, evidencias e lacunas.',
    '2. Diagnostico: conecte sistemas, processos, gaps e riscos; diferencie causa, sintoma e impacto.',
    '3. Mapas: gere software_network com nodes e links quando houver troca de dados, handoff, integracao, decisao manual ou controle paralelo.',
    '4. Fluxos: gere process_flows com passos AS-IS e, quando sustentado, TO-BE; cada passo deve ter ordem, rotulo, detalhe, sistema e responsavel quando evidenciados.',
    '5. Gaps: gere gap_analysis explicando impacto e recomendacao conectada ao gap.',
    '6. Radar: gere maturity_radar com score, target e justificativa por categoria.',
    '7. Roadmap: gere roadmap_waves conectadas a recomendacoes, dependencias e resultados esperados.',
    '8. Perguntas abertas: quando faltar informacao, gere perguntas objetivas para validacao humana.',
    '9. Qualidade: gere quality_review com score de 0 a 100, warnings, blocking_issues e evidence_gaps.',
    '',
    'Regras para report_model:',
    '- executive_narrative deve ser texto executivo pronto para relatorio, baseado no documento importado.',
    '- section_narratives deve conter narrativas por secao, com evidence_refs e confidence.',
    '- software_network.nodes deve representar sistemas, areas, repositorios ou controles citados.',
    '- software_network.links deve representar relacoes entre nodes; nao crie link se nao houver evidencia ou hipotese declarada.',
    '- process_flows deve complementar flows; use narrativa e passos prontos para desenho no Word.',
    '- recommendation_logic deve explicar por que cada recomendacao existe e qual resultado esperado.',
    '- quality_notes deve listar observacoes tecnicas uteis para revisao humana.',
    '',
    'Regras para quality_review:',
    '- readiness=review_ready somente quando houver evidencia suficiente para resumo, gaps, fluxos/relacoes e roadmap.',
    '- readiness=draft quando o resultado e util mas ainda exige validacao humana relevante.',
    '- readiness=blocked quando falta informacao essencial ou o texto importado e generico demais.',
    '- generic_content_risk deve ser Alto se o relatorio parecer generico ou aplicavel a qualquer cliente.',
    '- blocking_issues deve listar problemas que impedem exportacao confiavel.',
    '- warnings deve listar fragilidades que nao bloqueiam, mas exigem atencao.',
    '- evidence_gaps deve listar exatamente quais evidencias faltaram.',
    '',
    'Cliente informado:',
    JSON.stringify({
      name: normalizeOptionalString(client.name),
      business_area: normalizeOptionalString(client.business_area),
      assessment_type: input.assessment_type || 'plm_assessment',
      generation_mode: input.generation_mode || 'consultivo',
      transcript_source: input.transcript_source || { type: 'local_upload' },
      template_source: input.template_source || { type: 'not_selected' }
    }, null, 2),
    '',
    'Schema JSON oficial:',
    JSON.stringify(assessmentSchema),
    '',
    'Conteudo importado do assessment:',
    transcriptText
  ].join('\n');
}

function normalizeAccentless(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeEnum(value, allowedValues, fallback) {
  const normalizedValue = normalizeAccentless(value);
  const exact = allowedValues.find((allowed) => String(allowed) === String(value));
  if (exact) return exact;

  return allowedValues.find((allowed) => normalizeAccentless(allowed) === normalizedValue) || fallback;
}

function schemaEnum(path, fallbackValues) {
  const values = path.reduce((current, key) => (current && current[key] != null ? current[key] : null), assessmentSchema);
  return Array.isArray(values) && values.length ? values : fallbackValues;
}

function nullableText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function requiredText(value, fallback) {
  return nullableText(value) || fallback;
}

function stringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item == null) return null;
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        return nullableText(item);
      }
      if (typeof item === 'object') {
        return nullableText(item.id || item.title || item.name || item.description || item.question || item.category);
      }
      return null;
    }).filter(Boolean);
  }

  if (value == null || value === '') {
    return [];
  }

  return String(value)
    .split(/\r?\n|;|\u2022/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function objectArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : [];
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function boundedScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(5, number));
}

function normalizeConfidence(value) {
  const allowedValues = schemaEnum(['$defs', 'confidence', 'enum'], ['Baixa', 'Média', 'Alta', 'Não avaliada']);
  return normalizeEnum(value, allowedValues, allowedValues[allowedValues.length - 1]);
}

function normalizeReviewState(value) {
  const allowedValues = schemaEnum(['$defs', 'reviewState', 'enum'], ['Pendente', 'Revisado', 'Aprovado', 'Rejeitado', 'Regenerar']);
  return normalizeEnum(value, allowedValues, 'Pendente');
}

function normalizeImpact(value) {
  const allowedValues = schemaEnum(['$defs', 'impactLevel', 'enum'], ['Baixo', 'Médio', 'Alto', 'Crítico', 'Não avaliado']);
  return normalizeEnum(value, allowedValues, allowedValues[allowedValues.length - 1]);
}

function normalizePriority(value) {
  const allowedValues = schemaEnum(['$defs', 'recommendationItem', 'properties', 'priority', 'enum'], ['Baixa', 'Média', 'Alta', 'Crítica', 'Não avaliada']);
  return normalizeEnum(value, allowedValues, allowedValues[allowedValues.length - 1]);
}

function normalizeEffort(value) {
  const allowedValues = schemaEnum(['$defs', 'recommendationItem', 'properties', 'effort', 'enum'], ['Baixo', 'Médio', 'Alto', 'Não avaliado']);
  return normalizeEnum(value, allowedValues, allowedValues[allowedValues.length - 1]);
}

function normalizeClassification(value) {
  const allowedValues = schemaEnum(['$defs', 'gapItem', 'properties', 'classification', 'enum'], ['Fato', 'Hipótese', 'Pendência']);
  return normalizeEnum(value, allowedValues, allowedValues[allowedValues.length - 1]);
}

function normalizeGenerationMode(value) {
  return normalizeEnum(value, ['conservador', 'consultivo', 'executivo'], 'consultivo');
}

function normalizeFlowType(value) {
  const normalized = normalizeAccentless(value);
  if (normalized.includes('to')) return 'TO-BE';
  return 'AS-IS';
}

function normalizeOpenQuestionStatus(value) {
  const allowedValues = schemaEnum(['$defs', 'openQuestionItem', 'properties', 'status', 'enum'], ['Aberta', 'Respondida', 'Descartada']);
  return normalizeEnum(value, allowedValues, 'Aberta');
}

function normalizeQualityReadiness(value) {
  const allowedValues = schemaEnum(['$defs', 'qualityReview', 'properties', 'readiness', 'enum'], ['blocked', 'draft', 'review_ready']);
  return normalizeEnum(value, allowedValues, 'draft');
}

function normalizeQualitySeverity(value) {
  const allowedValues = schemaEnum(['$defs', 'qualityIssue', 'properties', 'severity', 'enum'], ['info', 'warning', 'blocking']);
  return normalizeEnum(value, allowedValues, 'warning');
}

function normalizeGenericContentRisk(value) {
  const allowedValues = schemaEnum(['$defs', 'qualityReview', 'properties', 'generic_content_risk', 'enum'], ['Baixo', 'Médio', 'Alto', 'Não avaliado']);
  return normalizeEnum(value, allowedValues, allowedValues[allowedValues.length - 1]);
}

function normalizeReportModel(rawReportModel) {
  const model = plainObject(rawReportModel);
  const softwareNetwork = plainObject(model.software_network);

  return {
    executive_narrative: nullableText(model.executive_narrative),
    section_narratives: objectArray(model.section_narratives).map((item, index) => ({
      section_id: requiredText(item.section_id, `section_${index + 1}`),
      title: nullableText(item.title),
      narrative: nullableText(item.narrative),
      evidence_refs: stringArray(item.evidence_refs),
      confidence: normalizeConfidence(item.confidence)
    })),
    software_network: {
      nodes: objectArray(softwareNetwork.nodes).map((item, index) => ({
        id: requiredText(item.id, `node_${index + 1}`),
        label: nullableText(item.label),
        type: nullableText(item.type),
        description: nullableText(item.description),
        evidence_refs: stringArray(item.evidence_refs)
      })),
      links: objectArray(softwareNetwork.links).map((item, index) => ({
        source: requiredText(item.source, `source_${index + 1}`),
        target: requiredText(item.target, `target_${index + 1}`),
        label: nullableText(item.label),
        type: nullableText(item.type),
        evidence_refs: stringArray(item.evidence_refs)
      })),
      narrative: nullableText(softwareNetwork.narrative)
    },
    process_flows: objectArray(model.process_flows).map((flow, flowIndex) => ({
      id: requiredText(flow.id, `report_flow_${flowIndex + 1}`),
      title: nullableText(flow.title),
      type: normalizeFlowType(flow.type),
      narrative: nullableText(flow.narrative),
      steps: objectArray(flow.steps).map((step, stepIndex) => ({
        order: positiveInteger(step.order, stepIndex + 1),
        label: nullableText(step.label),
        detail: nullableText(step.detail),
        system: nullableText(step.system),
        responsible: nullableText(step.responsible),
        evidence_refs: stringArray(step.evidence_refs)
      })),
      evidence_refs: stringArray(flow.evidence_refs),
      confidence: normalizeConfidence(flow.confidence)
    })),
    gap_analysis: objectArray(model.gap_analysis).map((item, index) => ({
      gap_id: requiredText(item.gap_id, `gap_${index + 1}`),
      title: nullableText(item.title),
      analysis: nullableText(item.analysis),
      impact: normalizeImpact(item.impact),
      recommendation: nullableText(item.recommendation),
      evidence_refs: stringArray(item.evidence_refs),
      confidence: normalizeConfidence(item.confidence)
    })),
    risk_map: objectArray(model.risk_map).map((item, index) => ({
      risk_id: requiredText(item.risk_id, `risk_${index + 1}`),
      title: nullableText(item.title),
      description: nullableText(item.description),
      mitigation: nullableText(item.mitigation),
      evidence_refs: stringArray(item.evidence_refs),
      confidence: normalizeConfidence(item.confidence)
    })),
    maturity_radar: objectArray(model.maturity_radar).map((item, index) => ({
      category: requiredText(item.category, `Categoria ${index + 1}`),
      score: boundedScore(item.score),
      target: boundedScore(item.target == null ? 5 : item.target),
      justification: nullableText(item.justification),
      evidence_refs: stringArray(item.evidence_refs)
    })),
    recommendation_logic: objectArray(model.recommendation_logic).map((item, index) => ({
      recommendation_id: requiredText(item.recommendation_id, `recommendation_${index + 1}`),
      title: nullableText(item.title),
      rationale: nullableText(item.rationale),
      related_gaps: stringArray(item.related_gaps),
      expected_outcome: nullableText(item.expected_outcome),
      evidence_refs: stringArray(item.evidence_refs)
    })),
    roadmap_waves: objectArray(model.roadmap_waves).map((item, index) => ({
      wave_id: requiredText(item.wave_id, `wave_${index + 1}`),
      title: nullableText(item.title),
      objective: nullableText(item.objective),
      actions: stringArray(item.actions),
      dependencies: stringArray(item.dependencies),
      related_recommendations: stringArray(item.related_recommendations)
    })),
    open_questions: objectArray(model.open_questions).map((item) => ({
      question: requiredText(item.question, 'Pergunta pendente de detalhamento.'),
      reason: nullableText(item.reason),
      target_area: nullableText(item.target_area)
    })),
    quality_notes: stringArray(model.quality_notes)
  };
}

function normalizeQualityIssue(item, fallbackCode) {
  const source = plainObject(item);
  return {
    code: requiredText(source.code, fallbackCode),
    message: requiredText(source.message, 'Ponto de qualidade pendente de revisao.'),
    severity: normalizeQualitySeverity(source.severity),
    related_section: nullableText(source.related_section)
  };
}

function normalizeQualityReview(rawQualityReview) {
  const review = plainObject(rawQualityReview);

  return {
    readiness: normalizeQualityReadiness(review.readiness),
    score: boundedInteger(review.score, 0, 0, 100),
    summary: nullableText(review.summary),
    blocking_issues: objectArray(review.blocking_issues).map((item, index) => (
      normalizeQualityIssue(item, `blocking_${index + 1}`)
    )),
    warnings: objectArray(review.warnings).map((item, index) => (
      normalizeQualityIssue(item, `warning_${index + 1}`)
    )),
    evidence_gaps: stringArray(review.evidence_gaps),
    generic_content_risk: normalizeGenericContentRisk(review.generic_content_risk),
    required_human_review: typeof review.required_human_review === 'boolean' ? review.required_human_review : true
  };
}

function normalizeAiAssessment(rawAssessment, input) {
  const raw = rawAssessment && typeof rawAssessment === 'object' && !Array.isArray(rawAssessment) ? rawAssessment : {};
  const now = new Date().toISOString();
  const clientInput = input.client && typeof input.client === 'object' ? input.client : {};
  const metadata = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};
  const client = raw.client && typeof raw.client === 'object' ? raw.client : {};
  const summary = raw.executive_summary && typeof raw.executive_summary === 'object' ? raw.executive_summary : {};
  const meetingSummary = raw.meeting_summary && typeof raw.meeting_summary === 'object' ? raw.meeting_summary : {};
  const appendix = raw.appendix && typeof raw.appendix === 'object' && !Array.isArray(raw.appendix) ? raw.appendix : {};
  const transcriptText = String(input.transcript_text || '');

  return {
    metadata: {
      assessment_id: requiredText(metadata.assessment_id, `ASSESS-${Date.now()}`),
      version: requiredText(metadata.version, '0.1'),
      status: 'draft',
      assessment_type: requiredText(input.assessment_type || metadata.assessment_type, 'plm_assessment'),
      generation_mode: normalizeGenerationMode(input.generation_mode || metadata.generation_mode),
      created_at: requiredText(metadata.created_at, now),
      updated_at: now
    },
    client: {
      name: nullableText(client.name) || nullableText(clientInput.name),
      business_area: nullableText(client.business_area) || nullableText(clientInput.business_area),
      assessment_scope: nullableText(client.assessment_scope),
      participants: stringArray(client.participants)
    },
    input_sources: {
      transcript: normalizeSource(input.transcript_source, 'local_upload'),
      template: normalizeSource(input.template_source, 'not_selected')
    },
    executive_summary: {
      current_state: nullableText(summary.current_state),
      main_pains: stringArray(summary.main_pains),
      overall_maturity: nullableText(summary.overall_maturity),
      evidence: nullableText(summary.evidence),
      confidence: normalizeConfidence(summary.confidence)
    },
    meeting_summary: {
      raw_length: transcriptText.trim().length,
      word_count: countWords(transcriptText),
      note: requiredText(meetingSummary.note, 'Assessment estruturado por IA a partir de documento importado, pendente de revisão humana.'),
      raw_excerpt: nullableText(meetingSummary.raw_excerpt) || transcriptText.trim().slice(0, 500)
    },
    software_map: objectArray(raw.software_map).map((item, index) => ({
      id: requiredText(item.id, `software_${index + 1}`),
      area: nullableText(item.area),
      software: nullableText(item.software),
      usage: nullableText(item.usage),
      pain_points: stringArray(item.pain_points),
      integrations: stringArray(item.integrations),
      risks: stringArray(item.risks),
      opportunities: stringArray(item.opportunities),
      evidence: nullableText(item.evidence),
      confidence: normalizeConfidence(item.confidence)
    })),
    process_map: objectArray(raw.process_map).map((item, index) => ({
      id: requiredText(item.id, `process_${index + 1}`),
      name: nullableText(item.name),
      owner_area: nullableText(item.owner_area),
      systems: stringArray(item.systems),
      pain_points: stringArray(item.pain_points),
      evidence: nullableText(item.evidence),
      confidence: normalizeConfidence(item.confidence)
    })),
    gap_map: objectArray(raw.gap_map).map((item, index) => ({
      id: requiredText(item.id, `gap_${index + 1}`),
      description: nullableText(item.description),
      category: nullableText(item.category),
      impact: normalizeImpact(item.impact),
      evidence: nullableText(item.evidence),
      confidence: normalizeConfidence(item.confidence),
      classification: normalizeClassification(item.classification),
      recommendation: nullableText(item.recommendation),
      status: normalizeReviewState(item.status)
    })),
    gap_radar: objectArray(raw.gap_radar).map((item) => ({
      category: requiredText(item.category, 'Não categorizado'),
      score: boundedScore(item.score),
      source_gaps: stringArray(item.source_gaps)
    })),
    flows: objectArray(raw.flows).map((flow, flowIndex) => ({
      id: requiredText(flow.id, `flow_${flowIndex + 1}`),
      name: nullableText(flow.name),
      type: normalizeFlowType(flow.type),
      steps: objectArray(flow.steps).map((step, stepIndex) => ({
        order: positiveInteger(step.order, stepIndex + 1),
        area: nullableText(step.area),
        activity: nullableText(step.activity),
        system: nullableText(step.system),
        input: nullableText(step.input),
        output: nullableText(step.output),
        responsible: nullableText(step.responsible),
        issue: nullableText(step.issue)
      })),
      issues: stringArray(flow.issues),
      evidence: nullableText(flow.evidence),
      confidence: normalizeConfidence(flow.confidence)
    })),
    risks: objectArray(raw.risks).map((item, index) => ({
      id: requiredText(item.id, `risk_${index + 1}`),
      description: nullableText(item.description),
      probability: normalizeConfidence(item.probability),
      impact: normalizeImpact(item.impact),
      mitigation: nullableText(item.mitigation),
      evidence: nullableText(item.evidence),
      confidence: normalizeConfidence(item.confidence)
    })),
    recommendations: objectArray(raw.recommendations).map((item, index) => ({
      id: requiredText(item.id, `recommendation_${index + 1}`),
      title: nullableText(item.title),
      description: nullableText(item.description),
      priority: normalizePriority(item.priority),
      effort: normalizeEffort(item.effort),
      related_gaps: stringArray(item.related_gaps),
      status: normalizeReviewState(item.status)
    })),
    roadmap: objectArray(raw.roadmap).map((item, index) => ({
      id: requiredText(item.id, `roadmap_${index + 1}`),
      phase: nullableText(item.phase),
      title: nullableText(item.title),
      description: nullableText(item.description),
      dependencies: stringArray(item.dependencies),
      related_recommendations: stringArray(item.related_recommendations)
    })),
    report_model: normalizeReportModel(raw.report_model),
    quality_review: normalizeQualityReview(raw.quality_review),
    open_questions: objectArray(raw.open_questions).map((item, index) => ({
      id: requiredText(item.id, `question_${index + 1}`),
      question: requiredText(item.question, 'Pergunta pendente de detalhamento.'),
      topic: nullableText(item.topic),
      responsible: nullableText(item.responsible),
      status: normalizeOpenQuestionStatus(item.status)
    })),
    appendix: {
      ...appendix,
      transcript_processing_status: 'received',
      ai_extraction_status: 'generated',
      ai_provider: 'gemini',
      ai_model: geminiModel,
      ai_prompt_version: 'v2-consultative-report-model',
      ai_generated_at: now,
      schema_repair_status: 'normalized'
    },
    review_status: {
      executive_summary: normalizeReviewState(raw.review_status && raw.review_status.executive_summary),
      software_map: normalizeReviewState(raw.review_status && raw.review_status.software_map),
      gap_map: normalizeReviewState(raw.review_status && raw.review_status.gap_map),
      flows: normalizeReviewState(raw.review_status && raw.review_status.flows),
      recommendations: normalizeReviewState(raw.review_status && raw.review_status.recommendations)
    }
  };
}

function createGeminiModel() {
  return new GoogleGenerativeAI(geminiApiKey).getGenerativeModel({
    model: geminiModel,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  });
}

function textValue(value, fallback = '-') {
  if (value == null || value === '') return fallback;
  if (Array.isArray(value)) {
    const values = value.map((item) => textValue(item, '')).filter(Boolean);
    return values.length ? values.join('; ') : fallback;
  }
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function listValues(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => textValue(item, '')).filter(Boolean);
}

function paragraphRun(text, options = {}) {
  return new Paragraph({
    alignment: options.alignment,
    spacing: { before: options.before || 0, after: options.after == null ? 70 : options.after, line: options.line || 240 },
    children: [
      textRun(text, {
        bold: options.bold,
        italics: options.italics,
        color: options.color || DOCX_COLORS.navy,
        size: options.size || 18,
        allCaps: options.allCaps
      })
    ]
  });
}

function visualCell(title, lines = [], options = {}) {
  const bodyLines = Array.isArray(lines) ? lines : [lines];
  const cleanLines = bodyLines.map((line) => textValue(line, '')).filter(Boolean);
  return new TableCell({
    columnSpan: options.columnSpan,
    width: options.width,
    verticalAlign: options.verticalAlign || VerticalAlign.CENTER,
    shading: {
      type: ShadingType.CLEAR,
      fill: options.fill || DOCX_COLORS.white,
      color: 'auto'
    },
    margins: {
      top: options.marginTop || 170,
      bottom: options.marginBottom || 170,
      left: options.marginLeft || 170,
      right: options.marginRight || 170
    },
    borders: options.noBorder ? emptyBorders() : cardBorders(options.borderColor || DOCX_COLORS.blueDark, options.borderSize || 8),
    children: [
      paragraphRun(title, {
        bold: true,
        color: options.titleColor || DOCX_COLORS.navy,
        size: options.titleSize || 17,
        alignment: options.alignment,
        after: cleanLines.length ? 70 : 0
      }),
      ...cleanLines.map((line) => paragraphRun(line, {
        color: options.bodyColor || DOCX_COLORS.grayText,
        size: options.bodySize || 16,
        alignment: options.alignment,
        after: 45
      }))
    ]
  });
}

function spacerCell() {
  return visualCell('', [], { noBorder: true, fill: DOCX_COLORS.white });
}

function visualGrid(items, columns, renderer) {
  const rows = [];
  const source = Array.isArray(items) && items.length ? items : [];
  for (let index = 0; index < source.length; index += columns) {
    const rowItems = source.slice(index, index + columns);
    while (rowItems.length < columns) rowItems.push(null);
    rows.push(new TableRow({
      children: rowItems.map((item, offset) => (item ? renderer(item, index + offset) : spacerCell()))
    }));
  }
  if (!rows.length) {
    rows.push(new TableRow({ children: [visualCell('Sem dados estruturados', ['A IA nao identificou informacoes suficientes para esta visao.'], { columnSpan: columns, fill: DOCX_COLORS.grayFill, borderColor: DOCX_COLORS.grayBorder })] }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows
  });
}

function compactLines(values, max = 3) {
  const lines = listValues(values).slice(0, max);
  return lines.length ? lines : ['Nao evidenciado no rascunho'];
}

async function generateGeminiJson(model, prompt) {
  try {
    const result = await model.generateContent(prompt, { timeout: aiGenerationTimeoutMs });
    const response = result.response;
    return extractJsonObject(response.text());
  } catch (error) {
    if (!error.code) {
      error.code = 'AI_PROVIDER_CALL_FAILED';
    }
    throw error;
  }
}

async function createAssessmentWithGemini(input) {
  const model = createGeminiModel();
  try {
    return normalizeAiAssessment(await generateGeminiJson(model, buildAssessmentPromptV2(input)), input);
  } catch (error) {
    error.ai_phase = error.ai_phase || 'single_call_assessment';
    throw error;
  }
}

app.get('/', sendFrontendFile('widget.html', 'html'));
app.get('/index.html', sendFrontendFile('widget.html', 'html'));
app.get('/widget.html', sendFrontendFile('widget.html', 'html'));
app.get('/assets/css/assessment.css', sendFrontendFile(path.join('assets', 'css', 'assessment.css'), 'css'));
app.get('/assets/js/assessment-runtime.js', sendFrontendFile(path.join('assets', 'js', 'assessment-runtime.js'), 'application/javascript'));

app.get('/health', (req, res) => {
  res.status(200).json(healthPayload());
});

app.get('/api/health', (req, res) => {
  res.status(200).json(healthPayload());
});

app.get('/version', (req, res) => {
  res.status(200).json(healthPayload());
});

app.get('/api/assessment/schema', (req, res) => {
  res.status(200).json({ ok: true, schema: assessmentSchema });
});

app.post('/api/assessment/import-docx', async (req, res) => {
  const input = req.body || {};
  const filename = normalizeOptionalString(input.filename);
  const source = input.source && typeof input.source === 'object' ? input.source : {};
  const sourceType = allowedSourceTypes.has(source.type) ? source.type : 'local_upload';
  const contentBase64 = typeof input.content_base64 === 'string' ? input.content_base64 : '';

  if (!filename || !filename.toLowerCase().endsWith('.docx')) {
    return res.status(400).json({
      ok: false,
      error: 'DOCX_FILE_REQUIRED',
      message: 'Importe um arquivo .docx válido.'
    });
  }

  if (!contentBase64) {
    return res.status(400).json({
      ok: false,
      error: 'DOCX_CONTENT_REQUIRED',
      message: 'Conteúdo do arquivo .docx não recebido.'
    });
  }

  let buffer;
  try {
    buffer = Buffer.from(contentBase64, 'base64');
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: 'DOCX_BASE64_INVALID',
      message: 'Conteúdo base64 do arquivo .docx é inválido.'
    });
  }

  if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
    return res.status(400).json({
      ok: false,
      error: 'DOCX_SIZE_INVALID',
      message: 'O arquivo .docx precisa ter até 8 MB.'
    });
  }

  try {
    const extracted = await mammoth.extractRawText({ buffer });
    const text = normalizeExtractedText(extracted.value);
    const wordCount = countWords(text);

    if (text.length < 20) {
      return res.status(422).json({
        ok: false,
        error: 'DOCX_TEXT_NOT_EXTRACTED',
        message: 'Não foi possível extrair texto suficiente do arquivo .docx.'
      });
    }

    return res.status(200).json({
      ok: true,
      filename,
      source: normalizeSource({
        type: sourceType,
        filename,
        origin_reference: source.origin_reference
      }, 'local_upload'),
      text,
      diagnostics: {
        character_count: text.length,
        word_count: wordCount,
        warning_count: extracted.messages.length,
        warnings: extracted.messages.map((message) => ({
          type: message.type,
          message: message.message
        }))
      }
    });
  } catch (error) {
    return res.status(422).json({
      ok: false,
      error: 'DOCX_IMPORT_FAILED',
      message: error.message || 'Falha ao extrair texto do arquivo .docx.'
    });
  }
});

app.post('/api/assessment/generate', async (req, res) => {
  const input = req.body || {};
  const transcriptText = input.transcript_text;

  if (!transcriptText || typeof transcriptText !== 'string' || transcriptText.trim().length < 20) {
    return res.status(400).json({
      ok: false,
      error: 'TRANSCRIPT_TEXT_REQUIRED',
      message: 'Informe uma transcrição válida com pelo menos 20 caracteres.'
    });
  }

  const normalizedTranscriptText = normalizeExtractedText(transcriptText);
  if (normalizedTranscriptText.length > maxAiInputCharacters) {
    return res.status(413).json({
      ok: false,
      error: 'AI_INPUT_TOO_LARGE_FOR_SINGLE_CALL',
      message: `Documento com ${normalizedTranscriptText.length} caracteres excede o limite MVP atual de ${maxAiInputCharacters} caracteres para geracao IA no free tier. Nao houve corte silencioso nem relatorio parcial.`,
      diagnostics: {
        character_count: normalizedTranscriptText.length,
        max_ai_input_characters: maxAiInputCharacters
      }
    });
  }

  const allowedModes = ['conservador', 'consultivo', 'executivo'];
  if (input.generation_mode && !allowedModes.includes(input.generation_mode)) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_GENERATION_MODE',
      message: `Modo de geração inválido: ${input.generation_mode}`
    });
  }

  const generationInput = {
    ...input,
    transcript_text: normalizedTranscriptText
  };

  let assessment;
  try {
    assessment = geminiEnabled() ? await createAssessmentWithGemini(generationInput) : createAssessmentDraft(generationInput);
  } catch (error) {
    const isTimeout = error.message && /abort|timeout|timed out/i.test(error.message);
    const isJsonError = error.code === 'AI_RESPONSE_JSON_INVALID' || error.code === 'AI_RESPONSE_JSON_MISSING_OBJECT';
    const isQuota = isAiProviderQuotaError(error);
    const statusCode = isQuota ? 429 : (isTimeout ? 504 : 502);
    return res.status(statusCode).json({
      ok: false,
      error: isQuota ? 'AI_PROVIDER_QUOTA_EXCEEDED' : (isTimeout ? 'AI_ASSESSMENT_TIMEOUT' : (isJsonError ? error.code : 'AI_ASSESSMENT_GENERATION_FAILED')),
      message: isQuota
        ? 'A cota do provedor Gemini foi excedida. Aguarde o reset da cota, use um modelo/plano com mais limite ou habilite billing no projeto.'
        : (isTimeout
            ? 'A IA excedeu o tempo de geracao. Para o MVP free tier, reduza o arquivo de entrada e mantenha ate o limite operacional documentado.'
            : (error.message || 'Falha ao gerar assessment com IA.')),
      details: error.parse_message || null,
      provider: 'gemini',
      model: geminiModel,
      timeout_ms: aiGenerationTimeoutMs,
      ai_phase: error.ai_phase || null
    });
  }

  const validation = validateAssessment(assessment);

  if (!validation.valid) {
    return res.status(500).json({
      ok: false,
      error: geminiEnabled() ? 'AI_ASSESSMENT_SCHEMA_INVALID' : 'GENERATED_ASSESSMENT_INVALID',
      message: geminiEnabled()
        ? 'A IA gerou um assessment incompatível com o schema oficial.'
        : 'O backend gerou um assessment incompatível com o schema oficial.',
      validation,
      provider: geminiEnabled() ? 'gemini' : null,
      model: geminiEnabled() ? geminiModel : null
    });
  }

  return res.status(200).json({
    ok: true,
    assessment,
    validation,
    diagnostics: {
      generation_mode: 'single_call',
      character_count: normalizedTranscriptText.length,
      max_ai_input_characters: maxAiInputCharacters
    }
  });
});

app.post('/api/assessment/validate', (req, res) => {
  const assessment = req.body?.assessment;

  if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) {
    return res.status(400).json({
      ok: false,
      error: 'ASSESSMENT_REQUIRED',
      message: 'Envie um objeto assessment para validação.'
    });
  }

  const validation = validateAssessment(assessment);
  return res.status(200).json({ ok: true, ...validation });
});

app.post('/api/assessment/export-docx', async (req, res) => {
  const assessment = req.body?.assessment;

  if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) {
    return res.status(400).json({
      ok: false,
      error: 'ASSESSMENT_REQUIRED',
      message: 'Envie um objeto assessment para exportar DOCX.'
    });
  }

  const validation = validateAssessment(assessment);
  if (!validation.valid) {
    return res.status(400).json({
      ok: false,
      error: 'ASSESSMENT_SCHEMA_INVALID',
      message: 'O assessment precisa estar válido no schema antes de gerar DOCX.',
      validation
    });
  }

  const blockingIssues = assessmentQualityBlockingIssues(assessment);
  if (blockingIssues.length) {
    return res.status(422).json({
      ok: false,
      error: 'ASSESSMENT_QUALITY_BLOCKED',
      message: 'O assessment foi bloqueado pela revisao de qualidade antes da exportacao DOCX.',
      validation: {
        ...validation,
        blocking_issues: blockingIssues
      }
    });
  }

  try {
    const buffer = await buildAssessmentDocx(assessment);
    const clientName = normalizeOptionalString(assessment.client?.name) || 'assessment';
    const safeFilename = clientName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'assessment';

    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition', `attachment; filename="${safeFilename}-assessment.docx"`);
    res.set('Content-Length', String(buffer.length));
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'DOCX_EXPORT_FAILED',
      message: error.message || 'Falha ao gerar DOCX editável.'
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'NOT_FOUND',
    message: `Rota não encontrada: ${req.method} ${req.path}`
  });
});

app.use((error, req, res, next) => {
  console.error('[assessment-report-builder]', error);
  res.status(500).json({
    ok: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: error.message || 'Erro interno no backend.'
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Assessment Report Builder v${serviceVersion} running on port ${port} using server.js`);
});
