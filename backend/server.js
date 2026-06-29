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

function validateAssessment(assessment) {
  const valid = validateSchema(assessment);
  return {
    valid: Boolean(valid),
    errors: valid ? [] : normalizeValidationErrors(validateSchema.errors),
    warnings: []
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
    throw new Error('A IA não retornou um objeto JSON.');
  }

  return JSON.parse(candidate.slice(first, last + 1));
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
  blueLight: 'EAF0FF',
  cyanLight: 'E8F7FF',
  grayText: '475569',
  grayBorder: 'CBD5E1',
  grayFill: 'F8FAFC',
  green: 'DDF7E8',
  yellow: 'FFF4CC',
  orange: 'FFE3C2',
  red: 'FFE0E0',
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

function docBullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [textRun(text)]
  });
}

function cell(text, bold = false, options = {}) {
  return new TableCell({
    columnSpan: options.columnSpan,
    verticalAlign: options.verticalAlign || VerticalAlign.CENTER,
    shading: options.fill
      ? {
          type: ShadingType.CLEAR,
          fill: options.fill,
          color: 'auto'
        }
      : undefined,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: options.borderColor || DOCX_COLORS.grayBorder },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: options.borderColor || DOCX_COLORS.grayBorder },
      left: { style: BorderStyle.SINGLE, size: 1, color: options.borderColor || DOCX_COLORS.grayBorder },
      right: { style: BorderStyle.SINGLE, size: 1, color: options.borderColor || DOCX_COLORS.grayBorder }
    },
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
      rows: [
        new TableRow({
          children: [
            cell('ASSESSMENT DE ENGENHARIA', true, {
              columnSpan: 2,
              fill: DOCX_COLORS.blue,
              color: DOCX_COLORS.white,
              size: 34,
              alignment: AlignmentType.CENTER
            })
          ]
        }),
        new TableRow({
          children: [
            cell(safeText(client.name || 'Cliente nao informado'), true, {
              columnSpan: 2,
              fill: DOCX_COLORS.blueLight,
              color: DOCX_COLORS.blueDark,
              size: 28,
              alignment: AlignmentType.CENTER
            })
          ]
        }),
        new TableRow({
          children: [
            cell('Arquitetura de processos, sistemas, gaps e roadmap de evolucao', false, {
              columnSpan: 2,
              fill: DOCX_COLORS.white,
              color: DOCX_COLORS.grayText,
              size: 20,
              alignment: AlignmentType.CENTER
            })
          ]
        }),
        new TableRow({ children: [cell('Cliente', true, { fill: DOCX_COLORS.grayFill }), cell(client.name, false)] }),
        new TableRow({ children: [cell('Area principal', true, { fill: DOCX_COLORS.grayFill }), cell(client.business_area, false)] }),
        new TableRow({ children: [cell('Escopo', true, { fill: DOCX_COLORS.grayFill }), cell(client.assessment_scope, false)] }),
        new TableRow({ children: [cell('Status do assessment', true, { fill: DOCX_COLORS.grayFill }), cell(`${safeText(metadata.status)} | ${safeText(metadata.generation_mode)}`, false)] })
      ]
    }),
    docParagraph('Documento gerado pelo Assessment Report Builder a partir do assessment.json validado. Conteudo editavel e pendente de revisao humana antes de envio oficial.', {
      alignment: AlignmentType.CENTER,
      color: DOCX_COLORS.grayText,
      size: 18,
      before: 300
    }),
    pageBreak()
  ];
}

function buildExecutiveSnapshot(assessment) {
  const summary = assessment.executive_summary || {};
  return [
    sectionTitle('01', 'Introducao e leitura executiva', 'Contexto consolidado a partir do documento importado e da geracao IA validada pelo schema.'),
    docParagraph('Objetivo do documento', { heading: HeadingLevel.HEADING_2 }),
    docParagraph('Este assessment consolida o processo atual, sistemas utilizados, gargalos, riscos e oportunidades de evolucao para apoiar uma jornada de transformacao em ondas.'),
    callout('Leitura executiva', summary.current_state || 'Sem resumo executivo estruturado.'),
    docParagraph('Principais dores', { heading: HeadingLevel.HEADING_2 }),
    ...(summary.main_pains || ['Sem dores estruturadas.']).map((pain) => docBullet(pain)),
    docParagraph(`Maturidade geral: ${safeText(summary.overall_maturity)} | Confianca: ${safeText(summary.confidence)}`, {
      bold: true,
      color: DOCX_COLORS.blueDark
    })
  ];
}

