# Direcionamento IA V2

## Decisao

A IA nao deve ser usada apenas como parser para preencher `assessment.json`.

O novo direcionamento do projeto e transformar a IA no motor consultivo do Assessment Report Builder.

O backend continua responsavel por:

- validar schema;
- preservar evidencias;
- bloquear dado invalido;
- renderizar DOCX editavel;
- impedir vazamento de conteudo de template;
- manter o link oficial e o fluxo operacional estaveis.

A IA passa a ser responsavel por:

- interpretar o rascunho importado;
- extrair fatos, hipoteses e pendencias;
- estruturar processos, sistemas, gaps, riscos e recomendacoes;
- propor fluxos AS-IS e TO-BE;
- gerar narrativa consultiva pronta para relatorio;
- construir logica de roadmap;
- sugerir perguntas abertas quando faltar evidencia;
- revisar a qualidade do proprio assessment antes da exportacao.

## Problema observado

O fluxo atual usa Gemini principalmente para gerar um `assessment.json` valido.

Depois disso, o backend transforma esse JSON em DOCX por regras deterministicas.

Esse desenho e estavel, mas limita demais o valor da IA. O resultado tende a ficar:

- estruturalmente correto;
- validavel por schema;
- editavel no Word;
- mas pobre como relatorio consultivo quando o JSON gerado vem raso.

O ajuste principal agora nao e criar mais shapes no Word. O ajuste principal e melhorar a camada de raciocinio da IA.

## Premissas

1. O documento importado continua sendo a fonte primaria de evidencia.
2. A IA nao pode inventar fatos, sistemas, processos, clientes ou tecnologias.
3. Toda conclusao consultiva precisa indicar evidencia, hipotese ou pendencia.
4. O JSON aprovado continua sendo rastreavel e revisavel.
5. O DOCX continua sendo saida editavel, nao fonte da verdade.
6. O backend nao deve aceitar sucesso visual falso.
7. Tabelas continuam como apoio/auditoria, nao como visual principal.
8. A IA deve gerar conteudo orientado ao template, nao apenas campos curtos.
9. O usuario deve conseguir revisar antes de exportar como entrega oficial.
10. Falta de informacao deve virar pergunta aberta, nao preenchimento generico.

## Arquitetura alvo

```text
DOCX importado
   -> extracao de texto
   -> IA etapa 1: extracao fiel
   -> IA etapa 2: analise consultiva
   -> IA etapa 3: report_model orientado ao template
   -> validacao de schema e qualidade
   -> revisao humana no widget
   -> exportacao DOCX editavel
```

## Papel de cada camada

### IA etapa 1 - Extracao fiel

Objetivo:

- ler o rascunho sem depender de formato;
- extrair entidades e evidencias;
- separar fato, hipotese e pendencia;
- manter trechos ou sinteses que sustentem cada item.

Saidas esperadas:

- cliente e contexto;
- participantes quando houver;
- sistemas citados;
- processos citados;
- dores relatadas;
- integracoes ou handoffs;
- riscos percebidos;
- trechos de evidencia;
- lacunas de informacao.

### IA etapa 2 - Analise consultiva

Objetivo:

- transformar dados extraidos em diagnostico;
- conectar sistemas, processos, gaps e riscos;
- identificar causa raiz;
- avaliar maturidade;
- propor direcao TO-BE quando houver base suficiente.

Saidas esperadas:

- resumo executivo;
- leitura AS-IS;
- principais gargalos;
- mapa de software com relacoes;
- fluxos AS-IS;
- fluxos TO-BE sugeridos;
- radar de maturidade com justificativa;
- riscos e mitigacoes;
- recomendacoes priorizadas.

### IA etapa 3 - Report model orientado ao template

Objetivo:

- gerar conteudo pronto para o relatorio;
- organizar blocos conforme secoes do template;
- entregar textos, mapas, fluxos e roadmap em estrutura renderizavel.

Saidas esperadas:

- `executive_narrative`;
- `section_narratives`;
- `software_network`;
- `process_flows`;
- `gap_analysis`;
- `risk_map`;
- `maturity_radar`;
- `recommendation_logic`;
- `roadmap_waves`;
- `open_questions`;
- `quality_review`.

## Mudanca de contrato proposta

O `assessment.json` atual deve continuar existindo para compatibilidade.

A evolucao deve adicionar uma camada de relatorio:

