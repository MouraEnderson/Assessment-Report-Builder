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
- grafico Radar Office nativo editavel;
- shapes/conectores Word nativos para fluxo visual resumido;
- matriz/radar de gaps editavel em tabela como apoio;
- visao horizontal de fluxo editavel em tabela como apoio, limitada a 6 etapas por fluxo;
- tabela detalhada de etapas de fluxo;
- placeholders `docxtemplater`;
- loops para listas do `assessment.json`.

## Contrato visual esperado

O relatório final esperado não pode depender de tabelas como visual principal.

As seções abaixo devem ser tratadas como mapas, fluxos ou gráficos editáveis no Word:

| Secao do relatorio | Visual esperado | Tabela permitida |
|---|---|---|
| Sistemas identificados | mapa de software/sistemas com caixas e relacoes | somente apoio/inventario |
| Processos identificados | fluxo ou mapa de processo | somente apoio/detalhe |
| Mapa de gaps | mapa visual de gaps, impactos e recomendacoes | somente apoio/auditoria |
| Radar de gaps | grafico radar visual real | matriz somente como dados de apoio |
| Riscos identificados | mapa/fluxo visual de riscos e mitigacoes | somente apoio |
| Fluxo visual resumido | fluxo AS-IS/TO-BE com caixas e conectores | nao substitui o fluxo |
| Detalhamento do fluxo | fluxo detalhado quando couber | apoio para excesso de etapas |
| Roadmap | linha do tempo/fluxo por ondas | somente apoio |

O template atual ainda nao atende esse contrato por completo. O radar nativo e o fluxo visual resumido avancaram, mas mapa de software, processos, mapa de gaps, riscos, detalhamento visual e roadmap ainda precisam sair do formato predominantemente tabelado.

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

Radar nativo:

- o template operacional contem um grafico Radar Office nativo;
- o backend atualiza o `word/charts/chart1.xml` e a planilha embutida a partir de `gap_radar`;
- DOCX local gerado pelo renderer abriu no Microsoft Word;
- Microsoft Word reconheceu 1 grafico nativo no documento (`InlineChartCount=1`).

Fluxo nativo:

- o template operacional contem shapes e conectores Word nativos para ate 2 fluxos visuais;
- cada fluxo visual mostra ate 6 etapas;
- o backend preenche os textos dos shapes via placeholders `flow_shape_*`;
- a tabela detalhada continua como apoio para todos os fluxos e etapas;
- DOCX local e DOCX vindo do endpoint local abriram no Microsoft Word;
- Microsoft Word reconheceu os shapes do fluxo no documento (`Shapes=24`).

Validacao negativa:

- um DOCX contaminado antigo foi bloqueado por `DOCX_EXPORT_TEMPLATE_LEAK`.

## Limitacoes assumidas

Este corte ainda nao tenta reproduzir todos os objetos visuais do template oficial antigo.

Ele melhora a estrutura visual limpa com capa, secoes, caixas e tabelas de apoio, mantendo a prioridade de conteudo correto e sem contaminacao.

As tabelas atuais de radar e fluxo nao sao consideradas o visual final aceito para a entrega. Elas ficam como detalhamento editavel e apoio de auditoria.

A proxima etapa visual deve reconstruir:

- mapa de software como visual editavel;
- processos identificados como fluxo/mapa editavel;
- mapa de gaps como visual editavel;
- riscos identificados como mapa/fluxo editavel;
- detalhamento de fluxo como visual quando couber;
- roadmap como linha do tempo/fluxo visual editavel;
- refinamento de capa e espacamentos com base em comparacao visual.

Essa etapa visual so deve avancar mantendo o guardrail anti-contaminacao ativo.