function buildSoftwareLandscape(assessment) {
  return [
    pageBreak(),
    sectionTitle('02', 'Visao geral de sistemas e processos', 'Mapa editavel dos softwares e processos identificados no assessment.'),
    docParagraph('Ferramentas e recursos utilizados', { heading: HeadingLevel.HEADING_2 }),
    docTable(['Area', 'Software', 'Uso', 'Dores', 'Integracoes', 'Oportunidades'], mapRows(assessment.software_map, (item) => [
      item.area,
      item.software,
      item.usage,
      item.pain_points,
      item.integrations,
      item.opportunities
    ]), { fixed: true }),
    docParagraph('Mapa de processos', { heading: HeadingLevel.HEADING_2 }),
    docTable(['Processo', 'Area responsavel', 'Sistemas', 'Dores', 'Evidencia'], mapRows(assessment.process_map, (item) => [
      item.name,
      item.owner_area,
      item.systems,
      item.pain_points,
      item.evidence
    ]), { fixed: true })
  ];
}

function buildGapAnalysis(assessment) {
  const radarRows = mapRows(assessment.gap_radar, (item) => item).map((item) => {
    const score = Math.max(0, Math.min(5, Math.round(Number(item.score || 0))));
    return new TableRow({
      children: [
        cell(item.category, true, { fill: DOCX_COLORS.grayFill }),
        ...[0, 1, 2, 3, 4, 5].map((value) => cell(value <= score ? 'X' : '', false, {
          fill: value <= score ? scoreColor(score) : DOCX_COLORS.white,
          alignment: AlignmentType.CENTER,
          size: 18
        })),
        cell(item.score, true, {
          fill: scoreColor(score),
          alignment: AlignmentType.CENTER
        }),
        cell(item.source_gaps, false)
      ]
    });
  });

  return [
    pageBreak(),
    sectionTitle('03', 'Analise de gaps e maturidade', 'Gaps classificados e radar em matriz editavel para ajuste no Word.'),
    docTable(['Gap', 'Categoria', 'Impacto', 'Classificacao', 'Recomendacao', 'Status'], mapRows(assessment.gap_map, (item) => [
      item.description,
      item.category,
      item.impact,
      item.classification,
      item.recommendation,
      item.status
    ]), { fixed: true }),
    docParagraph('Radar de gaps', { heading: HeadingLevel.HEADING_2 }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          tableHeader: true,
          children: ['Categoria', '0', '1', '2', '3', '4', '5', 'Score', 'Gaps fonte'].map((header) => cell(header, true, {
            fill: DOCX_COLORS.blue,
            color: DOCX_COLORS.white,
            size: 16,
            alignment: AlignmentType.CENTER
          }))
        }),
        ...(radarRows.length ? radarRows : [new TableRow({ children: [cell('Sem radar estruturado', false, { columnSpan: 9 })] })])
      ]
    }),
    docParagraph('Observacao: o radar acima e uma matriz Word editavel. Grafico Office nativo ainda depende de uma etapa especifica de geracao de chart OOXML.', {
      color: DOCX_COLORS.grayText,
      size: 17
    })
  ];
}

