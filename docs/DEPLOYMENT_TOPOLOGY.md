# Topologia oficial de deploy

## Decisão arquitetural do MVP

Para cumprir a premissa mestre de que **o link do widget nunca pode mudar**, o MVP utiliza um único serviço web no Render como entrypoint externo.

```text
3DEXPERIENCE / 3DDashboard
            ↓
https://assessment-report-builder.onrender.com/
            ↓
frontend/index.html + backend/server.js
            ↓
assessment.json / validação / serviços futuros
```

## Link oficial

```text
https://assessment-report-builder.onrender.com/
```

Este é o único link operacional oficial do widget.

Não usar como link oficial:

```text
https://assessment-report-builder.onrender.com/?v=...
https://assessment-report-builder.onrender.com/index.html
https://assessment-report-builder.onrender.com/frontend/index.html
https://dashboard.render.com/web/srv-d8umn177f7vs739rab5g
```

## Papel do GitHub

O GitHub é a fonte oficial do código, documentação, schema e histórico:

```text
https://github.com/MouraEnderson/Assessment-Report-Builder.git
```

O GitHub não é o entrypoint operacional do widget no MVP.

## Papel do Render

O mesmo serviço Render entrega:

```text
GET  /                     → widget oficial
GET  /health               → health check
GET  /version              → versão e entrypoint ativo
GET  /api/health           → health check da API
GET  /api/assessment/schema
POST /api/assessment/generate
POST /api/assessment/validate
```

## Fundação limpa

```text
1 link oficial: https://assessment-report-builder.onrender.com/
1 frontend oficial: frontend/index.html
1 backend oficial: backend/server.js
1 start oficial: npm start → node server.js
1 fluxo operacional: / → widget
0 entrypoints paralelos
0 query string oficial
0 fallback silencioso
```

## Regra de imutabilidade

Depois que a URL pública for registrada no 3DEXPERIENCE:

```text
- não renomear o serviço Render;
- não excluir e recriar o serviço com outro endereço;
- não trocar o link no dashboard para apontar diretamente a arquivos internos;
- manter `/` como entrypoint oficial;
- não usar query string como versão oficial;
- preservar compatibilidade com o link raiz.
```

## Evolução futura

A infraestrutura interna poderá evoluir, mas o endereço externo deverá permanecer o mesmo.

Exemplos de mudanças permitidas:

```text
- novos módulos internos;
- banco de dados;
- filas;
- armazenamento de arquivos;
- integração com IA;
- geração de DOCX;
- integração com 3DEXPERIENCE.
```

Se futuramente forem criados serviços auxiliares, eles serão consumidos pelo serviço oficial ou ficarão atrás de uma camada que preserve a URL pública já registrada.
