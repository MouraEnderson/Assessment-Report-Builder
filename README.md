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

O endereço acima é administrativo. A URL pública oficial do widget será registrada após a confirmação do primeiro deploy concluído.

## Arquitetura do MVP

```text
3DEXPERIENCE / 3DDashboard
            ↓
URL pública fixa do Render
            ↓
Frontend estático + API backend
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

## Estado atual

O MVP 1 já contém:

- Dockerfile para deploy no Render;
- frontend servido pelo mesmo serviço;
- rota `/health`;
- schema oficial do `assessment.json`;
- geração de rascunho estruturado;
- editor JSON;
- validação de schema;
- exportação `.json`;
- persistência local da sessão;
- controller oficial;
- CI para verificar sintaxe e build Docker.

A primeira versão não cria conclusões com IA. Ela estabelece o contrato e o fluxo sem apresentar dados simulados como fatos reais.

## Endpoints atuais

```text
GET  /
GET  /health
GET  /api/health
GET  /api/assessment/schema
POST /api/assessment/generate
POST /api/assessment/validate
```

## Estrutura principal

```text
Assessment-Report-Builder/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   ├── config.js
│   ├── assessment-state.js
│   ├── assessment-api-client.js
│   ├── assessment-controller.js
│   └── app.js
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
2. Registrar a URL pública oficial.
3. Testar `/health`.
4. Testar geração, edição, validação e exportação do `assessment.json`.
5. Iniciar o editor visual por seções.