```text
assessment.json
  metadata
  client
  evidence_index
  software_map
  process_map
  gap_map
  gap_radar
  flows
  risks
  recommendations
  roadmap
  report_model
  quality_review
```

### `report_model`

Camada voltada para o DOCX.

Deve conter texto pronto e objetos estruturados para renderizacao:

- titulos;
- narrativas;
- blocos executivos;
- labels de caixas;
- relacoes entre caixas;
- fluxos detalhados;
- ondas de roadmap;
- observacoes de confianca.

### `quality_review`

Camada de revisao automatica da IA.

Deve apontar:

- itens sem evidencia;
- secoes fracas;
- recomendacoes desconectadas de gaps;
- excesso de inferencia;
- perguntas abertas obrigatorias;
- readiness do relatorio.

## Desafios tecnicos

### 1. Prompts grandes

O rascunho pode ser longo e desorganizado.

Mitigacao:

- dividir processamento em etapas;
- limitar entrada por etapa;
- resumir com preservacao de evidencias;
- registrar quando houve corte de contexto.

### 2. Alucinacao

A IA pode preencher lacunas com conhecimento generico.

Mitigacao:

- exigir evidencia por item;
- marcar inferencias como hipotese;
- bloquear recomendacao sem gap, risco ou evidencia;
- validar qualidade antes do DOCX.

### 3. Schema rigido demais

O schema atual força a IA a caber em campos tecnicos.

Mitigacao:

- manter schema atual;
- adicionar `report_model` e `quality_review`;
- nao quebrar exportacao existente;
- evoluir por PR pequeno.

### 4. Resultado visual depende de dados bons

Shapes e graficos so ficam bons se a IA gerar nos, relacoes e textos adequados.

Mitigacao:

- pedir explicitamente relacoes para mapas;
- pedir ordem e dependencias para fluxos;
- pedir scores com justificativa para radar;
- pedir roadmap conectado a gaps/recomendacoes.

### 5. Custo e tempo de IA

Multietapas podem aumentar latencia e custo.

Mitigacao:

- manter Gemini 2.5 Flash no MVP;
- cachear resultados por documento;
- permitir regenerar apenas uma secao;
- registrar tokens/tempo quando viavel.

## Etapas de implementacao

### PR IA-1 - Documentacao e contrato

Escopo:

- documentar direcao IA V2;
- definir `report_model`;
- definir `quality_review`;
- manter compatibilidade com assessments antigos;
- manter exportacao DOCX existente funcionando.

Status:

- implementado no schema como contrato opcional compativel;
- backend normaliza `report_model` e `quality_review` em novos assessments;
- Prompt V2 foi ativado nas chamadas Gemini;
- DOCX passa a consumir `report_model` quando disponivel;
- UI passa a exibir `quality_review` e `report_model` em visao estruturada.

Contrato implementado:

```text
assessment.json
  report_model
    executive_narrative
    section_narratives
    software_network
      nodes
      links
      narrative
    process_flows
    gap_analysis
    risk_map
    maturity_radar
    recommendation_logic
    roadmap_waves
    open_questions
    quality_notes
  quality_review
    readiness
    score
    summary
    blocking_issues
    warnings
    evidence_gaps
    generic_content_risk
    required_human_review
```

Validacoes registradas:

- `node --check backend/server.js`;
- schema compilado com AJV 2020;
- `/api/assessment/generate` sem Gemini retornou `valid=true`;
- resposta gerada contem `report_model` e `quality_review`;
- `/api/assessment/export-docx` aceitou assessment com contrato V2;
- DOCX exportado abriu no Microsoft Word com `Shapes=93`, `InlineChartCount=1`, `Tables=21`.

### PR IA-2 - Prompt V2 monolitico controlado

Escopo:

- substituir prompt atual por prompt consultivo V2;
- ainda gerar JSON unico;
- incluir `report_model` e `quality_review`;
- validar schema atualizado;
- manter fallback atual.

Status:

- `buildAssessmentPromptV2` implementado no backend;
- chamadas Gemini passam a usar o Prompt V2;
- prompt antigo foi mantido no arquivo como referencia, sem ser chamado;
- `appendix.ai_prompt_version` registra `v2-consultative-report-model`;
- validacao real com `GEMINI_API_KEY` em ambiente Render ainda precisa ser executada com a branch publicada;
- DOCX consome `report_model` diretamente quando o campo existe.

