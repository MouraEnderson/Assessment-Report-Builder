# MVP 1 — Assessment JSON Builder

## Objetivo

Implementar o primeiro fluxo operacional do Assessment Report Builder:

```text
Usuário informa contexto
        ↓
Usuário cola a transcrição
        ↓
Frontend envia para o backend Render
        ↓
Backend cria assessment.json no schema oficial
        ↓
Usuário edita o JSON
        ↓
Backend valida o JSON
        ↓
Usuário exporta o arquivo
```

Este MVP não realiza extração inteligente com IA ainda. Ele estabelece a arquitetura, o contrato de dados, a persistência local, a comunicação frontend/backend e a validação do JSON sem apresentar dados simulados como conclusões reais.

---

## Premissas aplicadas

1. O link oficial do widget não deverá mudar.
2. O `assessment.json` é a fonte da verdade.
3. A transcrição é somente um insumo.
4. O relatório DOCX será uma saída posterior.
5. Nenhuma conclusão automática é apresentada como fato sem evidência.
6. Erros de validação permanecem visíveis.
7. Não existe fallback silencioso.
8. O usuário pode editar e exportar o JSON.
9. O estado da sessão é preservado no navegador.
10. O frontend não contém chaves privadas.

---

## Componentes implementados

### Frontend

```text
frontend/index.html
frontend/styles.css
frontend/config.js
frontend/assessment-state.js
frontend/assessment-api-client.js
frontend/assessment-controller.js
frontend/app.js
```

### Backend

```text
backend/server.js
backend/package.json
backend/schemas/assessment.schema.json
```

### Infraestrutura

```text
Dockerfile
.dockerignore
```

---

## Controller oficial

O controller oficial do frontend é:

```text
frontend/assessment-controller.js
```

Responsabilidades atuais:

- recuperar estado salvo;
- controlar os campos de contexto;
- controlar a transcrição;
- verificar a saúde do backend;
- gerar o rascunho de `assessment.json`;
- permitir edição manual;
- validar o JSON no backend;
- exportar o JSON;
- limpar a sessão mediante confirmação;
- mostrar erros sem fallback silencioso.

---

## Persistência

O MVP utiliza `localStorage` com a chave:

```text
assessment-report-builder.state.v1
```

Dados preservados:

- cliente;
- área;
- tipo de assessment;
- modo de geração;
- texto da transcrição;
- assessment JSON;
- resultado da última validação;
- última etapa;
- data de atualização.

Esta persistência atende ao fluxo em que o usuário pode sair do widget para consultar uma bookmark e depois retornar.

Limitação atual:

- arquivos binários ainda não são persistidos;
- upload de DOCX ainda não foi implementado;
- para arquivos grandes será avaliado IndexedDB.

---

## Endpoints disponíveis

### Verificação de serviço

```text
GET /health
GET /api/health
```

### Schema oficial

```text
GET /api/assessment/schema
```

### Geração de rascunho

```text
POST /api/assessment/generate
```

A geração atual cria uma estrutura válida e vazia para revisão. Ela não inventa softwares, gaps, fluxos ou recomendações.

### Validação

```text
POST /api/assessment/validate
```

A validação utiliza o schema oficial:

```text
backend/schemas/assessment.schema.json
```

---

## Schema inicial

O contrato inclui:

```text
metadata
client
input_sources
executive_summary
meeting_summary
software_map
process_map
gap_map
gap_radar
flows
risks
recommendations
roadmap
open_questions
appendix
review_status
```

Entidades como softwares, gaps, fluxos, riscos e recomendações contêm campos próprios para evidência, confiança, classificação e estado de revisão quando aplicável.

---

## Critérios de teste do MVP 1

O MVP 1 será considerado tecnicamente ativo quando:

1. O Render concluir o build do Dockerfile.
2. `GET /health` retornar HTTP 200.
3. A página inicial abrir pelo serviço publicado.
4. O status do backend aparecer como online.
5. O usuário conseguir colar uma transcrição.
6. O backend retornar um JSON válido.
7. O frontend permitir editar o JSON.
8. A validação detectar um JSON inválido.
9. A exportação gerar um arquivo `.json`.
10. O refresh da página recuperar o estado salvo.

---

## Próxima fase depois da validação do MVP 1

### MVP 1.1

- criar editor por seções, além do editor JSON bruto;
- criar cards editáveis para resumo, software map e gaps;
- implementar status de revisão por seção;
- adicionar importação de `assessment.json` existente.

### MVP 1.2

- upload local de TXT e DOCX;
- extração segura de texto no backend;
- registro da origem local ou bookmark manual;
- persistência adequada para arquivos maiores.

### MVP 2

- integração de IA por prompts separados;
- extração estruturada de resumo executivo;
- mapa de software;
- gaps com evidências;
- fluxos AS-IS;
- riscos e recomendações;
- nenhuma conclusão sem classificação e confiança.

### MVP 3

- upload e validação de template DOCX;
- geração de relatório editável;
- tabelas e estruturas nativas, evitando imagens fixas.

---

## Regra de evolução

```text
Primeiro provar infraestrutura e contrato.
Depois provar edição e revisão.
Depois adicionar extração inteligente.
Por último gerar o documento final.
```
