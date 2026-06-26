# Assessment Report Builder

Widget escalável para transformar transcrições de reuniões de assessment em dados estruturados, revisáveis, rastreáveis e editáveis.

```text
Transcrição
    ↓
assessment.json
    ↓
Revisão humana
    ↓
Relatório DOCX editável
```

## Link oficial do widget

```text
https://assessment-report-builder.onrender.com/
```

Este é o único link operacional oficial.

Não usar como link oficial:

```text
https://assessment-report-builder.onrender.com/?v=...
https://assessment-report-builder.onrender.com/index.html
https://assessment-report-builder.onrender.com/frontend/index.html
```

## Premissa mestre

```text
O link oficial do widget nunca muda.
```

O MVP utiliza um único serviço Render como entrypoint externo. O mesmo endereço entrega o frontend e a API, enquanto o GitHub permanece como fonte oficial do código e da documentação.

## Recursos oficiais

### Repositório

```text
https://github.com/MouraEnderson/Assessment-Report-Builder.git
```

### Render administrativo

```text
https://dashboard.render.com/web/srv-d8umn177f7vs739rab5g
```

O endereço acima é administrativo. Ele não deve ser usado como link do widget.

## Arquitetura do MVP

```text
3DEXPERIENCE / 3DDashboard
            ↓
https://assessment-report-builder.onrender.com/
            ↓
frontend/index.html + backend/server.js
            ↓
assessment.json / validação / serviços futuros
```

## Fonte da verdade

```text
Transcrição = insumo
Template = apresentação
assessment.json = fonte da verdade
DOCX = saída editável
PDF = saída de leitura
```

## Fundação limpa

A fundação oficial passa a ser:

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

## Estado atual

O MVP 1 contém:

- Dockerfile para deploy no Render;
- frontend single-file servido pela raiz `/`;
- backend oficial em `backend/server.js`;
- rota `/health`;
- rota `/version`;
- schema oficial do `assessment.json`;
- geração de rascunho estruturado;
- editor JSON;
- validação de schema;
- exportação `.json`;
- persistência local da sessão;
- CI para verificar sintaxe do backend e build Docker.

A primeira versão não cria conclusões com IA. Ela estabelece o contrato e o fluxo sem apresentar dados simulados como fatos reais.

## Endpoints atuais

```text
GET  /
GET  /health
GET  /version
GET  /api/health
GET  /api/assessment/schema
POST /api/assessment/generate
POST /api/assessment/validate
```

## Estrutura principal

```text
Assessment-Report-Builder/
├── frontend/
│   └── index.html
├── backend/
│   ├── server.js
│   ├── package.json
│   └── schemas/
│       └── assessment.schema.json
├── docs/
├── Dockerfile
├── render.yaml
└── README.md
```

## Documentação oficial

- [Premissas completas](docs/PROJECT_PREMISES.md)
- [Topologia de deploy e link fixo](docs/DEPLOYMENT_TOPOLOGY.md)
- [Implementação do MVP 1](docs/MVP1_IMPLEMENTATION.md)

## Regras de ouro

```text
Nada que o usuário não consiga revisar deve entrar no relatório.
Nada que o usuário não consiga editar deve ser considerado saída oficial.
Nada que não tenha evidência deve ser apresentado como fato.
O link oficial do widget nunca muda.
```

## Próximo checkpoint

1. Confirmar build e deploy no Render.
2. Testar `GET /version`.
3. Testar `GET /health`.
4. Testar `GET /` no link oficial limpo.
5. Testar geração, edição, validação e exportação do `assessment.json`.
