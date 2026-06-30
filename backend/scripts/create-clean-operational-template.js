const fs = require('fs');
const path = require('path');
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageBreak,
  PageNumber,
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
  ink: '111827',
  navy: '172554',
  blue: '2555D9',
  blueDark: '1E3A8A',
  blueSoft: 'EAF0FF',
  slate: '475569',
  line: 'CBD5E1',
  fill: 'F8FAFC',
  white: 'FFFFFF',
  green: 'DCFCE7',
  amber: 'FEF3C7',
  red: 'FEE2E2',
  cyan: 'E0F2FE'
};

function run(text, options = {}) {
  return new TextRun({
    text,
    bold: Boolean(options.bold),
    italics: Boolean(options.italics),
    color: options.color || COLORS.ink,
    size: options.size || 20,
    allCaps: Boolean(options.allCaps),
    break: options.break
  });
}

function paragraph(text, options = {}) {
  return new Paragraph({
    heading: options.heading,
    alignment: options.alignment,
    spacing: {
      before: options.before || 0,
      after: options.after == null ? 120 : options.after,
      line: options.line || 276
    },
    children: [run(text, options)]
  });
}

function richParagraph(children, options = {}) {
  return new Paragraph({
    heading: options.heading,
    alignment: options.alignment,
    spacing: {
      before: options.before || 0,
      after: options.after == null ? 120 : options.after,
      line: options.line || 276
    },
    children
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function cell(text, options = {}) {
  const children = Array.isArray(text)
    ? text
    : [
        new Paragraph({
          alignment: options.alignment,
          spacing: { after: 0 },
          children: [
            run(String(text), {
              bold: Boolean(options.bold),
              color: options.color || COLORS.ink,
              size: options.size || 18,
              allCaps: Boolean(options.allCaps)
            })
          ]
        })
      ];

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
    margins: {
      top: options.tight ? 70 : 100,
      bottom: options.tight ? 70 : 100,
      left: 110,
      right: 110
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: options.border || COLORS.line },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: options.border || COLORS.line },
      left: { style: BorderStyle.SINGLE, size: 1, color: options.border || COLORS.line },
      right: { style: BorderStyle.SINGLE, size: 1, color: options.border || COLORS.line }
    },
    children
  });
}

function blockTable(rows, options = {}) {
  return new Table({
    width: { size: options.width || 100, type: WidthType.PERCENTAGE },
    alignment: options.alignment,
    layout: TableLayoutType.FIXED,
    rows
  });
}

function dataTable(headers, loopName, fields, options = {}) {
  return blockTable([
    new TableRow({
      tableHeader: true,
      children: headers.map((header) => cell(header, {
        bold: true,
        fill: options.headerFill || COLORS.blueDark,
        color: COLORS.white,
        allCaps: true,
        size: options.headerSize || 15,
        alignment: AlignmentType.CENTER
      }))
    }),
    new TableRow({
      children: fields.map((field, index) => {
        const prefix = index === 0 ? `{#${loopName}}` : '';
        const suffix = index === fields.length - 1 ? `{/${loopName}}` : '';
        return cell(`${prefix}{${field}}${suffix}`, {
          size: options.bodySize || 16,
          fill: index % 2 === 0 ? COLORS.white : COLORS.fill
        });
      })
    })
  ]);
}

function section(number, title, subtitle) {
  return [
    blockTable([
      new TableRow({
        children: [
          cell(number, {
            bold: true,
            fill: COLORS.blue,
            color: COLORS.white,
            size: 20,
            alignment: AlignmentType.CENTER
          }),
          cell(title, {
            bold: true,
            fill: COLORS.blueSoft,
            color: COLORS.blueDark,
            size: 22
          })
        ]
      }),
      new TableRow({
        children: [
          cell(subtitle, {
            columnSpan: 2,
            fill: COLORS.fill,
            color: COLORS.slate,
            size: 17
          })
        ]
      })
    ]),
    paragraph('', { after: 80 })
  ];
}

function callout(title, body, fill = COLORS.blueSoft) {
  return blockTable([
    new TableRow({
      children: [
        cell(title, {
          bold: true,
          fill,
          color: COLORS.blueDark,
          size: 18
        }),
        cell(body, {
          fill,
          size: 18
        })
      ]
    })
  ]);
}

