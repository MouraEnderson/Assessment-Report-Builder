# README Fluxo Conceito do Projeto

## Objetivo

O Assessment Report Builder é um widget para 3DEXPERIENCE/3DDashboard que transforma um documento de assessment em dados estruturados, revisáveis e rastreáveis.

O fluxo desejado é:

```text
Documento DOCX do assessment
    -> importacao local ou bookmark manual
    -> extracao de texto
    -> IA V2 com Gemini: extracao fiel + analise consultiva + report_model
    -> assessment.json/report_model validado por schema e qualidade
    -> revisao humana
    -> relatorio DOCX editavel baseado em template
```

O projeto nao deve apresentar dado simulado como fato. Se uma etapa falhar, o erro deve aparecer como diagnostico real.

## Link Operacional

```text
https://assessment-report-builder.onrender.com/
```

Esse é o link oficial para usar como 3DDashboard Additional App.

Nao usar como link oficial:

```text
https://assessment-report-builder.onrender.com/?v=...
https://assessment-report-builder.onrender.com/index.html
https://assessment-report-builder.onrender.com/frontend/index.html
```

## Ideia Central

O usuario tem um assessment em DOCX, local ou baixado manualmente de uma bookmark do 3DEXPERIENCE.

O widget importa esse arquivo, extrai o texto, preserva a origem e chama o backend Render. O backend usa IA para estruturar o conteudo no contrato oficial `assessment.json`. Esse JSON é a fonte da verdade para revisao e futura geracao de DOCX final editavel.

## Direcionamento IA V2

A IA passa a ser tratada como motor consultivo do projeto, nao apenas como parser para JSON.

O backend deve continuar validando schema, bloqueando erro real e renderizando DOCX editavel. A IA deve gerar a inteligencia do assessment:

- extracao fiel de fatos, hipoteses e pendencias;
- analise consultiva de processos, sistemas, gaps e riscos;
- narrativas prontas para relatorio;
- mapas, fluxos, radar e roadmap como estruturas renderizaveis;
- perguntas abertas quando faltar evidencia;
- revisao de qualidade antes da exportacao.

O `assessment.json` continua sendo a fonte rastreavel para revisao. A evolucao IA V2 adiciona uma camada `report_model` orientada ao template e uma camada `quality_review` para bloquear relatorio fraco, generico ou sem evidencia.

Documento de direcao:

```text
docs/AI_V2_DIRECTION.md
```

## Arquitetura

```text
3DEXPERIENCE / 3DDashboard Additional App
    -> https://assessment-report-builder.onrender.com/
    -> frontend/widget.html
    -> frontend/assets/css/assessment.css
    -> frontend/assets/js/assessment-runtime.js
    -> backend/server.js no Render
    -> backend/schemas/assessment.schema.json
    -> Gemini API quando GEMINI_API_KEY existe
```

## Fronteira de Autenticacao

```text
Sessao 3DEXPERIENCE: somente no frontend/widget.
Render: processamento, validacao, IA e geracao futura de DOCX.
Render nao executa CAS.
Render nao recebe credenciais 3DEXPERIENCE.
Render nao usa cookie 3DEXPERIENCE.
```

Bookmark automatico via WAFData ainda nao esta implementado. O fluxo atual e provado é bookmark manual: o usuario seleciona ou baixa o documento e importa no widget, registrando a origem.

## Variaveis Render

```text
NODE_ENV=production
PORT=10000
SERVICE_VERSION=0.4.3
GEMINI_API_KEY=<chave real do Gemini>
GEMINI_MODEL=gemini-2.5-flash
```

Variavel opcional:

```text
AI_MAX_INPUT_CHARS=140000
AI_GENERATION_TIMEOUT_MS=110000
AI_CHUNK_PIPELINE_THRESHOLD_CHARS=45000
AI_CHUNK_INPUT_CHARS=16000
AI_CHUNK_CONCURRENCY=2
```

Premissa operacional atual:

