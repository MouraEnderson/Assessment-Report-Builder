const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const { buildReportModel } = require('./report-model');
const { injectNativeGapRadarChart } = require('./native-word-objects');

const operationalTemplatePath = path.resolve(__dirname, 'templates', 'assessment-operational-template.docx');
const removeVisualShapeMarker = '__REMOVE_EMPTY_VISUAL_SHAPE__';
const legacyTemplateTerms = [
  'XMOBOTS',
  'Altium',
  'SKACONECTOR',
  'EBOM',
  'MBOM',
  'MCAD',
  'ECAD'
];

function normalizeForSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function extractDocumentText(buffer) {
  const zip = new PizZip(buffer);
  const documentXml = zip.file('word/document.xml');
  if (!documentXml) {
    throw new Error('DOCX renderizado sem word/document.xml.');
  }

  return documentXml
    .asText()
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertNoLegacyTemplateLeak(buffer, assessment) {
  const documentText = normalizeForSearch(extractDocumentText(buffer));
  const assessmentText = normalizeForSearch(JSON.stringify(assessment || {}));
  const leakedTerms = legacyTemplateTerms.filter((term) => {
    const normalizedTerm = normalizeForSearch(term);
    return documentText.includes(normalizedTerm) && !assessmentText.includes(normalizedTerm);
  });

  if (leakedTerms.length) {
    throw new Error(`DOCX_EXPORT_TEMPLATE_LEAK: termos herdados do template encontrados sem evidencia no assessment: ${leakedTerms.join(', ')}`);
  }
}

function normalizeXmlText(xml) {
  return String(xml || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function removeEmptyVisualShapes(documentXml) {
  let nextXml = documentXml;

  nextXml = nextXml.replace(
    /<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/g,
    (block) => (block.includes(removeVisualShapeMarker) ? '' : block)
  );
  nextXml = nextXml.replace(
    /<w:drawing\b[\s\S]*?<\/w:drawing>/g,
    (block) => (block.includes(removeVisualShapeMarker) ? '' : block)
  );
  nextXml = nextXml.replace(
    /<w:pict\b[\s\S]*?<\/w:pict>/g,
    (block) => (block.includes(removeVisualShapeMarker) ? '' : block)
  );

  return nextXml.replace(new RegExp(removeVisualShapeMarker, 'g'), '');
}

function isPrimaryDetailTable(tableXml) {
  const text = normalizeXmlText(tableXml);
  const headerGroups = [
    ['AREA', 'SISTEMA', 'USO', 'DORES', 'OPORTUNIDADES'],
    ['PROCESSO', 'AREA', 'SISTEMAS', 'DORES', 'EVIDENCIA'],
    ['GAP', 'CATEGORIA', 'IMPACTO', 'RECOMENDACAO'],
    ['CATEGORIA', 'SCORE', 'NIVEL', 'GAPS FONTE'],
    ['RISCO', 'PROBABILIDADE', 'IMPACTO', 'MITIGACAO'],
    ['FLUXO', 'TIPO', 'ETAPA 1', 'ETAPA 2'],
    ['FLUXO', 'TIPO', 'ORDEM', 'ENTRADA', 'ATIVIDADE']
  ];

  return headerGroups.some((headers) => headers.every((header) => text.includes(header)));
}

function removePrimaryDetailTables(documentXml) {
  return documentXml.replace(
    /<w:tbl\b[\s\S]*?<\/w:tbl>/g,
    (tableXml) => (isPrimaryDetailTable(tableXml) ? '' : tableXml)
  );
}

function tableCellTexts(tableXml) {
  return Array.from(tableXml.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)).map((cellMatch) => (
    normalizeXmlText(cellMatch[0])
  ));
}

function isEmptyOperationalTable(tableXml) {
  const text = normalizeXmlText(tableXml);
  const cells = tableCellTexts(tableXml).filter(Boolean);
  if (!cells.length) return true;

  const headerOnlyGroups = [
    ['PERGUNTA', 'TOPICO', 'RESPONSAVEL', 'STATUS'],
    ['TITULO', 'DESCRICAO', 'PRIORIDADE', 'ESFORCO', 'STATUS'],
    ['FASE', 'TITULO', 'DESCRICAO', 'DEPENDENCIAS'],
    ['RISCO', 'PROBABILIDADE', 'IMPACTO', 'MITIGACAO']
  ];

  return headerOnlyGroups.some((headers) => (
    headers.every((header) => text.includes(header)) && cells.every((cell) => headers.includes(cell))
  ));
}

function removeEmptyOperationalTables(documentXml) {
  return documentXml.replace(
    /<w:tbl\b[\s\S]*?<\/w:tbl>/g,
    (tableXml) => (isEmptyOperationalTable(tableXml) ? '' : tableXml)
  );
}

function isEmptyParagraph(paragraphXml) {
  if (/<w:(drawing|pict|br)\b/.test(paragraphXml)) return false;
  return !normalizeXmlText(paragraphXml);
}

function removeExcessEmptyParagraphs(documentXml) {
  let emptyRun = 0;
  return documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    if (!isEmptyParagraph(paragraphXml)) {
      emptyRun = 0;
      return paragraphXml;
    }

    emptyRun += 1;
    return emptyRun <= 1 ? paragraphXml : '';
  });
}

function removeExactTextParagraph(documentXml, expectedText) {
  return documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => (
    normalizeXmlText(paragraphXml) === expectedText ? '' : paragraphXml
  ));
}

function removeOrphanOperationalHeadings(documentXml) {
  const text = normalizeXmlText(documentXml);
  let nextXml = documentXml;

  if (!/\b(ABERTA|RESPONDIDA|DESCARTADA)\b/.test(text)) {
    nextXml = removeExactTextParagraph(nextXml, 'PERGUNTAS ABERTAS');
  }

  return nextXml;
}

function polishDocumentXml(zip) {
  const documentPath = 'word/document.xml';
  const documentFile = zip.file(documentPath);
  if (!documentFile) return;

  let documentXml = documentFile.asText();
  documentXml = removeEmptyVisualShapes(documentXml);
  documentXml = removePrimaryDetailTables(documentXml);
  documentXml = removeEmptyOperationalTables(documentXml);
  documentXml = removeOrphanOperationalHeadings(documentXml);
  documentXml = removeExcessEmptyParagraphs(documentXml);
  zip.file(documentPath, documentXml);
}

async function renderOperationalAssessmentDocx(assessment) {
  const templateBuffer = fs.readFileSync(operationalTemplatePath);
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter() {
      return '';
    }
  });

  const reportModel = buildReportModel(assessment);
  doc.render(reportModel);
  polishDocumentXml(doc.getZip());

  await injectNativeGapRadarChart(doc.getZip(), reportModel);

  const buffer = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  assertNoLegacyTemplateLeak(buffer, assessment);
  return buffer;
}

module.exports = {
  assertNoLegacyTemplateLeak,
  operationalTemplatePath,
  renderOperationalAssessmentDocx
};
