const fs = require('fs');
const path = require('path');
const {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
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

const outPath = path.resolve(__dirname, '..', 'templates', 'assessment-operational-template.docx');

const COLORS = {
  navy: '0F172A',
  blue: '2555D9',
  blueDark: '1E3A8A',
  blueLight: 'EAF0FF',
  grayText: '475569',
  grayFill: 'F8FAFC',
  grayBorder: 'CBD5E1',
  white: 'FFFFFF',
  greenLight: 'E8F7EE',
  amberLight: 'FFF7E6'
};

function run(text, options = {}) {
  return new TextRun({
    text,
    bold: Boolean(options.bold),
    italics: Boolean(options.italics),
    color: options.color || COLORS.navy,
    size: options.size || 20,
    allCaps: Boolean(options.allCaps)
  });
}

function paragraph(text, options = {}) {
  return new Paragraph({
    heading: options.heading,
    alignment: options.alignment,
    spacing: {
      before: options.before || 0,
      after: options.after == null ? 140 : options.after,
      line: options.line || 276
    },
    children: [run(text, options)]
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function cell(text, options = {}) {
  return new TableCell({
    columnSpan: options.columnSpan,
    verticalAlign: VerticalAlign.CENTER,
    shading: options.fill
      ? {
          type: ShadingType.CLEAR,
          fill: options.fill,
          color: 'auto'
        }
      : undefined,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.grayBorder },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.grayBorder },
      left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.grayBorder },
      right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.grayBorder }
    },
    children: [
      new Paragraph({
        alignment: options.alignment,
        spacing: { after: 0 },
        children: [
          run(text, {
            bold: Boolean(options.bold),
            color: options.color || COLORS.navy,
            size: options.size || 18,
            allCaps: Boolean(options.allCaps)
          })
        ]
      })
    ]
  });
}

function table(headers, loopName, fields) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((header) => cell(header, {
          bold: true,
          fill: COLORS.blue,
          color: COLORS.white,
          allCaps: true,
          size: 16,
          alignment: AlignmentType.CENTER
        }))
      }),
      new TableRow({
        children: fields.map((field, index) => {
          const prefix = index === 0 ? `{#${loopName}}` : '';
          const suffix = index === fields.length - 1 ? `{/${loopName}}` : '';
          return cell(`${prefix}{${field}}${suffix}`, { size: 16 });
        })
      })
    ]
  });
}

function section(number, title, subtitle) {
  return [
    paragraph(`${number} ${title}`, {
      heading: HeadingLevel.HEADING_1,
      bold: true,
      color: COLORS.blueDark,
      size: 28,
      before: 260,
      after: 100
    }),
    paragraph(subtitle, {
      color: COLORS.grayText,
      size: 18,
      after: 180
    })
  ];
}

function callout(title, body, fill = COLORS.blueLight) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell(title, { bold: true, fill, color: COLORS.blueDark, size: 18 }),
          cell(body, { fill, size: 18 })
        ]
      })
    ]
  });
}

