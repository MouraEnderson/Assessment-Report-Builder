const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const { buildReportModel } = require('./report-model');

const operationalTemplatePath = path.resolve(__dirname, 'templates', 'assessment-operational-template.docx');

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

  return doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

module.exports = {
  operationalTemplatePath,
  renderOperationalAssessmentDocx
};
