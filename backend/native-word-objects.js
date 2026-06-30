const JSZip = require('jszip');

const GAP_RADAR_MARKER = '__NATIVE_GAP_RADAR_CHART__';

function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(5, Math.round(number)));
}

function normalizeRadarRows(model) {
  const rows = Array.isArray(model && model.gap_radar) ? model.gap_radar : [];
  const normalized = rows
    .map((row, index) => ({
      category: String(row.category || `Categoria ${index + 1}`).slice(0, 64),
      current: clampScore(row.score),
      target: 5
    }))
    .filter((row) => row.category && row.category !== '-');

  return normalized.length ? normalized : [{
    category: 'Maturidade nao evidenciada',
    current: 0,
    target: 5
  }];
}

function buildSeriesCache(values) {
  return values
    .map((value, index) => `<c:pt idx="${index}"><c:v>${escapeXml(value)}</c:v></c:pt>`)
    .join('');
}

function replaceFirst(xml, pattern, replacement, label) {
  const nextXml = xml.replace(pattern, replacement);
  if (nextXml === xml) {
    throw new Error(`DOCX_NATIVE_RADAR_TEMPLATE_MISMATCH: ${label}`);
  }
  return nextXml;
}

function buildChartXmlFromTemplate(templateChartXml, rows) {
  const lastRow = rows.length + 1;
  const categories = rows.map((row) => row.category);
  const currentValues = rows.map((row) => row.current);
  const targetValues = rows.map((row) => row.target);
  let xml = templateChartXml;

  xml = replaceFirst(
    xml,
    /<c:tx><c:strRef><c:f>Planilha1!\$B\$1<\/c:f><c:strCache><c:ptCount val="1"\/><c:pt idx="0"><c:v>[^<]*<\/c:v><\/c:pt><\/c:strCache><\/c:strRef><\/c:tx>/,
    '<c:tx><c:strRef><c:f>Planilha1!$B$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Atual</c:v></c:pt></c:strCache></c:strRef></c:tx>',
    'serie atual'
  );
  xml = replaceFirst(
    xml,
    /<c:tx><c:strRef><c:f>Planilha1!\$C\$1<\/c:f><c:strCache><c:ptCount val="1"\/><c:pt idx="0"><c:v>[^<]*<\/c:v><\/c:pt><\/c:strCache><\/c:strRef><\/c:tx>/,
    '<c:tx><c:strRef><c:f>Planilha1!$C$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Meta</c:v></c:pt></c:strCache></c:strRef></c:tx>',
    'serie meta'
  );
  xml = xml.replace(
    /<c:cat><c:numRef><c:f>Planilha1!\$A\$2:\$A\$\d+<\/c:f><c:numCache><c:formatCode>m\/d\/yyyy<\/c:formatCode><c:ptCount val="\d+"\/>[\s\S]*?<\/c:numCache><\/c:numRef><\/c:cat>/g,
    `<c:cat><c:strRef><c:f>Planilha1!$A$2:$A$${lastRow}</c:f><c:strCache><c:ptCount val="${rows.length}"/>${buildSeriesCache(categories)}</c:strCache></c:strRef></c:cat>`
  );
  xml = replaceFirst(
    xml,
    /<c:val><c:numRef><c:f>Planilha1!\$B\$2:\$B\$\d+<\/c:f><c:numCache><c:formatCode>General<\/c:formatCode><c:ptCount val="\d+"\/>[\s\S]*?<\/c:numCache><\/c:numRef><\/c:val>/,
    `<c:val><c:numRef><c:f>Planilha1!$B$2:$B$${lastRow}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${rows.length}"/>${buildSeriesCache(currentValues)}</c:numCache></c:numRef></c:val>`,
    'valores atuais'
  );
  xml = replaceFirst(
    xml,
    /<c:val><c:numRef><c:f>Planilha1!\$C\$2:\$C\$\d+<\/c:f><c:numCache><c:formatCode>General<\/c:formatCode><c:ptCount val="\d+"\/>[\s\S]*?<\/c:numCache><\/c:numRef><\/c:val>/,
    `<c:val><c:numRef><c:f>Planilha1!$C$2:$C$${lastRow}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${rows.length}"/>${buildSeriesCache(targetValues)}</c:numCache></c:numRef></c:val>`,
    'valores meta'
  );

  if (!xml.includes('<c:strRef>')) {
    throw new Error('DOCX_NATIVE_RADAR_TEMPLATE_MISMATCH: categorias');
  }

  return xml;
}