- A importacao IA aceita ate `AI_MAX_INPUT_CHARS`.
- A geracao em chamada unica fica preservada para documentos menores.
- Documentos acima de `AI_CHUNK_PIPELINE_THRESHOLD_CHARS` usam pipeline IA por chunks.
- Cada chunk usa ate `AI_CHUNK_INPUT_CHARS` caracteres e a consolidacao final gera o assessment oficial validado.
- O pacote de consolidacao final usa evidencias compactadas para reduzir timeout sem cortar o documento de entrada.
- O limite atual de `140000` caracteres e provisorio para viabilizar testes com documentos reais maiores.
- Documento acima desse limite deve parar com `AI_INPUT_TOO_LARGE_FOR_SINGLE_CALL`.
- Nao e permitido cortar silenciosamente o documento para gerar relatorio parcial.
- Se o pipeline falhar em qualquer etapa, a aplicacao deve retornar erro tecnico honesto e nao gerar relatorio parcial.

## Backup de Seguranca

Antes da proxima evolucao de fluxo visual e radar de gaps, foi criado um ponto de retorno no estado atual de producao.

```text
Commit: 199797f05ad8e858445f80832859378ab17abd00
Branch: codex/backup-before-flow-radar-2026-06-29
Tag: backup-before-flow-radar-2026-06-29
```

Esse backup representa o estado em que:

- o Render exporta DOCX editavel;
- o template operacional limpo esta ativo;
- o guardrail anti-contaminacao esta ativo;
- o DOCX nao carrega texto herdado de XMOBOTS/Altium/SKACONECTOR/MCAD/ECAD quando esses termos nao existem no assessment;
- o radar de gaps existe como matriz editavel em tabela;
- o fluxo existe como tabela editavel.

Antes da evolucao IA V2, foi criado outro ponto de retorno:

```text
Tag: backup-before-ai-v2-direction-2026-06-30
Branch atual: codex/visual-flow-radar-docx
```

Esse backup representa o estado com PR visual em andamento antes da mudanca de direcao da IA.

## Premissas Atuais

1. O `assessment.json` e a fonte da verdade.
2. O documento DOCX importado e insumo, nao template de saida.
3. A IA deve estruturar informacao a partir de evidencia do documento importado.
4. O template de saida nao pode conter narrativa fixa de cliente exemplo.
5. Se o dado nao estiver evidenciado, o sistema deve registrar pendencia, hipotese, baixa confianca ou pergunta aberta.
6. O DOCX final precisa ser editavel no Word.
7. Fluxos, tabelas e radar precisam ser editaveis; imagem estatica so deve ser aceita se houver decisao explicita.
8. O guardrail anti-contaminacao nao deve ser removido para melhorar visual.
9. O link oficial permanece `https://assessment-report-builder.onrender.com/`.
10. Render nao recebe credenciais, CAS ou cookies 3DEXPERIENCE.
11. A IA V2 deve atuar como motor consultivo, nao apenas parser de JSON.
12. A IA V2 deve gerar `report_model` orientado ao template.
13. A IA V2 deve gerar `quality_review` para apontar falta de evidencia, excesso de inferencia e secoes fracas.
14. O backend continua responsavel por validar, bloquear erro e renderizar DOCX; a IA nao gera DOCX diretamente.

## Etapas do Projeto

### Etapa 0 - Base oficial e deploy

Objetivo:

```text
Manter link oficial estavel, backend Render, frontend Additional App e CI.
```

Status:

```text
Pronto.
```

Evidencias:

- `GET /version` em producao retorna `version: 0.4.3`.
- CI GitHub passou com build Docker.
- Render serve `/`, `/version`, assets e API.

### Etapa 1 - Layout inicial

Objetivo:

```text
Reduzir cabecalho/hero e compactar contexto do assessment.
```

Status:

```text
Pronto.
```

Evidencias:

- Hero foi compactado.
- Bloco da Etapa 1 foi reduzido.
- Validacao local desktop/mobile confirmou ausencia de overflow relevante.
- CI passou.

### Etapa 2 - Importacao DOCX

Objetivo:

```text
Remover transcricao colada como fluxo principal e permitir importacao DOCX local ou bookmark manual.
```

Status:

```text
Pronto.
```

Evidencias:

