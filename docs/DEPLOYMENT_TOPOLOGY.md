# Topologia oficial de deploy

## Decisão arquitetural do MVP

Para cumprir a premissa mestre de que **o link do widget nunca pode mudar**, o MVP utilizará um único serviço web no Render como entrypoint externo.

```text
3DEXPERIENCE / 3DDashboard
            ↓
URL pública fixa do Render
            ↓
Frontend estático + API backend
            ↓
assessment.json / validação / serviços futuros
```

## Papel do GitHub

O GitHub é a fonte oficial do código e da documentação:

```text
https://github.com/MouraEnderson/Assessment-Report-Builder.git
```

O GitHub não é o entrypoint operacional do widget no MVP.

## Papel do Render

O mesmo serviço Render entrega:

```text
GET /                     → frontend/index.html
GET /health               → health check
GET /api/health           → health check da API
GET /api/assessment/schema
POST /api/assessment/generate
POST /api/assessment/validate
```

Benefícios:

- um único link externo;
- nenhuma duplicidade de entrypoint;
- frontend e backend no mesmo domínio;
- ausência de dependência de CORS no fluxo normal;
- rollback pelo mesmo serviço;
- atualização interna sem mudar o link do 3DDashboard.

## Link oficial

O link oficial será a URL pública do serviço Render.

O link de dashboard administrativo não é o link operacional:

```text
https://dashboard.render.com/web/srv-d8umn177f7vs739rab5g
```

Depois do primeiro deploy concluído, a URL pública deverá ser registrada aqui e no README.

```text
URL pública oficial: PENDENTE DE CONFIRMAÇÃO
```

## Regra de imutabilidade

Depois que a URL pública for registrada no 3DEXPERIENCE:

```text
- não renomear o serviço Render;
- não excluir e recriar o serviço com outro endereço;
- não trocar o link no dashboard para apontar diretamente a arquivos internos;
- manter `/` como entrypoint oficial;
- manter redirects e mudanças internas compatíveis com o link raiz.
```

## Evolução futura

A infraestrutura interna poderá evoluir, mas o endereço externo deverá permanecer o mesmo.

Exemplos de mudanças permitidas:

```text
- novos controllers;
- serviços internos separados;
- banco de dados;
- filas;
- armazenamento de arquivos;
- integração com IA;
- geração de DOCX;
- integração com 3DEXPERIENCE.
```

Se futuramente forem criados serviços auxiliares, eles serão consumidos pelo serviço oficial ou ficarão atrás de uma camada que preserve a URL pública já registrada.