function cover() {
  return [
    blockTable([
      new TableRow({
        children: [
          cell('ASSESSMENT DE ENGENHARIA', {
            bold: true,
            fill: COLORS.blueDark,
            color: COLORS.white,
            size: 34,
            alignment: AlignmentType.CENTER
          })
        ]
      }),
      new TableRow({
        children: [
          cell('{cover_client_name}', {
            bold: true,
            fill: COLORS.blueSoft,
            color: COLORS.navy,
            size: 30,
            alignment: AlignmentType.CENTER
          })
        ]
      }),
      new TableRow({
        children: [
          cell('Relatorio editavel gerado a partir do assessment.json validado', {
            fill: COLORS.white,
            color: COLORS.slate,
            size: 18,
            alignment: AlignmentType.CENTER
          })
        ]
      })
    ]),
    paragraph('', { after: 240 }),
    blockTable([
      new TableRow({ children: [cell('Cliente', { bold: true, fill: COLORS.fill }), cell('{cover_client_name}')] }),
      new TableRow({ children: [cell('Area principal', { bold: true, fill: COLORS.fill }), cell('{cover_business_area}')] }),
      new TableRow({ children: [cell('Tipo de assessment', { bold: true, fill: COLORS.fill }), cell('{cover_assessment_type}')] }),
      new TableRow({ children: [cell('Data de geracao', { bold: true, fill: COLORS.fill }), cell('{cover_generated_at}')] })
    ], { width: 88, alignment: AlignmentType.CENTER }),
    paragraph('', { after: 240 }),
    callout('Premissa de uso', 'O documento e editavel e deve ser revisado antes de envio oficial.', COLORS.cyan),
    pageBreak()
  ];
}

function summarySection() {
  return [
    ...section('01', 'Introducao e leitura executiva', 'Contexto consolidado somente a partir do documento importado.'),
    callout('Objetivo do documento', '{executive_current_state}', COLORS.blueSoft),
    paragraph('Principais pontos identificados', {
      heading: HeadingLevel.HEADING_2,
      bold: true,
      size: 22
    }),
    richParagraph([
      run('{#executive_main_pains}', { size: 18 }),
      run('- {.}', { size: 18 }),
      run('{/executive_main_pains}', { size: 18 })
    ]),
    callout('Maturidade geral', '{executive_overall_maturity}', COLORS.green),
    callout('Evidencia utilizada', '{executive_evidence}', COLORS.amber),
    pageBreak()
  ];
}

function systemsSection() {
  return [
    ...section('02', 'Sistemas e processos', 'Mapa editavel dos sistemas, processos, dores e evidencias extraidas.'),
    paragraph('Sistemas identificados', { heading: HeadingLevel.HEADING_2, bold: true, size: 22 }),
    dataTable(
      ['Area', 'Sistema', 'Uso', 'Dores', 'Oportunidades', 'Evidencia', 'Confianca'],
      'systems',
      ['area', 'software', 'usage', 'pain_points_text', 'opportunities_text', 'evidence', 'confidence']
    ),
    paragraph('Processos identificados', { heading: HeadingLevel.HEADING_2, bold: true, size: 22, before: 220 }),
    dataTable(
      ['Processo', 'Area', 'Sistemas', 'Dores', 'Evidencia', 'Confianca'],
      'processes',
      ['name', 'owner_area', 'systems_text', 'pain_points_text', 'evidence', 'confidence']
    ),
    pageBreak()
  ];
}