- `POST /api/assessment/import-docx` implementado.
- Arquivo `.docx` real `Assessment_Engenharia_Xmobots_.docx` foi importado.
- Producao extraiu 19.598 caracteres e 2.691 palavras do arquivo XMOBOTS.
- Arquivo `.txt` foi rejeitado com erro `DOCX_FILE_REQUIRED`.
- Origem `local_upload` e `bookmark_manual` sao preservadas.
- CI passou com Docker build usando `npm ci`.

### Etapa 3 - Geracao IA do assessment

Objetivo:

```text
V1: usar Gemini para gerar assessment.json estruturado, validado por schema.
V2: usar Gemini como motor consultivo para gerar extracao fiel, analise, report_model e quality_review.
```

Status:

```text
V1 pronto no backend.
V2 contrato inicial implementado no schema/backend.
Prompt V2 consultivo implementado no backend e usado nas chamadas Gemini.
Validacao real com GEMINI_API_KEY no Render pendente.
Tela principal exibe quality_review e report_model.
Exportacao DOCX consome report_model quando disponivel.
```

Evidencias:

- Gemini configurado com `GEMINI_API_KEY` e `GEMINI_MODEL=gemini-2.5-flash`.
- Producao gerou `assessment.json` com `ai_extraction_status=generated`.
- Producao retornou `valid=true`.
- Schema IA V2 aceita `report_model` e `quality_review`.
- Backend normaliza `report_model` e `quality_review` para novos assessments.
- Backend possui `buildAssessmentPromptV2`.
- Gemini passa a usar Prompt V2 consultivo.
- Validacao retorna warnings derivados de `quality_review`.
- Exportacao DOCX bloqueia assessment com `quality_review.readiness=blocked`.
- Widget mostra revisao estruturada de `quality_review` e `report_model`.
- DOCX usa `report_model` para narrativa, mapa de software, processos, fluxos, gaps, radar, riscos, recomendacoes e roadmap.
- `/api/assessment/generate` local sem Gemini retornou `valid=true` com contrato V2.
- `/api/assessment/export-docx` local aceitou assessment com contrato V2 e gerou DOCX Word valido.
- Teste real com DOCX XMOBOTS retornou:
  - `softwareCount=8`
  - `gapCount=6`
  - `flowCount=2`
  - `recommendationCount=10`

Pendencia desta etapa:

```text
Validar Prompt V2 com Gemini real apos deploy da branch.
Avaliar se sera necessario dividir Gemini em chamadas fisicas separadas para extracao, analise, report_model e quality_review.
Implementar regeneracao isolada por secao somente se a validacao real justificar.
```

### Etapa 4 - Template e DOCX final editavel

Objetivo:

```text
Gerar documento DOCX final editavel, limpo e baseado no assessment.json validado.
```

Status:

```text
Implementado parcialmente, com conteudo limpo e guardrail ativo.
```

Pronto neste corte:

- Endpoint `POST /api/assessment/export-docx`.
- Exportacao DOCX a partir de `assessment.json` validado.
- Template operacional limpo gerado por script.
- Guardrail anti-contaminacao contra termos herdados do exemplo antigo.
- Texto nativo editavel.
- Tabelas nativas editaveis para softwares, processos, gaps, radar, fluxos, riscos, recomendacoes, roadmap e perguntas abertas.
- Radar de gaps em matriz editavel.
- Fluxo em tabela editavel.
- Botao `Exportar DOCX` no widget.
- Renderizacao via `docxtemplater`, sem injecao manual de XML.
- Script reprodutivel do template: `backend/scripts/create-clean-operational-template.js`.

Ainda falta:

- Melhorar o fluxo visual para ficar mais proximo do template oficial, mantendo editabilidade.
- Melhorar o radar de gaps para leitura executiva mais forte.
- Avaliar grafico Office nativo editavel se a matriz em tabela nao for suficiente.
- Refinar capa, espacamentos e estilos.
- Validar com documentos reais de segmentos diferentes.

Observacao sobre o template XMOBOTS:

- O DOCX analisado contem 3 tabelas nativas.
- O DOCX contem 94 objetos/desenhos Word.
- Nao foram encontrados graficos Office nativos em `word/charts`.
- Existe 1 arquivo em `word/media`.

Esse arquivo continua como referencia visual, mas nao e mais usado como base direta de exportacao porque continha narrativa especifica do cliente exemplo.

