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

Este é o único link operacional oficial e deve ser usado como **3DDashboard Additional App**.

Não usar como link oficial:

```text
https://assessment-report-builder.onrender.com/?v=...
https://assessment-report-builder.onrender.com/index.html
https://assessment-report-builder.onrender.com/frontend/index.html
```

Não usar como runtime oficial:

```text
Web Page Reader
iframe shell
HTML injetado como markup
CAS no backend
```

## Premissa mestre

```text
O link oficial do widget nunca muda.
```

O MVP utiliza um único serviço Render como entrypoint externo. O mesmo endereço entrega o widget Additional App e a API, enquanto o GitHub permanece como fonte oficial do código e da documentação.

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
3DEXPERIENCE / 3DDashboard Additional App
            ↓
https://assessment-report-builder.onrender.com/
            ↓
frontend/widget.html
            ↓
frontend/assets/css/assessment.css
frontend/assets/js/assessment-runtime.js
            ↓
backend/server.js / API Render
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

## Fronteira de autenticação

```text
A sessão 3DEXPERIENCE fica no frontend/widget via WAFData.
Render não executa CAS.
Render não recebe credenciais 3DEXPERIENCE.
Render processa somente dados enviados pelo widget/usuário.
```

## Fundação limpa

A fundação oficial passa a ser:

```text
1 link oficial: https://assessment-report-builder.onrender.com/
1 runtime oficial: 3DDashboard Additional App
1 frontend oficial: frontend/widget.html
1 backend oficial: backend/server.js
1 start oficial: npm start → node server.js
1 fluxo operacional: / → widget Additional App
0 entrypoints paralelos
0 query string oficial
0 iframe shell
0 CAS no backend
0 fallback silencioso
```

## Estado atual

O MVP 1 contém:

- Dockerfile para deploy no Render;
- entrypoint Additional App em `frontend/widget.html`;
- CSS externo em `frontend/assets/css/assessment.css`;
- runtime externo em `frontend/assets/js/assessment-runtime.js`;
- backend oficial em `backend/server.js`;
- rota `/health`;
- rota `/version`;
- schema oficial do `assessment.json`;
- geração de rascunho estruturado;
- editor JSON;
- validação de schema;
- exportação `.json`;
- persistência local da sessão;
- verificação explícita de WAFData no widget;
- CI para verificar sintaxe do backend e build Docker.

A primeira versão não cria conclusões com IA. Ela estabelece o contrato e o fluxo sem apresentar dados simulados como fatos reais.

## Endpoints atuais

```text
GET  /
GET  /widget.html
GET  /assets/css/assessment.css
GET  /assets/js/assessment-runtime.js
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
│   ├── widget.html
│   └── assets/
│       ├── css/
│       │   └── assessment.css
│       └── js/
│           └── assessment-runtime.js
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
- [Contrato 3DEXPERIENCE Widget](docs/3DEXPERIENCE_WIDGET_CONTRACT.md)
- [Fronteira de autenticação](docs/AUTHENTICATION_BOUNDARY.md)
- [ADR-001 — Additional App com WAFData](docs/ADR-001-3DX-ADDITIONAL-APP-WAFDATA.md)
- [Implementação do MVP 1](docs/MVP1_IMPLEMENTATION.md)

## Regras de ouro

```text
Nada que o usuário não consiga revisar deve entrar no relatório.
Nada que o usuário não consiga editar deve ser considerado saída oficial.
Nada que não tenha evidência deve ser apresentado como fato.
O link oficial do widget nunca muda.
A sessão 3DEXPERIENCE nunca sai do runtime do widget.
```

## Próximo checkpoint

1. Confirmar deploy do Render.
2. Testar `GET /version` e confirmar versão `0.4.3`.
3. Adicionar o link oficial como **Additional App**, não Web Page Reader.
4. Confirmar que CSS externo e JS externo carregam.
5. Confirmar que o widget exibe WAFData disponível.
6. Testar geração, edição, validação e exportação do `assessment.json`.
