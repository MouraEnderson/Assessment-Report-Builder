# Estrategia do Template DOCX Oficial

## Estado atual

O projeto ja possui um fluxo funcional para:

- importar arquivo `.docx` livre;
- extrair texto do documento;
- gerar `assessment.json` com Gemini;
- normalizar e validar o JSON contra o schema oficial;
- exportar JSON;
- exportar DOCX baseado no arquivo oficial XMOBOTS;
- preservar um DOCX que abre no Microsoft Word.

O hotfix atual prioriza compatibilidade com Word. O arquivo exportado usa o template oficial como base e preserva sua estrutura, mas ainda nao injeta todo o conteudo gerado dentro das secoes do template.

## Problema a resolver

O arquivo importado pelo usuario nao tem padrao fixo. Ele pode conter anotacoes soltas, transcricao parcial, diagnostico tecnico, resumo executivo, lista de sistemas, dores, processos ou fluxos em formatos totalmente diferentes.

Por isso, o template nao pode pressupor um fluxo unico. O correto e:

```text
entrada livre
-> assessment.json normalizado
-> modelo de relatorio
-> template Word operacional
-> DOCX final editavel
```

## Objetivo

Gerar um DOCX final que seja:

- fiel ao padrao visual do template fornecido;
- editavel no Microsoft Word;
- adaptavel a assessments pequenos ou grandes;
- validado tecnicamente antes de chegar ao usuario;
- sem XML manual fragil que corrompa o arquivo.

## O que "fiel ao template" significa

Fiel ao template significa preservar:

- capa;
- cabecalho e rodape;
- estilos;
- cores;
- organizacao editorial;
- secoes principais;
- elementos visuais reutilizaveis;
- identidade visual do documento;
- comportamento de abertura no Word.

Nao significa copiar pixel a pixel o exemplo preenchido, porque o conteudo real varia conforme o cliente e o assessment.

## O que deve ser fixo

O template deve definir a estrutura editorial:

```text
1. Introducao
2. Contexto e visao geral
3. Situacao atual AS-IS
4. Sistemas, processos e integracoes
5. Gaps e riscos
6. Expectativas e recomendacoes
7. Fluxos identificados
8. Roadmap e proximos passos
9. Perguntas abertas e pendencias
```

Essas secoes podem existir mesmo quando alguma delas tenha pouca informacao. Nesse caso, o relatorio deve mostrar pendencias ou perguntas abertas, nao inventar conteudo.

## O que deve ser dinamico

O conteudo abaixo deve variar conforme o `assessment.json`:

- `software_map`: 0..N sistemas;
- `process_map`: 0..N processos;
- `gap_map`: 0..N gaps;
- `gap_radar`: 0..N categorias;
- `flows`: 0..N fluxos;
- `flows[].steps`: 0..N etapas;
- `risks`: 0..N riscos;
- `recommendations`: 0..N recomendacoes;
- `roadmap`: 0..N ondas/fases;
- `open_questions`: 0..N perguntas.

## Arquitetura recomendada

### 1. Assessment JSON

Fonte tecnica da verdade. Deve continuar sendo validado pelo schema oficial antes de qualquer exportacao.

### 2. Report model

Camada intermediaria entre o JSON tecnico e o Word. Ela deve transformar dados tecnicos em blocos editoriais.

Exemplo conceitual:

```json
{
  "cover": {},
  "executive_summary": {},
  "sections": [],
  "flow_blocks": [],
  "tables": [],
  "open_questions": []
}
```

### 3. Template Word operacional

O DOCX exemplo precisa ser convertido em template operacional com placeholders e blocos repetiveis.

Exemplos:

```text
{{client.name}}
{{executive_summary.current_state}}
{{#software_map}}
{{software}} - {{usage}}
{{/software_map}}
```

### 4. Renderizador DOCX

O renderizador deve preencher o template sem quebrar o pacote Word.

Recomendacao tecnica:

```text
docxtemplater + pizzip
```

Motivo:

- trabalha com template DOCX existente;
- preserva layout;
- suporta placeholders;
- suporta repeticao de blocos;
- e mais seguro que concatenar XML manual.

## Estrategia para fluxos