### Etapa 5 - Bookmark automatico 3DEXPERIENCE

Objetivo:

```text
Ler documentos diretamente via sessao 3DEXPERIENCE/WAFData.
```

Status:

```text
Nao implementado.
```

Condicao para avancar:

- Provar API/endpoint oficial para localizar e baixar documento de bookmark.
- Usar WAFData no frontend.
- Nao enviar credenciais 3DEXPERIENCE ao Render.
- Se falhar, mostrar erro real.

## Endpoints Atuais

```text
GET  /
GET  /widget.html
GET  /assets/css/assessment.css
GET  /assets/js/assessment-runtime.js
GET  /health
GET  /version
GET  /api/health
GET  /api/assessment/schema
POST /api/assessment/import-docx
POST /api/assessment/generate
POST /api/assessment/validate
POST /api/assessment/export-docx
```

## Fonte da Verdade

```text
DOCX importado = insumo
Texto extraido = base operacional para IA
assessment.json = fonte da verdade estruturada
Template = apresentacao
DOCX final = saida editavel
PDF = saida de leitura futura
```

## Testes Realizados

### Local

- `node --check backend/server.js`
- `node --check backend/report-model.js`
- `node --check backend/docx-template-renderer.js`
- `node --check backend/scripts/create-clean-operational-template.js`
- `node --check frontend/assets/js/assessment-runtime.js`
- Schema compilado com AJV 2020.
- `/api/assessment/generate` local sem `GEMINI_API_KEY` retornou `valid=true`.
- `/api/assessment/validate` aceitou assessment V2 com `report_model` e `quality_review`.
- `/api/assessment/export-docx` bloqueou exportacao com `quality_review.readiness=blocked` retornando `422 ASSESSMENT_QUALITY_BLOCKED`.
- `/api/assessment/export-docx` gerou DOCX contendo marcadores exclusivos vindos de `report_model`.
- DOCX local abriu no Microsoft Word com `Tables=21`, `Shapes=93`, `InlineShapes=1`.
- Estrutura DOCX contem `word/charts/chart1.xml`, preservando grafico Office nativo.
- Renderer DOCX ajustado para reduzir tabelas principais, remover shapes visuais vazias, corrigir bullets do resumo executivo e interpretar baixa maturidade no radar como criticidade.
- `npm audit --omit=dev`
- `git diff --check`
- Importacao do DOCX XMOBOTS.
- Geracao local sem `GEMINI_API_KEY`, mantendo `ai_extraction_status=not_implemented`.
- Validacao de UI sem texto `Loading`.

### CI GitHub

- Checkout.
- Setup Node.js.
- Instalacao backend.
- Check backend syntax.
- Docker build.

### Producao Render

- `/version` retornando `0.4.3`.
- `/api/assessment/import-docx` importando DOCX real.
- `/api/assessment/generate` chamando Gemini real.
- Resultado IA validado contra schema.
- `/api/assessment/export-docx` retornando DOCX Word valido.
- DOCX de producao abre no Microsoft Word.
- DOCX de producao renderiza cliente, resumo, gaps, radar e fluxos.
- DOCX de producao nao contem termos herdados do template quando nao existem no assessment.
- DOCX local validado com grafico Radar Office nativo reconhecido pelo Word como chart (`InlineChartCount=1`).
- DOCX local e endpoint local validados com fluxo em shapes/conectores nativos do Word (`Shapes=24`).
- DOCX local e endpoint local validados com mapa de software e mapa de processos em shapes/conectores nativos do Word (`Shapes=49`, `InlineChartCount=1`).
- DOCX local e endpoint local validados com mapa de gaps, riscos e roadmap em shapes/conectores nativos do Word (`Shapes=78`, `InlineChartCount=1`).
- DOCX vindo do endpoint local validado com detalhamento de fluxo em shapes/conectores nativos do Word (`Shapes=93`, `InlineChartCount=1`).

## Decisoes Tecnicas

