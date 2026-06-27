# 3DEXPERIENCE Widget Contract

## Decisão

O Assessment Report Builder será executado no 3DEXPERIENCE como **3DDashboard Additional App**.

O projeto não deve ser tratado como Web Page Reader, HTML injetado como markup, iframe shell, script solto sem contrato ou webapp administrativo instalado em `webapps` da plataforma.

---

## Entrada oficial

```text
https://assessment-report-builder.onrender.com/
```

Este link deve ser usado no Additional App.

A rota `/` entrega o arquivo oficial:

```text
frontend/widget.html
```

---

## Formato do widget

O entrypoint é XHTML compatível com o padrão usado em widgets/Additional Apps:

```text
frontend/widget.html
```

Características:

```text
- XML declaration;
- XHTML 1.0 Strict doctype;
- namespace xmlns:widget="http://www.netvibes.com/ns/";
- bootstrap JavaScript estável;
- nenhum iframe;
- nenhum CSS inline obrigatório;
- body inicial mínimo;
- runtime renderiza a UI no elemento #assessment-root.
```

---

## Bootstrap oficial

```text
frontend/assets/js/assessment-bootstrap.js
```

Responsabilidades:

```text
- carregar o manifesto oficial em /api/widget/manifest;
- carregar o CSS versionado indicado pelo manifesto;
- carregar o runtime JS versionado indicado pelo manifesto;
- exibir erro visível se CSS/runtime não carregarem.
```

O bootstrap é estável. O link oficial continua `/` e não recebe query string. A versão operacional é resolvida pelo manifesto.

---

## Manifesto oficial

```text
GET /api/widget/manifest
```

Resposta esperada:

```json
{
  "ok": true,
  "build": "assessment-0.4.1",
  "css": "/assets/css/assessment.css?build=assessment-0.4.1",
  "runtime": "/assets/js/assessment-runtime.js?build=assessment-0.4.1"
}
```

A query string só existe nos assets internos carregados pelo bootstrap. Ela não faz parte do link oficial do widget.

---

## Runtime oficial

```text
frontend/assets/js/assessment-runtime.js
```

Responsabilidades:

```text
- montar a UI do widget;
- verificar backend Render;
- verificar disponibilidade WAFData;
- preservar estado local;
- gerar assessment.json via API Render;
- validar schema;
- exportar JSON;
- futuramente acessar bookmark/documentos via sessão 3DEXPERIENCE.
```

---

## Estilo oficial

```text
frontend/assets/css/assessment.css
```

Responsabilidades:

```text
- layout compatível com frame do 3DDashboard;
- rolagem interna;
- responsividade;
- visual de cards;
- zero dependência de CSS inline.
```

---

## Sessão e autenticação

O widget tenta obter a sessão 3DEXPERIENCE por:

```text
1. widget.WAFData;
2. WAFData global;
3. require('DS/WAFData/WAFData');
4. require('DS/i3DXCompassServices/i3DXCompassServices');
5. require('DS/PlatformAPI/PlatformAPI').
```

Se WAFData não estiver disponível, o widget deve exibir erro operacional:

```text
Use Additional App no 3DDashboard, não Web Page Reader.
```

---

## Render

Render é backend de processamento e também entrega os arquivos do widget.

Render não autentica no 3DEXPERIENCE.

---

## Rotas oficiais

```text
GET  /                                  → widget oficial com bootstrap
GET  /widget.html                       → mesmo widget, diagnóstico
GET  /assets/js/assessment-bootstrap.js → bootstrap estável
GET  /api/widget/manifest               → manifesto versionado dos assets
GET  /assets/css/assessment.css         → estilo do widget
GET  /assets/js/assessment-runtime.js   → runtime do widget
GET  /health                            → health check
GET  /version                           → versão e contrato ativo
GET  /api/assessment/schema             → schema oficial
POST /api/assessment/generate           → gera rascunho assessment.json
POST /api/assessment/validate           → valida assessment.json
```

---

## Proibido

```text
- usar iframe shell como arquitetura final;
- usar query string como link oficial;
- usar CAS no backend;
- compartilhar credenciais 3DEXPERIENCE com o Render;
- fallback silencioso quando WAFData estiver indisponível;
- tratar Web Page Reader como runtime oficial;
- manter dois frontends oficiais concorrentes.
```

---

## Critério de aceite do carregamento

No 3DEXPERIENCE:

```text
- o link oficial abre no Additional App;
- bootstrap estável executa;
- manifesto carrega;
- CSS externo carrega;
- runtime JS externo executa;
- status do backend fica online;
- status de sessão 3DX mostra WAFData disponível ou erro claro;
- rolagem ocorre dentro do widget;
- não aparece HTML cru/injetado;
- não há dependência de iframe.
```