function columnName(index) {
  return String.fromCharCode(65 + index);
}

function xlsxCell(columnIndex, rowIndex, value) {
  const ref = `${columnName(columnIndex)}${rowIndex}`;
  if (typeof value === 'number') {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function xlsxRow(rowIndex, values) {
  return `<row r="${rowIndex}">${values.map((value, index) => xlsxCell(index, rowIndex, value)).join('')}</row>`;
}

async function buildRadarWorkbook(rows) {
  const zip = new JSZip();
  const sheetRows = [
    ['Categoria', 'Atual', 'Meta'],
    ...rows.map((row) => [row.category, row.current, row.target])
  ];
  const worksheetRows = sheetRows.map((row, index) => xlsxRow(index + 1, row)).join('');
  const dimension = `A1:C${sheetRows.length}`;

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Planilha1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimension}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <sheetData>${worksheetRows}</sheetData>
</worksheet>`);
  zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`);

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

function firstChartName(zip) {
  return Object.keys(zip.files)
    .filter((name) => /^word\/charts\/chart\d+\.xml$/.test(name))
    .sort()[0];
}

function resolveChartWorkbookPath(chartRelsXml) {
  const match = chartRelsXml.match(/Type="http:\/\/schemas.openxmlformats.org\/officeDocument\/2006\/relationships\/package" Target="\.\.\/embeddings\/([^"]+)"/);
  return match ? `word/embeddings/${match[1]}` : null;
}

async function updateExistingNativeGapRadarChart(zip, model) {
  const chartPath = firstChartName(zip);
  if (!chartPath) return false;

  const chartRelsPath = chartPath.replace('word/charts/', 'word/charts/_rels/') + '.rels';
  const chartFile = zip.file(chartPath);
  const chartRelsFile = zip.file(chartRelsPath);
  if (!chartFile || !chartRelsFile) return false;

  const workbookPath = resolveChartWorkbookPath(chartRelsFile.asText());
  if (!workbookPath || !zip.file(workbookPath)) return false;

  const rows = normalizeRadarRows(model);
  const workbookBuffer = await buildRadarWorkbook(rows);
  zip.file(chartPath, buildChartXmlFromTemplate(chartFile.asText(), rows));
  zip.file(workbookPath, workbookBuffer, { binary: true });

  return true;
}

async function injectNativeGapRadarChart(zip, model) {
  const documentPath = 'word/document.xml';
  const documentFile = zip.file(documentPath);
  if (!documentFile) return false;

  let documentXml = documentFile.asText();
  if (!documentXml.includes(GAP_RADAR_MARKER)) {
    return updateExistingNativeGapRadarChart(zip, model);
  }

  const updatedExistingChart = await updateExistingNativeGapRadarChart(zip, model);
  if (updatedExistingChart) {
    documentXml = documentXml.replace(
      /<w:p\b[\s\S]*?__NATIVE_GAP_RADAR_CHART__[\s\S]*?<\/w:p>/,
      ''
    );
    zip.file(documentPath, documentXml);
    return true;
  }

  throw new Error('DOCX_NATIVE_RADAR_TEMPLATE_MISSING: template operacional sem grafico Radar nativo.');
}

module.exports = {
  GAP_RADAR_MARKER,
  injectNativeGapRadarChart
};