function buildFlowSection(assessment) {
  const children = [
    pageBreak(),
    sectionTitle('04', 'Fluxos AS-IS e TO-BE', 'Fluxos reconstruidos com tabelas editaveis, preservando etapas, areas, sistemas, entradas, saidas e problemas.')
  ];

  (assessment.flows || []).forEach((flow, flowIndex) => {
    const steps = Array.isArray(flow.steps) ? flow.steps : [];
    const visibleSteps = steps.slice(0, 6);
    children.push(docParagraph(`${safeText(flow.type)} - ${safeText(flow.name)}`, { heading: HeadingLevel.HEADING_2 }));
    children.push(callout('Evidencia', `${safeText(flow.evidence)} | Confianca: ${safeText(flow.confidence)}`, flowIndex % 2 === 0 ? DOCX_COLORS.blueLight : DOCX_COLORS.cyanLight));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          children: visibleSteps.length
            ? visibleSteps.map((step) => cell(`Etapa ${safeText(step.order)}`, true, {
                fill: flow.type === 'TO-BE' ? DOCX_COLORS.green : DOCX_COLORS.yellow,
                alignment: AlignmentType.CENTER,
                size: 17
              }))
            : [cell('Sem etapas estruturadas', true, { fill: DOCX_COLORS.grayFill })]
        }),
        new TableRow({
          children: visibleSteps.length
            ? visibleSteps.map((step) => cell(step.activity, true, { alignment: AlignmentType.CENTER, size: 17 }))
            : [cell('Sem dados', false)]
        }),
        new TableRow({
          children: visibleSteps.length
            ? visibleSteps.map((step) => cell(`${safeText(step.area)} | ${safeText(step.system)}`, false, {
                fill: DOCX_COLORS.grayFill,
                alignment: AlignmentType.CENTER,
                size: 16
              }))
            : [cell('Sem dados', false)]
        }),
        new TableRow({
          children: visibleSteps.length
            ? visibleSteps.map((step) => cell(step.issue || 'Sem problema registrado', false, {
                fill: impactFill(step.issue || ''),
                alignment: AlignmentType.CENTER,
                size: 16
              }))
            : [cell('Sem dados', false)]
        })
      ]
    }));
    if (steps.length > visibleSteps.length) {
      children.push(docParagraph(`Fluxo visual limitado aos 6 primeiros passos para preservar legibilidade. A tabela detalhada abaixo mantem os ${steps.length} passos.`, {
        color: DOCX_COLORS.grayText,
        size: 17
      }));
    }
    children.push(docTable(['Ordem', 'Area', 'Atividade', 'Sistema', 'Entrada', 'Saida', 'Responsavel', 'Problema'], mapRows(steps, (step) => [
      step.order,
      step.area,
      step.activity,
      step.system,
      step.input,
      step.output,
      step.responsible,
      step.issue
    ]), { fixed: true, headerFill: flow.type === 'TO-BE' ? '2E7D32' : DOCX_COLORS.blueDark }));
  });

  return children;
}

function buildRecommendationsAndRoadmap(assessment) {
  return [
    pageBreak(),
    sectionTitle('05', 'Direcionamentos, riscos e roadmap', 'Priorizacao editavel para transformar diagnostico em plano de execucao.'),
    docParagraph('Riscos', { heading: HeadingLevel.HEADING_2 }),
    docTable(['Risco', 'Probabilidade', 'Impacto', 'Mitigacao', 'Evidencia'], mapRows(assessment.risks, (item) => [
      item.description,
      item.probability,
      item.impact,
      item.mitigation,
      item.evidence
    ]), { fixed: true }),
    docParagraph('Recomendacoes', { heading: HeadingLevel.HEADING_2 }),
    docTable(['Prioridade', 'Titulo', 'Descricao', 'Esforco', 'Gaps relacionados', 'Status'], mapRows(assessment.recommendations, (item) => [
      item.priority,
      item.title,
      item.description,
      item.effort,
      item.related_gaps,
      item.status
    ]), { fixed: true }),
    docParagraph('Roadmap em ondas', { heading: HeadingLevel.HEADING_2 }),
    docTable(['Fase', 'Titulo', 'Descricao', 'Dependencias', 'Recomendacoes relacionadas'], mapRows(assessment.roadmap, (item) => [
      item.phase,
      item.title,
      item.description,
      item.dependencies,
      item.related_recommendations
    ]), { fixed: true, headerFill: DOCX_COLORS.blueDark }),
    docParagraph('Perguntas abertas', { heading: HeadingLevel.HEADING_2 }),
    docTable(['Pergunta', 'Topico', 'Responsavel', 'Status'], mapRows(assessment.open_questions, (item) => [
      item.question,
      item.topic,
      item.responsible,
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
    ...buildRecommendationsAndRoadmap(assessment)
  ];
}

async function buildAssessmentDocx(assessment) {
  const document = new Document({
    creator: 'Assessment Report Builder',
    title: `Assessment ${safeText(assessment.client && assessment.client.name)}`,
    description: 'Relatorio editavel gerado a partir de assessment.json validado.',
    styles: {
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          run: { size: 36, bold: true, color: DOCX_COLORS.navy },
          paragraph: { spacing: { after: 240 } }
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 28, bold: true, color: DOCX_COLORS.blueDark },
          paragraph: { spacing: { before: 260, after: 160 } }
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 23, bold: true, color: DOCX_COLORS.navy },
          paragraph: { spacing: { before: 180, after: 100 } }
        }
      ]
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 900,
              right: 720,
              bottom: 900,
              left: 720
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              docParagraph('Assessment Report Builder | Documento executivo editavel', {
                alignment: AlignmentType.RIGHT,
                color: DOCX_COLORS.grayText,
                size: 16,
                after: 80
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  textRun('Pagina ', { size: 16, color: DOCX_COLORS.grayText }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: DOCX_COLORS.grayText })
                ]
              })
            ]
          })
        },
        children: buildDocxChildren(assessment)
      }
    ]
  });

  return Packer.toBuffer(document);
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

