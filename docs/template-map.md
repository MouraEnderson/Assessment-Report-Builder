# Mapa do Template DOCX Oficial

## Objetivo

Este documento mapeia o arquivo:

```text
backend/templates/assessment-xmobots-template.docx
```

para orientar a transformacao do exemplo preenchido em um template operacional editavel.

Este mapeamento nao altera runtime. Ele define onde o conteudo dinamico do `assessment.json` deve entrar no relatorio Word.

## Inventario tecnico do template

Dados extraidos do pacote DOCX:

| Item | Quantidade |
|---|---:|
| Paragrafos Word (`w:p`) | 514 |
| Tabelas nativas (`w:tbl`) | 3 |
| Desenhos/objetos Word (`w:drawing`) | 94 |
| Secoes Word (`w:sectPr`) | 8 |
| Midias em `word/media` | 1 |
| Graficos Office nativos em `word/charts` | 0 |

Conclusao tecnica:

- O template nao usa chart Office nativo.
- Fluxos e elementos visuais principais estao em desenhos/objetos Word.
- A geracao final deve preservar esses objetos.
- Nao e seguro concatenar XML manual dentro de `word/document.xml`.

## Estrutura editorial detectada

| Indice Word | Estilo | Texto |
|---:|---|---|
| 2 | normal | Assessment de Engenharia |
| 5 | normal | XMOBOTS - Arquitetura de Processos e Sistemas |
| 17 | Cabecalho do Sumario | Sumario |
| 52 | Titulo 1 | 1. Introducao |
| 53 | Titulo 2 | 1.1 Objetivo do Documento |
| 58 | Titulo 2 | 1.2 Metodologia Utilizada |
| 64 | Titulo 1 | 2. Visao Geral da Engenharia - XMOBOTS |
| 65 | Titulo 2 | 2.1 Estrutura Atual e Contexto de Negocio |
| 71 | Titulo 2 | 2.2 Produtos, Prototipagem e Multidisciplinaridade |
| 78 | Titulo 2 | 2.3 Ferramentas e Recursos Utilizados |
| 151 | Titulo 1 | 3. Analise de Situacao Atual |
| 152 | Titulo 2 | 3.1 Definicao da Demanda e Engenharia de Sistemas |
| 158 | Titulo 2 | 3.2 Desenvolvimento Paralelo das Engenharias |
| 203 | Titulo 2 | 3.3 Integracao MCAD-ECAD e Mecanica de Precisao |
| 208 | Titulo 2 | 3.4 Prototipagem, Validacao e Design Review |
| 213 | Titulo 2 | 3.5 EBOM, MBOM e Handoff para Manufatura |
| 219 | Titulo 2 | 3.6 Comunicacao, Armazenamento e Versionamento |
| 225 | Titulo 1 | 3.7 Gargalos e Ineficiencias Identificadas |
| 245 | Titulo 2 | 3.8 Resumo Consolidado do AS-IS |
| 248 | Titulo 1 | 4. Expectativas com as Solucoes 3DEXPERIENCE e SKACONECTOR |
| 249 | Titulo 2 | 4.1 Expectativas com 3DEXPERIENCE |
| 256 | Titulo 2 | 4.2 Expectativas com SKACONECTOR e Integracoes |
| 322 | Titulo 1 | 5. Direcionamentos e expectativas |
| 331 | Titulo 1 | 6. Proximos Passos da Jornada de Transformacao |
| 340 | desenho | Fluxo Macro AS-IS - Desenvolvimento de Produto |
| 423 | Titulo 1 | Fluxo Macro TO-BE recomendado - visao de evolucao |

## Tabelas nativas detectadas

### Tabela 1 - Leitura executiva

Texto detectado:

```text
Leitura executiva
A XMOBOTS possui engenharia tecnicamente forte...
```

Uso recomendado:

- manter como bloco de resumo executivo;
- preencher com `executive_summary.current_state`;
- complementar com `executive_summary.main_pains`;
- preservar formato de tabela nativa editavel.

Campos candidatos:

```text
client.name
client.business_area
executive_summary.current_state
executive_summary.main_pains
executive_summary.overall_maturity
executive_summary.evidence
```

### Tabela 2 - Fluxo textual AS-IS

Cabecalhos detectados:

```text
Etapa | Entrada | Atividade | Responsavel | Saida / Sistemas
```

Uso recomendado:

- transformar em bloco repetivel para `flows`;
- usar preferencialmente para fluxos `AS-IS`;
- se houver mais de um fluxo, repetir tabela por fluxo;
- se o fluxo tiver muitas etapas, quebrar por fluxo e manter tabela completa.

Campos candidatos:

```text
flows[].type
flows[].name
flows[].evidence
flows[].confidence
flows[].steps[].order
flows[].steps[].input
flows[].steps[].activity
flows[].steps[].responsible
flows[].steps[].output
flows[].steps[].system
flows[].steps[].issue
```

### Tabela 3 - Gargalos

Cabecalhos detectados:

```text
Gargalo atual | Impacto no negocio | Direcionamento
```

Uso recomendado:

- preencher a partir de `gap_map`;
- manter como tabela editavel;
- relacionar recomendacoes quando existirem.

Campos candidatos:

```text
gap_map[].description
gap_map[].impact
gap_map[].recommendation
gap_map[].evidence
gap_map[].classification
gap_map[].status
recommendations[].title
recommendations[].description
```

## Mapeamento por secao

| Secao do template | Tipo | Fonte principal | Regra de preenchimento |
|---|---|---|---|
| Capa | texto fixo + variavel | `client`, `metadata` | Substituir cliente, area, tipo e data. Preservar layout. |
| Sumario | campo Word / texto | estrutura final | Atualizar no Word quando aberto; nao manipular manualmente no MVP. |
| 1. Introducao | texto | `client`, `executive_summary`, `meeting_summary` | Gerar objetivo e metodologia a partir do contexto. |
| 1.1 Objetivo do Documento | texto | `client.assessment_scope`, `executive_summary.current_state` | Texto narrativo curto. |
| 1.2 Metodologia Utilizada | texto padrao | fixo + `input_sources` | Manter texto padrao e registrar origem do rascunho. |
| 2. Visao Geral | texto + blocos visuais | `client`, `software_map`, `process_map` | Descrever porte/contexto; listar sistemas identificados. |
| 2.3 Ferramentas e Recursos | mapa visual editavel + apoio | `software_map` | Gerar mapa de software/sistemas; tabela apenas como inventario. |
| 3. Analise de Situacao Atual | fluxos/mapas visuais + apoio | `process_map`, `flows`, `gap_map` | Consolidar AS-IS por processos e dores em objetos visuais. |
| 3.1 a 3.6 | texto dinamico | `process_map`, `flows[].steps` | Gerar subsecoes conforme evidencias. Nao inventar quando ausente. |
| 3.7 Gargalos | mapa visual de gaps/riscos + apoio | `gap_map`, `risks`, `recommendations` | Gerar mapa visual; tabela apenas como apoio auditavel. |
| 3.8 Resumo AS-IS | texto + radar visual | `executive_summary`, `gap_radar` | Consolidar maturidade e principais riscos com radar real. |
| 4. Expectativas | texto | `recommendations`, `roadmap` | Descrever expectativas e solucoes recomendadas. |
| 4.1 3DEXPERIENCE | texto/blocos | `recommendations`, `roadmap` | Relacionar recomendacoes PLM/3DX. |
| 4.2 SKACONECTOR | texto/blocos | `recommendations`, `software_map` | Usar somente quando houver evidencia de integracao. |
| 5. Direcionamentos | texto + roadmap visual editavel | `roadmap`, `recommendations`, `risks` | Apresentar ondas e principios de conducao como linha do tempo/fluxo. |
| 6. Proximos Passos | fluxo/lista visual + apoio | `roadmap`, `open_questions` | Gerar proximas acoes e pendencias; tabela so como apoio. |
| Fluxo Macro AS-IS | desenho Word + fallback tabela | `flows[type=AS-IS]` | Preservar desenho no primeiro corte; preencher tabela detalhada. |
| Fluxo Macro TO-BE | desenho Word + fallback tabela | `flows[type=TO-BE]`, `roadmap` | Preservar desenho no primeiro corte; preencher tabela detalhada. |

## Campos obrigatorios para o report_model

O `report_model` deve ser criado a partir do `assessment.json` para evitar acoplar o Word diretamente ao schema tecnico.