const children = [
  paragraph('Assessment de Engenharia', {
    alignment: AlignmentType.CENTER,
    bold: true,
    color: COLORS.blueDark,
    size: 40,
    before: 500,
    after: 80
  }),
  paragraph('{cover_client_name}', {
    alignment: AlignmentType.CENTER,
    bold: true,
    color: COLORS.navy,
    size: 32,
    after: 180
  }),
  paragraph('Relatorio editavel gerado a partir do assessment.json validado.', {
    alignment: AlignmentType.CENTER,
    color: COLORS.grayText,
    size: 20,
    after: 300
  }),
  new Table({
    width: { size: 90, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({ children: [cell('Cliente', { bold: true, fill: COLORS.grayFill }), cell('{cover_client_name}')]}),
      new TableRow({ children: [cell('Area principal', { bold: true, fill: COLORS.grayFill }), cell('{cover_business_area}')]}),
      new TableRow({ children: [cell('Tipo de assessment', { bold: true, fill: COLORS.grayFill }), cell('{cover_assessment_type}')]}),
      new TableRow({ children: [cell('Data de geracao', { bold: true, fill: COLORS.grayFill }), cell('{cover_generated_at}')]}),
    ]
  }),
  pageBreak(),

  ...section('1.', 'Introducao', 'Contexto executivo estruturado a partir do documento importado.'),
  callout('Objetivo do documento', '{executive_current_state}'),
  paragraph('Principais pontos identificados', { heading: HeadingLevel.HEADING_2, bold: true, size: 22 }),
  paragraph('{#executive_main_pains}- {.}{/executive_main_pains}', { size: 18 }),
  callout('Maturidade geral', '{executive_overall_maturity}', COLORS.greenLight),
  callout('Evidencia utilizada', '{executive_evidence}', COLORS.amberLight),
  pageBreak(),

  ...section('2.', 'Sistemas e processos', 'Mapeamento editavel dos sistemas, processos e evidencias extraidas.'),
  paragraph('Sistemas identificados', { heading: HeadingLevel.HEADING_2, bold: true, size: 22 }),
  table(
    ['Area', 'Sistema', 'Uso', 'Dores', 'Oportunidades', 'Evidencia', 'Confianca'],
    'systems',
    ['area', 'software', 'usage', 'pain_points_text', 'opportunities_text', 'evidence', 'confidence']
  ),
  paragraph('Processos identificados', { heading: HeadingLevel.HEADING_2, bold: true, size: 22, before: 220 }),
  table(
    ['Processo', 'Area', 'Sistemas', 'Dores', 'Evidencia', 'Confianca'],
    'processes',
    ['name', 'owner_area', 'systems_text', 'pain_points_text', 'evidence', 'confidence']
  ),
  pageBreak(),

  ...section('3.', 'Gaps e riscos', 'Gaps, riscos e prioridades classificados para revisao humana.'),
  paragraph('Mapa de gaps', { heading: HeadingLevel.HEADING_2, bold: true, size: 22 }),
  table(
    ['Gap', 'Categoria', 'Impacto', 'Recomendacao', 'Evidencia', 'Status'],
    'gaps',
    ['description', 'category', 'impact', 'recommendation', 'evidence', 'status']
  ),
  paragraph('Riscos identificados', { heading: HeadingLevel.HEADING_2, bold: true, size: 22, before: 220 }),
  table(
    ['Risco', 'Probabilidade', 'Impacto', 'Mitigacao', 'Evidencia'],
    'risks',
    ['description', 'probability', 'impact', 'mitigation', 'evidence']
  ),
  pageBreak(),

  ...section('4.', 'Fluxos', 'Fluxos reconstruidos como tabela editavel para revisao e ajuste no Word.'),
  table(
    ['Fluxo', 'Tipo', 'Ordem', 'Entrada', 'Atividade', 'Responsavel', 'Saida', 'Sistema', 'Area', 'Ponto de atencao'],
    'flow_steps',
    ['flow_name', 'flow_type', 'order', 'input', 'activity', 'responsible', 'output', 'system', 'area', 'issue']
  ),
  pageBreak(),

  ...section('5.', 'Recomendacoes e roadmap', 'Plano de acao editavel baseado nos gaps e riscos evidenciados.'),
  paragraph('Recomendacoes', { heading: HeadingLevel.HEADING_2, bold: true, size: 22 }),
  table(
    ['Titulo', 'Descricao', 'Prioridade', 'Esforco', 'Status'],
    'recommendations',
    ['title', 'description', 'priority', 'effort', 'status']
  ),
  paragraph('Roadmap', { heading: HeadingLevel.HEADING_2, bold: true, size: 22, before: 220 }),
  table(
    ['Fase', 'Titulo', 'Descricao', 'Dependencias'],
    'roadmap',
    ['phase', 'title', 'description', 'dependencies_text']
  ),
  paragraph('Perguntas abertas', { heading: HeadingLevel.HEADING_2, bold: true, size: 22, before: 220 }),
  table(
    ['Pergunta', 'Topico', 'Responsavel', 'Status'],
    'open_questions',
    ['question', 'topic', 'responsible', 'status']
  )
];

const document = new Document({
  creator: 'Assessment Report Builder',
  title: 'Assessment de Engenharia',
  description: 'Template operacional limpo com placeholders dinamicos.',
  styles: {
    paragraphStyles: [
      {
        id: 'Normal',
        name: 'Normal',
        run: { size: 20, color: COLORS.navy },
        paragraph: { spacing: { after: 120, line: 276 } }
      },
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 28, bold: true, color: COLORS.blueDark },
        paragraph: { spacing: { before: 260, after: 100 } }
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 22, bold: true, color: COLORS.navy },
        paragraph: { spacing: { before: 180, after: 80 } }
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
      children
    }
  ]
});

Packer.toBuffer(document).then((buffer) => {
  fs.writeFileSync(outPath, buffer);
  console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
});