async function createAssessmentWithGemini(input) {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: geminiModel,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  });
  const result = await model.generateContent(buildAssessmentPrompt(input));
  const response = result.response;
  const jsonText = response.text();
  const assessment = extractJsonObject(jsonText);
  const now = new Date().toISOString();

  assessment.metadata = assessment.metadata && typeof assessment.metadata === 'object' ? assessment.metadata : {};
  assessment.metadata.assessment_id = assessment.metadata.assessment_id || `ASSESS-${Date.now()}`;
  assessment.metadata.version = assessment.metadata.version || '0.1';
  assessment.metadata.status = 'draft';
  assessment.metadata.assessment_type = input.assessment_type || assessment.metadata.assessment_type || 'plm_assessment';
  assessment.metadata.generation_mode = input.generation_mode || assessment.metadata.generation_mode || 'consultivo';
  assessment.metadata.created_at = assessment.metadata.created_at || now;
  assessment.metadata.updated_at = now;

  assessment.client = assessment.client && typeof assessment.client === 'object' ? assessment.client : {};
  const client = input.client && typeof input.client === 'object' ? input.client : {};
  assessment.client.name = assessment.client.name || normalizeOptionalString(client.name);
  assessment.client.business_area = assessment.client.business_area || normalizeOptionalString(client.business_area);
  assessment.client.assessment_scope = Object.prototype.hasOwnProperty.call(assessment.client, 'assessment_scope') ? assessment.client.assessment_scope : null;
  assessment.client.participants = Array.isArray(assessment.client.participants) ? assessment.client.participants : [];

  assessment.input_sources = {
    transcript: normalizeSource(input.transcript_source, 'local_upload'),
    template: normalizeSource(input.template_source, 'not_selected')
  };

  assessment.meeting_summary = assessment.meeting_summary && typeof assessment.meeting_summary === 'object' ? assessment.meeting_summary : {};
  assessment.meeting_summary.raw_length = input.transcript_text.trim().length;
  assessment.meeting_summary.word_count = countWords(input.transcript_text);
  assessment.meeting_summary.note = assessment.meeting_summary.note || 'Assessment estruturado por IA a partir de documento importado, pendente de revisão humana.';
  assessment.meeting_summary.raw_excerpt = assessment.meeting_summary.raw_excerpt || input.transcript_text.trim().slice(0, 500);

  assessment.appendix = assessment.appendix && typeof assessment.appendix === 'object' ? assessment.appendix : {};
  assessment.appendix.transcript_processing_status = 'received';
  assessment.appendix.ai_extraction_status = 'generated';
  assessment.appendix.ai_provider = 'gemini';
  assessment.appendix.ai_model = geminiModel;
  assessment.appendix.ai_generated_at = now;

  assessment.review_status = {
    executive_summary: 'Pendente',
    software_map: 'Pendente',
    gap_map: 'Pendente',
    flows: 'Pendente',
    recommendations: 'Pendente'
  };

  return assessment;
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

  const allowedModes = ['conservador', 'consultivo', 'executivo'];
  if (input.generation_mode && !allowedModes.includes(input.generation_mode)) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_GENERATION_MODE',
      message: `Modo de geração inválido: ${input.generation_mode}`
    });
  }

  let assessment;
  try {
    assessment = geminiEnabled() ? await createAssessmentWithGemini(input) : createAssessmentDraft(input);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: 'AI_ASSESSMENT_GENERATION_FAILED',
      message: error.message || 'Falha ao gerar assessment com IA.',
      provider: 'gemini',
      model: geminiModel
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

  return res.status(200).json({ ok: true, assessment, validation });
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