Campos minimos recomendados:

```json
{
  "cover": {
    "title": "",
    "client_name": "",
    "business_area": "",
    "assessment_type": "",
    "generated_at": ""
  },
  "executive": {
    "current_state": "",
    "main_pains": [],
    "overall_maturity": "",
    "evidence": ""
  },
  "systems": [],
  "processes": [],
  "gaps": [],
  "flows_as_is": [],
  "flows_to_be": [],
  "risks": [],
  "recommendations": [],
  "roadmap": [],
  "open_questions": []
}
```

## Regras para conteudo variavel

### Quando houver muitos itens

- tabelas podem repetir paginas;
- blocos visuais devem ser resumidos;
- tabela detalhada continua sendo a fonte editavel completa.

### Quando houver poucos itens

- manter a secao;
- preencher com o que foi evidenciado;
- evitar blocos vazios.

### Quando nao houver evidencia

Nao inventar. Usar:

```text
Nao evidenciado no rascunho importado.
```

ou criar item em:

```text
open_questions
```

## Estrategia de template operacional

Criar uma copia nova:

```text
backend/templates/assessment-operational-template.docx
```

Essa copia deve conter placeholders. O arquivo original deve permanecer como referencia:

```text
backend/templates/assessment-xmobots-template.docx
```

## Placeholders propostos

### Capa

```text
{{cover.title}}
{{cover.client_name}}
{{cover.business_area}}
{{cover.generated_at}}
```

### Resumo executivo

```text
{{executive.current_state}}
{{#executive.main_pains}}
- {{.}}
{{/executive.main_pains}}
```

### Software map

```text
{{#systems}}
{{software}} | {{area}} | {{usage}} | {{pain_points_text}} | {{opportunities_text}}
{{/systems}}
```

### Gaps

```text
{{#gaps}}
{{description}} | {{impact}} | {{recommendation}}
{{/gaps}}
```

### Fluxos

```text
{{#flows_as_is}}
{{name}}
{{#steps}}
{{order}} | {{area}} | {{activity}} | {{system}} | {{input}} | {{output}} | {{responsible}} | {{issue}}
{{/steps}}
{{/flows_as_is}}
```

## Itens que devem ficar fora do primeiro corte

Nao implementar no primeiro corte operacional:

- gerar shapes Word dinamicos do zero;
- atualizar conectores automaticamente;
- gerar chart Office nativo;
- manipular `document.xml` por concatenacao;
- converter fluxos para imagem.

Essa restricao vale apenas para o primeiro corte operacional ja entregue. Para a proxima fase visual, chart Office nativo e objeto Word editavel passam a ser requisito do fluxo final.

## Primeiro corte recomendado

Implementar apenas:

- placeholders de capa;
- resumo executivo;
- tabelas nativas repetiveis;
- gargalos;
- roadmap;
- fluxos em tabela editavel como apoio;
- preservacao dos desenhos existentes como referencia visual.

Validacao obrigatoria:

- `node --check`;
- teste local do endpoint;
- abrir DOCX no Microsoft Word;
- testar download no Render;
- abrir DOCX baixado do Render no Microsoft Word.

## Decisao da proxima fase visual

Para atender ao requisito de fidelidade e editabilidade no Word, a proxima fase deve gerar:

1. grafico Radar Office nativo preenchido por `gap_radar`;
2. fluxo como SmartArt/processo nativo do Word quando tecnicamente viavel;
3. fluxo como shapes/conectores Word editaveis se SmartArt OOXML nao for viavel no Render.

Status atual:

- radar Office nativo implementado no template operacional e atualizado pelo backend;
- fluxo nativo implementado como shapes/conectores Word editaveis preenchidos pelo backend;
- visual de fluxo limitado a 2 fluxos e 6 etapas por fluxo;
- tabela detalhada preserva os demais fluxos/etapas como apoio auditavel.
- mapa de software ainda esta tabelado;
- processos identificados ainda estao tabelados;
- mapa de gaps ainda esta tabelado;
- riscos identificados ainda estao tabelados;
- roadmap ainda esta tabelado.

Tabela nao substitui o fluxo visual final. Imagem estatica tambem nao atende ao requisito sem aprovacao explicita.