- O MVP aceita `.docx`, nao `.doc` legado.
- O provedor de IA do MVP é Gemini API.
- Modelo atual: `gemini-2.5-flash`.
- O template de saida atual e limpo e gerado por script.
- O template XMOBOTS e referencia visual, nao base operacional direta.
- O exportador bloqueia vazamento de termos herdados por `DOCX_EXPORT_TEMPLATE_LEAK`.
- O backend nao faz CAS.
- O widget nao usa iframe.
- O link oficial nao muda.
- O fluxo atual de bookmark é manual.
- Nao ha fallback silencioso para dados fake.
- Fluxos e radar de gaps devem ser objetos nativos editaveis do Word quando usados como entrega visual final.
- Tabelas de fluxo/radar ficam apenas como detalhamento de dados e fallback de auditoria, nao como visual final aceito.
- PNG, SVG ou imagem estatica nao atendem ao requisito final de editabilidade sem decisao explicita.
- O relatorio final nao pode ficar predominantemente tabelado. Mapas, fluxos, radar, riscos e roadmap precisam ter representacao visual editavel no Word.
- `software_map`, `process_map`, `gap_map`, `risks`, `flows` e `roadmap` precisam alimentar objetos visuais, mantendo tabelas apenas como apoio/auditoria.

## O Que Falta

1. Melhorar Etapa 3 visual no widget:
   - mostrar assessment estruturado;
   - esconder JSON bruto em modo avancado;
   - destacar resumo executivo, softwares, gaps, fluxos, recomendacoes e roadmap.

2. Melhorar DOCX final editavel:
   - fluxo visual em shapes/conectores nativos do Word implementado no template operacional;
   - radar de gaps em grafico Office nativo editavel implementado no template operacional;
   - mapa de software em shapes/conectores nativos do Word implementado no template operacional;
   - processos identificados em shapes/conectores nativos do Word implementados no template operacional;
   - mapa de gaps em shapes/conectores nativos do Word implementado no template operacional;
   - riscos identificados em shapes/conectores nativos do Word implementados no template operacional;
   - roadmap em shapes/conectores nativos do Word implementado no template operacional;
   - detalhamento do fluxo em shapes/conectores nativos do Word implementado no template operacional;
   - refinar capa e estilos;
   - aproximar do template oficial sem copiar conteudo fixo;
   - preservar guardrail anti-contaminacao.

3. Validar documento final no Word:
   - abrir DOCX;
   - confirmar edicao de texto;
   - confirmar edicao de tabelas;
   - confirmar edicao do grafico radar via ferramenta nativa do Word;
   - confirmar edicao do fluxo como objeto nativo do Word;
   - confirmar que fluxo/radar nao viraram imagem.

4. Evoluir bookmark automatico:
   - somente depois de provar API oficial com WAFData.

## Proximos Passos Planejados

### PR seguinte - Objetos nativos Word para fluxo e radar

Objetivo:

```text
Gerar fluxo e radar como objetos nativos editaveis do Word sem quebrar o template limpo nem reintroduzir conteudo fixo.
```

Escopo previsto:

- manter `backend/report-model.js` como fonte estruturada de dados;
- atualizar grafico Radar Office nativo existente no template a partir de `gap_radar`;
- preencher fluxo em shapes/conectores Word editaveis existentes no template;
- preencher mapa de software e mapa de processos em shapes/conectores Word editaveis existentes no template;
- preencher mapa de gaps, riscos e roadmap em shapes/conectores Word editaveis existentes no template;
- preencher detalhamento de fluxo em shapes/conectores Word editaveis existentes no template;
- substituir secoes principais ainda tabeladas por mapas/fluxos/roadmap visuais editaveis;
- manter tabelas apenas como detalhe/auditoria, nao como visual principal;
- regenerar `backend/templates/assessment-operational-template.docx`;
- validar abertura no Word;
- validar edicao do grafico radar no Word;
- validar edicao do fluxo no Word;
- validar ausencia de termos herdados;
- validar exportacao no Render apos merge.

Fora do escopo deste PR:

- bookmark automatico;
- troca de provedor IA;
- reuso direto dos shapes do DOCX XMOBOTS;
- mudanca do link oficial.

## Regra de Estabilidade

Cada etapa deve ser entregue em patch pequeno e validavel.

Nao misturar no mesmo patch:

```text
layout
importacao
IA
schema
DOCX final
bookmark automatico
```

Se uma etapa falhar, o sistema deve exibir diagnostico real e parar naquela etapa.