Risco:

- resposta grande demais ou invalida.

Validacao:

- DOCX de entrada real;
- JSON valido;
- qualidade de conteudo melhor que prompt atual;
- sem dados inventados.

### PR IA-3 - Pipeline em etapas

Escopo:

- separar chamadas:
  - extracao;
  - analise;
  - report model;
  - quality review;
- persistir resultados intermediarios;
- permitir reprocessar uma etapa.

Risco:

- maior complexidade no backend.

Validacao:

- cada etapa pode ser auditada separadamente;
- falha para na etapa correta;
- sem fallback silencioso.

Status:

- implementado como primeiro corte com chamada unica para documentos menores e pipeline por chunks para documentos maiores;
- `quality_review` da IA participa da validacao;
- exportacao DOCX e bloqueada quando `quality_review.readiness = blocked`;
- warnings de qualidade aparecem no resultado de validacao;
- ainda nao ha persistencia separada de cada etapa intermediaria;
- ainda nao ha reprocessamento isolado de uma unica secao.
- chamada unica possui limite operacional `AI_MAX_INPUT_CHARS`;
- limite provisorio atual: `140000` caracteres para testes com documentos reais maiores;
- pipeline atual aciona acima de `AI_CHUNK_PIPELINE_THRESHOLD_CHARS` e consolida evidencias extraidas por chunk;
- o pipeline atual ainda e sincrono na requisicao HTTP; job assincrono continua sendo evolucao necessaria se o Render/navegador estourar timeout;
- documento acima do limite retorna `AI_INPUT_TOO_LARGE_FOR_SINGLE_CALL`, sem corte silencioso;
- se uma etapa falhar, o backend retorna erro e nao gera relatorio parcial.

### PR IA-4 - UI de revisao inteligente

Escopo:

- esconder JSON bruto como modo avancado;
- mostrar resumo, mapas, gaps, fluxos, riscos e roadmap;
- destacar itens sem evidencia;
- permitir regenerar secao.

Risco:

- frontend ficar grande demais.

Validacao:

- usuario revisa assessment antes do DOCX;
- alteracoes continuam validando schema.

Status:

- preview principal mostra `quality_review`;
- preview principal mostra `report_model`;
- JSON bruto continua em modo tecnico/avancado;
- ainda nao ha regeneracao isolada por secao.

### PR IA-5 - Exportacao DOCX orientada ao `report_model`

Escopo:

- backend deixa de montar narrativas pobres a partir de campos curtos;
- DOCX passa a consumir textos e objetos do `report_model`;
- tabelas continuam como apoio.

Risco:

- compatibilidade com assessments antigos.

Validacao:

- assessment antigo ainda exporta;
- assessment V2 exporta com narrativa melhor;
- Word abre e objetos continuam editaveis.

Status:

- `executive_narrative` alimenta o resumo executivo;
- `software_network` alimenta mapa de softwares;
- `process_flows` alimenta processos e fluxos visuais;
- `gap_analysis` alimenta mapa de gaps;
- `maturity_radar` alimenta grafico radar;
- `risk_map` alimenta riscos;
- `recommendation_logic` alimenta recomendacoes;
- `roadmap_waves` alimenta roadmap;
- fallback para campos V1 preservado para assessments antigos.

## Criterios de aceite

Um resultado IA V2 so deve ser considerado bom quando:

- o resumo executivo parece escrito por consultor, nao por parser;
- cada gap tem evidencia ou hipotese marcada;
- mapas possuem relacoes, nao apenas lista de nomes;
- fluxos possuem entradas, atividades, saidas, sistemas e responsaveis quando evidenciados;
- radar tem justificativa por categoria;
- roadmap deriva de gaps e recomendacoes;
- perguntas abertas aparecem quando o rascunho nao sustenta uma conclusao;
- o DOCX final nao fica predominantemente tabelado;
- o documento abre no Word e permanece editavel.

## Fora do escopo imediato

- trocar Gemini por outro provedor;
- gerar DOCX diretamente pela IA;
- usar imagem estatica como entrega final;
- automatizar bookmark 3DEXPERIENCE;
- aceitar dado inventado para melhorar aparencia.

## Backup relacionado

Antes deste direcionamento foi criado o ponto:

```text
backup-before-ai-v2-direction-2026-06-30
```

Esse tag representa o estado com PR visual em andamento antes da implementacao da IA V2.
