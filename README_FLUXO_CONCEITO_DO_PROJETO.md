# README Fluxo Conceito do Projeto

## Objetivo

O Assessment Report Builder é um widget para 3DEXPERIENCE/3DDashboard que transforma um documento de assessment em dados estruturados, revisáveis e rastreáveis.

O fluxo desejado é:

```text
Documento DOCX do assessment
    -> importacao local ou bookmark manual
    -> extracao de texto
    -> geracao IA com Gemini
    -> assessment.json validado por schema
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
AI_MAX_INPUT_CHARS=60000
```

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
Usar Gemini para gerar assessment.json estruturado, validado por schema.
```

Status:

```text
Pronto no backend.
Pendente melhoria visual da tela principal.
```

Evidencias:

- Gemini configurado com `GEMINI_API_KEY` e `GEMINI_MODEL=gemini-2.5-flash`.
- Producao gerou `assessment.json` com `ai_extraction_status=generated`.
- Producao retornou `valid=true`.
- Teste real com DOCX XMOBOTS retornou:
  - `softwareCount=8`
  - `gapCount=6`
  - `flowCount=2`
  - `recommendationCount=10`

Pendencia desta etapa:

```text
Trocar a tela principal de JSON bruto por visao estruturada do assessment.
JSON deve ficar como modo tecnico/avancado.
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

## O Que Falta

1. Melhorar Etapa 3 visual no widget:
   - mostrar assessment estruturado;
   - esconder JSON bruto em modo avancado;
   - destacar resumo executivo, softwares, gaps, fluxos, recomendacoes e roadmap.

2. Melhorar DOCX final editavel:
   - evoluir fluxo visual editavel;
   - evoluir radar de gaps;
   - refinar capa e estilos;
   - aproximar do template oficial sem copiar conteudo fixo;
   - preservar guardrail anti-contaminacao.

3. Validar documento final no Word:
   - abrir DOCX;
   - confirmar edicao de texto;
   - confirmar edicao de tabelas;
   - confirmar edicao de fluxos/matriz;
   - confirmar que nao virou imagem.

4. Evoluir bookmark automatico:
   - somente depois de provar API oficial com WAFData.

## Proximos Passos Planejados

### PR seguinte - Fluxo visual e radar de gaps

Objetivo:

```text
Melhorar a apresentacao do fluxo e do radar sem quebrar editabilidade nem reintroduzir conteudo fixo.
```

Escopo previsto:

- melhorar `backend/report-model.js` para preparar dados visuais de fluxo;
- melhorar `backend/scripts/create-clean-operational-template.js`;
- gerar uma area visual de fluxo em tabela horizontal/editavel;
- melhorar matriz/radar de gaps com leitura executiva;
- regenerar `backend/templates/assessment-operational-template.docx`;
- validar abertura no Word;
- validar ausencia de termos herdados;
- validar exportacao no Render apos merge.

Fora do escopo deste PR:

- bookmark automatico;
- troca de provedor IA;
- grafico Office nativo complexo;
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
