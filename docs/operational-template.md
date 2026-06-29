# Template Operacional DOCX

## Arquivo ativo

```text
backend/templates/assessment-operational-template.docx
```

## Decisao atual

O template operacional ativo e um esqueleto limpo, gerado por script, sem texto especifico de cliente exemplo.

O objetivo deste corte e garantir conteudo correto antes de retomar fidelidade visual fina ao template oficial.

## Geracao reprodutivel

O arquivo binario e gerado por:

```text
backend/scripts/create-clean-operational-template.js
```

Comando:

```bash
node backend/scripts/create-clean-operational-template.js
```

## Motivo da troca

A versao anterior do template operacional preservava textos do exemplo original. Em teste real com `Quality Machines`, o DOCX final ainda continha termos herdados como:

- `XMOBOTS`
- `Altium`
- `SKACONECTOR`
- `EBOM`
- `MBOM`
- `MCAD`
- `ECAD`

Isso contaminava o relatorio de um cliente novo com narrativa de outro assessment.

## Contrato do template limpo

O DOCX ativo contem apenas:

- capa generica com faixa executiva;
- secoes genericas numeradas;
- tabelas editaveis;
- matriz/radar de gaps editavel em tabela como apoio;
- visao horizontal de fluxo editavel em tabela como apoio, limitada a 6 etapas por fluxo;
- tabela detalhada de etapas de fluxo;
- placeholders `docxtemplater`;
- loops para listas do `assessment.json`.

Nao deve conter:

- nome de cliente exemplo;
- software fixo;
- tecnologia fixa;
- fluxo fixo;
- recomendacao fixa;
- conteudo narrativo herdado do documento de referencia.

## Placeholders principais

Campos planos:

```text
{cover_client_name}
{cover_business_area}
{cover_assessment_type}
{cover_generated_at}
{executive_current_state}
{executive_overall_maturity}
{executive_evidence}
```

Loops:

```text
{#executive_main_pains}{.}{/executive_main_pains}
{#systems}...{/systems}
{#processes}...{/processes}
{#gaps}...{/gaps}
{#gap_radar}...{/gap_radar}
{#risks}...{/risks}
{#flow_visuals}...{/flow_visuals}
{#flow_steps}...{/flow_steps}
{#recommendations}...{/recommendations}
{#roadmap}...{/roadmap}
{#open_questions}...{/open_questions}
```

## Guardrail anti-contaminacao

O exportador executa uma validacao depois de renderizar o DOCX.

Se o documento final contiver termo legado do template e esse termo nao existir no `assessment.json`, a exportacao falha.

Termos vigiados neste corte:

```text
XMOBOTS
Altium
SKACONECTOR
EBOM
MBOM
MCAD
ECAD
```

Esse bloqueio evita entregar um relatorio visualmente correto, mas semanticamente contaminado.

## Validacao local registrada

Template limpo:

- nao contem `XMOBOTS`;
- nao contem `Altium`;
- nao contem `SKACONECTOR`;
- nao contem `EBOM`;
- nao contem `MBOM`;
- nao contem `MCAD`;
- nao contem `ECAD`.

Renderizacao local direta:

- DOCX gerado abriu no Microsoft Word;
- dados de cliente, resumo, sistema, gap e fluxo foram renderizados;
- nenhum placeholder operacional ficou pendente;
- nenhum termo legado apareceu.

Endpoint local `/api/assessment/export-docx`:

- retornou `200`;
- `Content-Type` correto de DOCX;
- DOCX abriu no Microsoft Word;
- conteudo renderizado: cliente, resumo executivo e gap;
- 20 tabelas editaveis no Microsoft Word;
- radar de gaps editavel renderizado com resumo executivo, score e nivel;
- fluxo visual horizontal editavel renderizado;
- tabela detalhada de fluxo preservada;
- nenhum termo legado;
- nenhum placeholder operacional.

Validacao negativa:

- um DOCX contaminado antigo foi bloqueado por `DOCX_EXPORT_TEMPLATE_LEAK`.

## Limitacoes assumidas

Este corte ainda nao tenta reproduzir todos os objetos visuais do template oficial antigo.

Ele melhora a estrutura visual limpa com capa, secoes, caixas e tabelas de apoio, mantendo a prioridade de conteudo correto e sem contaminacao.

As tabelas atuais de radar e fluxo nao sao consideradas o visual final aceito para a entrega. Elas ficam como detalhamento editavel e apoio de auditoria.

A proxima etapa visual deve reconstruir:

- grafico Radar Office nativo, editavel pelo Word;
- fluxo como objeto nativo editavel do Word, preferencialmente SmartArt/processo;
- alternativa tecnica de fluxo em shapes/conectores Word editaveis somente se SmartArt OOXML nao for viavel no Render;
- refinamento de capa e espacamentos com base em comparacao visual.

Essa etapa visual so deve avancar mantendo o guardrail anti-contaminacao ativo.
