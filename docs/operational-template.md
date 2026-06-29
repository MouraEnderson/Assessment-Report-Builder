# Template Operacional DOCX

## Arquivo

```text
backend/templates/assessment-operational-template.docx
```

## Origem

Criado como copia controlada de:

```text
backend/templates/assessment-xmobots-template.docx
```

O template original permanece preservado como referencia.

## Objetivo deste corte

Preparar uma primeira versao operacional do template Word com placeholders, sem alterar o runtime de exportacao ainda.

Este corte valida apenas:

- o arquivo abre no Microsoft Word;
- o padrao visual base e preservado;
- os desenhos/objetos Word continuam presentes;
- existem placeholders minimos para futura renderizacao com engine de template.

## Inventario validado

| Item | Resultado |
|---|---:|
| Arquivo abre no Microsoft Word | sim |
| Tabelas nativas | 3 |
| Desenhos/objetos Word | 94 |
| Secoes Word | 8 |
| Midias | 1 |
| Placeholder de capa | sim |
| Placeholder de resumo executivo | sim |
| Loop de etapas de fluxo | sim |
| Loop de gaps | sim |

## Placeholders inseridos

### Capa e textos globais

```text
{cover.client_name}
```

Uso previsto:

- substituir o cliente do exemplo;
- manter o layout visual do template;
- preencher titulo e mencoes principais ao cliente.

### Tabela 1 - Leitura executiva

```text
Leitura executiva
{executive.current_state}
{#executive.main_pains}
- {.}
{/executive.main_pains}
Maturidade: {executive.overall_maturity}
```

Fonte prevista:

```text
executive_summary.current_state
executive_summary.main_pains
executive_summary.overall_maturity
```

### Tabela 2 - Etapas de fluxo

Linha repetivel:

```text
{#flow_steps}{order}
{input}
{activity}
{responsible}
{output} / {system}{/flow_steps}
```

Fonte prevista:

```text
report_model.flow_steps[]
```

Observacao:

O primeiro corte usa uma lista achatada de etapas para reduzir complexidade. A origem pode vir de multiplos fluxos em `assessment.flows[]`, mas o `report_model` deve preparar a lista final.

### Tabela 3 - Gargalos

Linha repetivel:

```text
{#gaps}{description}
{impact}
{recommendation}{/gaps}
```

Fonte prevista:

```text
report_model.gaps[]
```

## Decisoes tecnicas

- O template usa sintaxe de placeholder compativel com `docxtemplater`.
- Os desenhos Word existentes foram preservados.
- Shapes e conectores dinamicos nao foram tratados neste corte.
- O runtime ainda nao usa este arquivo.
- Nenhum XML manual foi injetado no exportador.

## Limitacoes conhecidas

- O template operacional ainda precisa ser testado com a engine final.
- Loops dentro de tabelas precisam ser confirmados com `docxtemplater`.
- A secao visual de fluxos ainda e referencia visual, nao geracao dinamica.
- O sumario ainda nao e atualizado automaticamente.

## Validacao com engine DOCX

Primeira validacao local com `docxtemplater`:

| Item | Resultado |
|---|---:|
| DOCX renderizado abre no Microsoft Word | sim |
| Tabelas nativas preservadas | 3 |
| Desenhos/objetos Word preservados | 94 |
| Secoes Word preservadas | 8 |
| Midias preservadas | 1 |
| Placeholder de cliente substituido | sim |
| Resumo executivo substituido | sim |
| Loop de dores principais renderizado | sim |
| Loop de etapas de fluxo renderizado | sim |
| Loop de gaps renderizado | sim |
| Placeholders pendentes no XML principal | nao |

Observacao:

- Placeholders com ponto, como `{cover.client_name}`, foram substituidos por aliases planos, como `{cover_client_name}`, porque os campos simples renderizaram com mais previsibilidade nesse template Word.
- O runtime de exportacao ainda nao usa este renderizador.

## Proximo passo

Integrar o renderizador ao endpoint de exportacao somente depois de revisar o corte e manter estes criterios:

- o DOCX renderizado abrir no Microsoft Word;
- placeholders serem substituidos corretamente;
- loops repetirem linhas de tabela;
- os 94 desenhos continuarem preservados.
