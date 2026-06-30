const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const Ajv2020 = require('ajv/dist/2020');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { renderOperationalAssessmentDocx } = require('./docx-template-renderer');
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
const officialTemplatePath = path.resolve(__dirname, 'templates', 'assessment-xmobots-template.docx');
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

function xmlEscape(value) {
  return safeText(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wordText(text, options = {}) {
  const color = options.color || DOCX_COLORS.navy;
  const size = options.size || 20;
  const bold = options.bold ? '<w:b/>' : '';
  const italic = options.italic ? '<w:i/>' : '';
  return `<w:r><w:rPr>${bold}${italic}<w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function wordParagraph(text, options = {}) {
  const style = options.style ? `<w:pStyle w:val="${options.style}"/>` : '';
  const align = options.align ? `<w:jc w:val="${options.align}"/>` : '';
  const spacing = '<w:spacing w:after="160"/>';
  return `<w:p><w:pPr>${style}${align}${spacing}</w:pPr>${wordText(text, options)}</w:p>`;
}

function wordPageBreak() {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function wordCell(text, options = {}) {
  const fill = options.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${options.fill}"/>` : '';
  const color = options.color || DOCX_COLORS.navy;
  const bold = options.bold ? '<w:b/>' : '';
  return `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/>${fill}<w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr>${bold}<w:color w:val="${color}"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p></w:tc>`;
}

function wordTable(headers, rows) {
  const safeRows = Array.isArray(rows) && rows.length ? rows : [['Sem dados estruturados.']];
  const headerXml = `<w:tr>${headers.map((header) => wordCell(header, { bold: true, fill: DOCX_COLORS.blue, color: DOCX_COLORS.white })).join('')}</w:tr>`;
  const rowsXml = safeRows.map((row, index) => `<w:tr>${row.map((value) => wordCell(value, { fill: index % 2 === 0 ? DOCX_COLORS.white : DOCX_COLORS.grayFill })).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="${DOCX_COLORS.grayBorder}"/><w:left w:val="single" w:sz="4" w:color="${DOCX_COLORS.grayBorder}"/><w:bottom w:val="single" w:sz="4" w:color="${DOCX_COLORS.grayBorder}"/><w:right w:val="single" w:sz="4" w:color="${DOCX_COLORS.grayBorder}"/><w:insideH w:val="single" w:sz="4" w:color="${DOCX_COLORS.grayBorder}"/><w:insideV w:val="single" w:sz="4" w:color="${DOCX_COLORS.grayBorder}"/></w:tblBorders></w:tblPr>${headerXml}${rowsXml}</w:tbl>`;
}

function buildTemplateAppendixXml(assessment) {
  const summary = assessment.executive_summary || {};
  const client = assessment.client || {};
  const children = [
    wordPageBreak(),
    wordParagraph('Assessment estruturado gerado pela IA', { style: 'Ttulo1', bold: true, color: DOCX_COLORS.blueDark, size: 28 }),
    wordParagraph(`Cliente: ${safeText(client.name)} | Area: ${safeText(client.business_area)}`, { bold: true, color: DOCX_COLORS.blueDark }),
    wordParagraph('Resumo executivo', { style: 'Ttulo2', bold: true, color: DOCX_COLORS.navy, size: 24 }),
    wordParagraph(summary.current_state || 'Sem resumo executivo estruturado.'),
    wordParagraph('Principais dores', { style: 'Ttulo2', bold: true, color: DOCX_COLORS.navy, size: 24 }),
    wordTable(['Dor identificada'], (summary.main_pains || []).map((pain) => [pain])),
    wordParagraph('Mapa de softwares', { style: 'Ttulo2', bold: true, color: DOCX_COLORS.navy, size: 24 }),
    wordTable(['Area', 'Software', 'Uso', 'Dores', 'Oportunidades'], mapRows(assessment.software_map, (item) => [
      item.area,
      item.software,
      item.usage,
      item.pain_points,
      item.opportunities
    ])),
    wordParagraph('Gaps e recomendacoes', { style: 'Ttulo2', bold: true, color: DOCX_COLORS.navy, size: 24 }),
    wordTable(['Gap', 'Categoria', 'Impacto', 'Recomendacao', 'Status'], mapRows(assessment.gap_map, (item) => [
      item.description,
      item.category,
      item.impact,
      item.recommendation,
      item.status
    ])),
    wordParagraph('Radar de gaps', { style: 'Ttulo2', bold: true, color: DOCX_COLORS.navy, size: 24 }),
    wordTable(['Categoria', 'Score', 'Gaps fonte'], mapRows(assessment.gap_radar, (item) => [
      item.category,
      item.score,
      item.source_gaps
    ])),
    wordParagraph('Fluxos', { style: 'Ttulo2', bold: true, color: DOCX_COLORS.navy, size: 24 })
  ];

  (assessment.flows || []).forEach((flow) => {
    children.push(wordParagraph(`${safeText(flow.type)} - ${safeText(flow.name)}`, { bold: true, color: DOCX_COLORS.blueDark }));
    children.push(wordTable(['Ordem', 'Area', 'Atividade', 'Sistema', 'Entrada', 'Saida', 'Responsavel', 'Problema'], mapRows(flow.steps, (step) => [
      step.order,
      step.area,
      step.activity,
      step.system,
      step.input,
      step.output,
      step.responsible,
      step.issue
    ])));
  });

  children.push(wordParagraph('Roadmap', { style: 'Ttulo2', bold: true, color: DOCX_COLORS.navy, size: 24 }));
  children.push(wordTable(['Fase', 'Titulo', 'Descricao', 'Dependencias'], mapRows(assessment.roadmap, (item) => [
    item.phase,
    item.title,
    item.description,
    item.dependencies
  ])));

  return children.join('');
}

function replaceWordText(documentXml, fromText, toText) {
  if (!fromText || !toText || fromText === toText) return documentXml;
  return documentXml.split(xmlEscape(fromText)).join(xmlEscape(toText));
}

async function buildTemplateBasedAssessmentDocx(assessment) {
  if (!fs.existsSync(officialTemplatePath)) {
    return null;
  }

  const templateBuffer = fs.readFileSync(officialTemplatePath);
  const zip = await JSZip.loadAsync(templateBuffer);
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) {
    throw new Error('Template DOCX oficial sem word/document.xml.');
  }

  const client = assessment.client || {};
  let documentXml = await documentFile.async('string');
  documentXml = replaceWordText(documentXml, 'XMOBOTS - Arquitetura de Processos e Sistemas', `${safeText(client.name || 'Cliente')} - Arquitetura de Processos e Sistemas`);
  documentXml = replaceWordText(documentXml, 'XMOBOTS', safeText(client.name || 'Cliente'));

  zip.file('word/document.xml', documentXml);
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
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
  return renderOperationalAssessmentDocx(assessment);
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

async function createAssessmentWithGemini(input) {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: geminiModel,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  });
  const result = await model.generateContent(buildAssessmentPromptV2(input), { timeout: aiGenerationTimeoutMs });
  const response = result.response;
  const jsonText = response.text();
  return normalizeAiAssessment(extractJsonObject(jsonText), input);
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
      message: `Documento com ${normalizedTranscriptText.length} caracteres excede o limite confiavel de ${maxAiInputCharacters} caracteres para uma chamada unica de IA. Proxima etapa tecnica necessaria: pipeline por chunks com consolidacao, sem corte silencioso.`,
      diagnostics: {
        character_count: normalizedTranscriptText.length,
        max_ai_input_characters: maxAiInputCharacters,
        required_architecture: 'chunked_ai_pipeline'
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

  let assessment;
  try {
    assessment = geminiEnabled() ? await createAssessmentWithGemini(input) : createAssessmentDraft(input);
  } catch (error) {
    const isTimeout = error.message && /abort|timeout|timed out/i.test(error.message);
    const isJsonError = error.code === 'AI_RESPONSE_JSON_INVALID' || error.code === 'AI_RESPONSE_JSON_MISSING_OBJECT';
    return res.status(isTimeout ? 504 : 502).json({
      ok: false,
      error: isTimeout ? 'AI_ASSESSMENT_TIMEOUT' : (isJsonError ? error.code : 'AI_ASSESSMENT_GENERATION_FAILED'),
      message: error.message || 'Falha ao gerar assessment com IA.',
      details: error.parse_message || null,
      provider: 'gemini',
      model: geminiModel,
      timeout_ms: aiGenerationTimeoutMs
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
