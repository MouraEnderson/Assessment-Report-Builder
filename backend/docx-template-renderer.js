const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const { buildReportModel } = require('./report-model');

const operationalTemplatePath = path.resolve(__dirname, 'templates', 'assessment-operational-template.docx');
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

  doc.render(buildReportModel(assessment));

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