function gapSection() {
  return [
    ...section('03', 'Gaps, riscos e maturidade', 'Classificacao de gaps e matriz de maturidade editavel no Word.'),
    paragraph('Mapa de gaps', { heading: HeadingLevel.HEADING_2, bold: true, size: 22 }),
    dataTable(
      ['Gap', 'Categoria', 'Impacto', 'Recomendacao', 'Evidencia', 'Status'],
      'gaps',
      ['description', 'category', 'impact', 'recommendation', 'evidence', 'status']
    ),
    paragraph('Radar de gaps editavel', { heading: HeadingLevel.HEADING_2, bold: true, size: 22, before: 220 }),
    callout('Leitura executiva do radar', '{gap_radar_summary}', COLORS.amber),
    // Marcador de autoria: o DOCX versionado substitui este paragrafo por um grafico Radar nativo via Word.
    paragraph('{native_gap_radar_chart}', {
      alignment: AlignmentType.CENTER,
      after: 160
    }),
    dataTable(
      ['Categoria', '0', '1', '2', '3', '4', '5', 'Score', 'Nivel', 'Gaps fonte'],
      'gap_radar',
      ['category', 'level_0', 'level_1', 'level_2', 'level_3', 'level_4', 'level_5', 'score_label', 'risk_level', 'source_gaps_text'],
      { headerFill: COLORS.blue }
    ),
    paragraph('Riscos identificados', { heading: HeadingLevel.HEADING_2, bold: true, size: 22, before: 220 }),
    dataTable(
      ['Risco', 'Probabilidade', 'Impacto', 'Mitigacao', 'Evidencia'],
      'risks',
      ['description', 'probability', 'impact', 'mitigation', 'evidence'],
      { headerFill: COLORS.navy }
    ),
    pageBreak()
  ];
}

function flowSection() {
  return [
    ...section('04', 'Fluxos AS-IS e TO-BE', 'Fluxos reconstruidos como matriz editavel para revisao e ajuste.'),
    paragraph('Fluxo visual resumido', { heading: HeadingLevel.HEADING_2, bold: true, size: 22 }),
    dataTable(
      ['Fluxo', 'Tipo', 'Etapa 1', 'Etapa 2', 'Etapa 3', 'Etapa 4', 'Etapa 5', 'Etapa 6', 'Observacao'],
      'flow_visuals',
      ['flow_name', 'flow_type', 'step_1', 'step_2', 'step_3', 'step_4', 'step_5', 'step_6', 'overflow_note'],
      { headerFill: COLORS.blue, bodySize: 14 }
    ),
    paragraph('Detalhamento do fluxo', { heading: HeadingLevel.HEADING_2, bold: true, size: 22, before: 220 }),
    dataTable(
      ['Fluxo', 'Tipo', 'Ordem', 'Entrada', 'Atividade', 'Responsavel', 'Saida', 'Sistema', 'Area', 'Ponto de atencao'],
      'flow_steps',
      ['flow_name', 'flow_type', 'order', 'input', 'activity', 'responsible', 'output', 'system', 'area', 'issue'],
      { headerFill: COLORS.blueDark, bodySize: 15 }
    ),
    pageBreak()
  ];
}

function roadmapSection() {
  return [
    ...section('05', 'Recomendacoes e roadmap', 'Plano de acao editavel baseado nos gaps, riscos e evidencias.'),
    paragraph('Recomendacoes', { heading: HeadingLevel.HEADING_2, bold: true, size: 22 }),
    dataTable(
      ['Titulo', 'Descricao', 'Prioridade', 'Esforco', 'Status'],
      'recommendations',
      ['title', 'description', 'priority', 'effort', 'status']
    ),
    paragraph('Roadmap', { heading: HeadingLevel.HEADING_2, bold: true, size: 22, before: 220 }),
    dataTable(
      ['Fase', 'Titulo', 'Descricao', 'Dependencias'],
      'roadmap',
      ['phase', 'title', 'description', 'dependencies_text'],
      { headerFill: COLORS.navy }
    ),
    paragraph('Perguntas abertas', { heading: HeadingLevel.HEADING_2, bold: true, size: 22, before: 220 }),
    dataTable(
      ['Pergunta', 'Topico', 'Responsavel', 'Status'],
      'open_questions',
      ['question', 'topic', 'responsible', 'status'],
      { headerFill: COLORS.blue }
    )
  ];
}

const children = [
  ...cover(),
  ...summarySection(),
  ...systemsSection(),
  ...gapSection(),
  ...flowSection(),
  ...roadmapSection()
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
        run: { size: 20, color: COLORS.ink },
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
        run: { size: 22, bold: true, color: COLORS.ink },
        paragraph: { spacing: { before: 180, after: 80 } }
      }
    ]
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: 760,
            right: 620,
            bottom: 760,
            left: 620
          }
        }
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                run('Assessment Report Builder | Pagina ', { size: 16, color: COLORS.slate }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: COLORS.slate })
              ]
            })
          ]
        })
      },
      children
    }
  ]
});

Packer.toBuffer(document).then((buffer) => {
  fs.writeFileSync(outPath, buffer);
  console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
});