Fluxos nao devem ser predefinidos. O template deve ter uma secao de fluxos com blocos repetiveis.

### Nivel 1 - Confiavel

Tabela editavel por fluxo:

```text
Ordem | Area | Atividade | Sistema | Entrada | Saida | Responsavel | Problema
```

Esse nivel suporta qualquer numero de fluxos e etapas.

### Nivel 2 - Visual simples

Bloco visual editavel com ate 5 ou 6 etapas por linha. Se passar disso, quebrar em nova linha ou manter apenas tabela detalhada.

### Nivel 3 - Avancado

Shapes/conectores Word dinamicos. Deve ser tratado somente depois que o nivel 1 estiver confiavel e validado no Word.

## Estrategia para grafico/radar de gaps

Primeiro corte confiavel:

- tabela/matriz editavel de gaps;
- score 0-5;
- categorias dinamicas.

Grafico Office nativo deve ser etapa posterior, porque exige atualizar partes OOXML de chart com seguranca.

## Plano de execucao

### Fase 0 - Backup e congelamento

Status: concluido.

Backup criado:

```text
branch: codex/backup-word-compatible-2026-06-29
tag: word-compatible-baseline-2026-06-29
commit: 38c87b26f2e2e298af0cca377560b9419334030b
```

Esse ponto representa o estado em que:

- importacao funciona;
- geracao JSON funciona;
- DOCX baixa;
- DOCX abre no Word;
- template oficial e preservado.

### Fase 1 - Mapear o template

Objetivo:

- identificar todas as secoes do DOCX oficial;
- separar texto fixo, texto variavel, tabelas, shapes e blocos repetiveis;
- produzir uma matriz de mapeamento entre template e `assessment.json`.

Saida esperada:

```text
docs/template-map.md
```

Status:

```text
Concluido inicialmente. Ver docs/template-map.md.
```

### Fase 2 - Preparar template operacional

Objetivo:

- criar uma copia do template oficial com placeholders;
- preservar visual;
- inserir marcadores em secoes dinamicas;
- nao alterar o template original sem versionamento.

Saida esperada:

```text
backend/templates/assessment-operational-template.docx
```

Status:

```text
Primeiro corte criado. Ver docs/operational-template.md.
```

### Fase 3 - Criar report_model

Objetivo:

- converter `assessment.json` em estrutura editorial;
- limitar tamanho de tabelas quando necessario;
- gerar perguntas abertas quando faltarem evidencias;
- preparar dados para blocos repetiveis do Word.

Saida esperada:

```text
backend/report-model.js
```

### Fase 4 - Integrar renderizador confiavel

Objetivo:

- usar engine de template DOCX;
- renderizar placeholders;
- repetir blocos dinamicos;
- gerar arquivo Word sem XML manual.

Validacao obrigatoria:

- abrir no Microsoft Word via automacao local;
- inspecionar pacote DOCX;
- validar download pelo Render.

### Fase 5 - Evoluir visual de fluxos

Objetivo:

- melhorar apresentacao de fluxos sem sacrificar compatibilidade;
- manter tabela editavel como fallback;
- validar com assessments pequenos e grandes.

## Criterios de aceite

Um corte so deve ser considerado aceito se:

- o DOCX abre no Microsoft Word;
- o DOCX preserva o padrao visual do template;
- o texto gerado pela IA aparece no arquivo;
- tabelas sao editaveis;
- fluxos ficam editaveis pelo menos em tabela;
- nenhum erro real e escondido;
- quando faltar informacao, o documento registra pendencia/pergunta aberta;
- o endpoint de producao no Render foi testado.

## O que nao fazer

Nao fazer:

- concatenar XML manual em `word/document.xml`;
- assumir fluxo unico para todos os clientes;
- transformar o template em imagem;
- gerar DOCX que so passa em inspecao XML mas nao abre no Word;
- criar fallback visual falso;
- inventar conteudo quando o rascunho nao tem evidencia.

## Proximo passo recomendado

Executar a Fase 1:

```text
Mapear o template oficial e criar a matriz template -> assessment.json.
```

Somente depois disso iniciar alteracao de codigo para `docxtemplater`.
