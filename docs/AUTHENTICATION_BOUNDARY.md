# Authentication Boundary — Assessment Report Builder

## Decisão

O projeto usará a sessão já autenticada do usuário no 3DEXPERIENCE como credencial operacional para chamadas à plataforma.

Não haverá implementação de CAS no Assessment Report Builder.

---

## Regra principal

```text
A sessão 3DEXPERIENCE pertence ao runtime do widget.
O backend Render nunca recebe credenciais 3DEXPERIENCE.
```

---

## Permitido

No frontend/widget rodando dentro do 3DDashboard Additional App:

```text
- usar WAFData.authenticatedRequest;
- carregar módulos oficiais via require:
  - DS/WAFData/WAFData;
  - DS/i3DXCompassServices/i3DXCompassServices;
  - DS/PlatformAPI/PlatformAPI;
- usar a sessão ativa do usuário para ler contexto, bookmarks e documentos quando a etapa for implementada;
- enviar ao Render somente o conteúdo necessário ao processamento, como texto extraído, assessment.json ou template selecionado pelo usuário.
```

---

## Proibido

No backend Render:

```text
- executar CAS;
- armazenar usuário/senha;
- receber cookies do 3DEXPERIENCE;
- receber ticket CAS;
- receber sessionId;
- receber token interno de plataforma;
- fazer chamada autenticada ao 3DEXPERIENCE em nome do usuário;
- tentar reaproveitar sessão do navegador fora do runtime do widget.
```

---

## Fronteira de responsabilidade

### 3DEXPERIENCE / Widget

```text
- autenticação do usuário;
- sessão ativa;
- acesso WAFData;
- leitura futura de bookmark/documentos;
- seleção manual ou assistida de arquivos;
- controle da interface;
- revisão humana.
```

### Render

```text
- processamento de texto;
- chamada de IA;
- validação de schema;
- geração de assessment.json;
- geração futura de DOCX;
- nenhum acesso autenticado direto ao 3DEXPERIENCE.
```

---

## Fluxo seguro

```text
Usuário logado no 3DEXPERIENCE
        ↓
Widget Additional App usa WAFData/session runtime
        ↓
Usuário seleciona ou fornece transcrição/template
        ↓
Widget envia somente conteúdo necessário ao Render
        ↓
Render processa e devolve JSON/DOCX
        ↓
Widget apresenta para revisão
```

---

## Motivo

Esse limite evita vazamento de credenciais, evita dependência de CAS no backend e mantém a autenticação no local correto: o runtime autenticado do 3DEXPERIENCE.

---

## Critério de aceite

Uma implementação só será aceita se:

```text
- WAFData for usado apenas no frontend/widget;
- Render não receber nenhum token/cookie/sessão 3DEXPERIENCE;
- chamadas à plataforma não forem feitas via fetch cross-origin direto;
- falha de WAFData for exibida como erro operacional, não mascarada por fallback.
```
