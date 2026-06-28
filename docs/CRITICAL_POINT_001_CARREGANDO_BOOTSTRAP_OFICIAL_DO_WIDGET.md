# Ponto Crítico 1 — Carregando bootstrap oficial do widget

## Status

```text
Aberto / bloqueador de fundação
```

Este documento congela o diagnóstico do primeiro ponto crítico do projeto **Assessment Report Builder**.

O objetivo é evitar novas alterações por tentativa e erro. A partir deste ponto, qualquer próxima ação deve partir das evidências abaixo.

---

## Prompt mestre para continuidade do projeto

Use o texto abaixo para retomar o projeto com outro agente, outra conversa ou outra etapa técnica.

```text
Você está continuando o projeto Assessment Report Builder do usuário Enderson Moura.

Repositório oficial:
https://github.com/MouraEnderson/Assessment-Report-Builder.git

Render administrativo:
https://dashboard.render.com/web/srv-d8umn177f7vs739rab5g

Link oficial imutável do widget:
https://assessment-report-builder.onrender.com/

Contexto do projeto:
Criar um widget para 3DEXPERIENCE/3DDashboard que automatize a criação de relatórios de assessment a partir de transcrições de reuniões. O fluxo planejado é: usuário faz assessment no cliente, grava a reunião, gera transcrição, alimenta o widget, o widget estrutura um assessment.json revisável, depois gera relatório DOCX editável com base em template selecionado.

Premissa mestre:
O link oficial do widget nunca pode mudar.

Premissas técnicas e de segurança:
1. O widget deve rodar no 3DEXPERIENCE como 3DDashboard Additional App.
2. Não usar Web Page Reader como runtime oficial.
3. Não usar iframe shell como arquitetura final.
4. Não usar query string no link oficial do widget.
5. Não usar CAS no backend.
6. Usar a sessão logada do 3DEXPERIENCE somente no frontend/widget.
7. O backend Render nunca deve receber cookie, ticket CAS, token, sessionId ou credenciais 3DEXPERIENCE.
8. Acesso futuro a bookmark/documentos do 3DEXPERIENCE deve acontecer no frontend/widget via WAFData/session runtime.
9. O Render é backend de processamento: validação de schema, IA, parser, geração de JSON e DOCX.
10. Nada deve ser mascarado por fallback silencioso.
11. Todos os mapas, gaps, radar, fluxos e roadmap precisam ser editáveis, não imagens fixas.
12. assessment.json revisado é a fonte da verdade; DOCX é saída editável.

Arquitetura desejada:
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

Estado atual do MVP:
- Backend Node/Express em backend/server.js.
- Dockerfile para Render.
- render.yaml com serviço assessment-report-builder.
- Schema oficial em backend/schemas/assessment.schema.json.
- Endpoints atuais esperados:
  GET /
  GET /widget.html
  GET /assets/css/assessment.css
  GET /assets/js/assessment-runtime.js
  GET /health
  GET /version
  GET /api/health
  GET /api/assessment/schema
  POST /api/assessment/generate
  POST /api/assessment/validate
- Frontend pretendido:
  frontend/widget.html
  frontend/assets/css/assessment.css
  frontend/assets/js/assessment-runtime.js

Erro crítico atual:
Dentro do 3DEXPERIENCE/3DDashboard, a instância do widget fica presa na mensagem:
"Carregando bootstrap oficial do widget..."

Evidências observadas:
1. view-source:https://assessment-report-builder.onrender.com/ chegou a mostrar widget.html novo com XML/XHTML.
2. /version chegou a responder versão 0.4.x.
3. Em uma tentativa anterior, o widget.html usava assessment-bootstrap.js e /api/widget/manifest.
4. Depois o bootstrap foi removido e voltou-se ao padrão direto: widget.html -> assessment.css + assessment-runtime.js.
5. Mesmo assim, dentro do 3DEXPERIENCE continua aparecendo "Carregando bootstrap oficial do widget...".
6. DevTools Network mostrou tentativa de carregar assessment-bootstrap.js?... retornando 404.
7. Console mostrou que assessment-runtime.js versão 0.4.3 carregou: [Assessment] runtime loaded assessment-0.4.3.
8. Isso indica estado misto/cache/proxy: HTML antigo do bootstrap ainda aparece no container, enquanto runtime novo chega a carregar.
9. Não há prova de que seja problema de CAS, Render ou schema.
10. O problema atual é carregamento/instância/cache/contrato do Additional App no 3DEXPERIENCE.

Regra para próximos passos:
Não continuar alterando UI, CSS, iframe, bootstrap, manifesto ou CAS por tentativa.
Primeiro provar exatamente qual HTML, CSS e JS o 3DEXPERIENCE está usando.
Usar Network/Console e, se possível, remover/recriar a instância do widget no dashboard como Additional App.

Próxima investigação recomendada:
1. Confirmar /version no navegador externo.
2. Confirmar view-source da raiz.
3. No DevTools do 3DEXPERIENCE, filtrar por:
   - assessment
   - widget.html
   - assessment-runtime.js
   - assessment-bootstrap.js
   - frame?id=
   - api/proxy/ajax
4. Verificar se o Additional App está cacheando o HTML antigo.
5. Remover a instância atual do dashboard e adicionar novamente como Additional App usando o mesmo link oficial.
6. Se ainda vier HTML antigo, investigar o cache/proxy do 3DEXPERIENCE para Additional App.
7. Só depois decidir correção de código.

Não fazer:
- Não implementar CAS.
- Não capturar cookie.
- Não enviar token/sessão ao Render.
- Não mudar o link oficial.
- Não usar query string como link oficial.
- Não voltar para iframe shell.
- Não criar outro entrypoint concorrente.
```

---

## Resumo executivo do projeto

O **Assessment Report Builder** é um widget para o ecossistema 3DEXPERIENCE/3DDashboard.

Ele deverá transformar insumos de assessment, especialmente transcrições de reuniões, em um `assessment.json` estruturado, revisável, rastreável e editável. Depois da revisão humana, esse JSON será usado para gerar um relatório final em DOCX editável com base em template aprovado.

O projeto nasceu para reduzir o trabalho manual de:

```text
transcrição de reunião
→ resumo manual
→ separação por tópicos do template
→ mapa de software
→ mapa de gaps
→ fluxos AS-IS / TO-BE
→ recomendações
→ roadmap
→ relatório final
```

---

## Premissa mestre

```text
O link oficial do widget nunca pode mudar.
```

Link oficial:

```text
https://assessment-report-builder.onrender.com/
```

Esse link deve permanecer como entrypoint externo único mesmo quando a arquitetura interna evoluir.

---

## Recursos oficiais

### Repositório

```text
https://github.com/MouraEnderson/Assessment-Report-Builder.git
```

### Render administrativo

```text
https://dashboard.render.com/web/srv-d8umn177f7vs739rab5g
```

### Link público operacional

```text
https://assessment-report-builder.onrender.com/
```

---

## Premissas funcionais

1. O usuário poderá selecionar manualmente templates na bookmark e voltar para o widget.
2. A transcrição poderá vir de arquivo local ou de bookmark selecionada manualmente.
3. O fluxo deve preservar estado para permitir ida e volta entre dashboard/bookmark/widget.
4. Mapas, gaps, radar, fluxos, roadmap e recomendações devem ser editáveis.
5. Nenhum mapa ou fluxo deve ser apenas imagem fixa.
6. O relatório final deve ser consequência de dados aprovados.
7. O `assessment.json` revisado é a fonte da verdade.
8. DOCX é saída editável, não fonte primária.
9. PDF, se existir, será saída de leitura.
10. Nenhuma conclusão de IA deve ser final sem revisão humana.

---

## Premissas técnicas

1. Runtime oficial: `3DDashboard Additional App`.
2. Não usar Web Page Reader como runtime final.
3. Não usar iframe shell como arquitetura final.
4. Não usar query string no link oficial.
5. Backend oficial: `backend/server.js`.
6. Frontend oficial pretendido: `frontend/widget.html`.
7. CSS oficial pretendido: `frontend/assets/css/assessment.css`.
8. Runtime JS oficial pretendido: `frontend/assets/js/assessment-runtime.js`.
9. Deploy oficial via Render/Docker.
10. GitHub é fonte oficial do código e documentação.

---

## Fronteira de autenticação

A autenticação com 3DEXPERIENCE deve ficar exclusivamente no runtime do widget.

Permitido no frontend/widget:

```text
- usar sessão logada do usuário;
- usar WAFData quando disponível;
- usar require de módulos DS quando disponível;
- futuramente acessar bookmark/documentos pelo runtime autenticado.
```

Proibido no backend Render:

```text
- CAS;
- usuário/senha;
- ticket CAS;
- cookies 3DEXPERIENCE;
- sessionId;
- token interno;
- chamada autenticada direta ao 3DEXPERIENCE em nome do usuário.
```

---

## Estado atual do código

### Backend

Arquivo principal:

```text
backend/server.js
```

Responsabilidades:

```text
- servir widget;
- servir CSS/JS;
- responder /health;
- responder /version;
- fornecer schema;
- gerar assessment.json inicial;
- validar assessment.json;
- não autenticar no 3DEXPERIENCE.
```

### Frontend pretendido

```text
frontend/widget.html
frontend/assets/css/assessment.css
frontend/assets/js/assessment-runtime.js
```

### Schema

```text
backend/schemas/assessment.schema.json
```

Estrutura planejada do JSON:

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

---

## Histórico resumido das tentativas

### Tentativa 1 — HTML comum

Sintoma:

```text
Widget carregava como HTML cru, sem CSS/JS aplicados.
```

Conclusão:

```text
3DEXPERIENCE não estava tratando a página como site externo normal.
```

### Tentativa 2 — HTML single-file

Objetivo:

```text
Evitar dependência de CSS/JS externo.
```

Resultado:

```text
Melhorou fora do 3DEXPERIENCE, mas não resolveu contrato do widget.
```

### Tentativa 3 — iframe shell

Objetivo:

```text
Isolar app real em iframe.
```

Resultado:

```text
Feriu a premissa de arquitetura limpa e foi descartado.
```

### Tentativa 4 — Additional App com CSS/JS externo

Objetivo:

```text
Aproximar do padrão usado pelo BOM Analytics.
```

Resultado parcial:

```text
Caminho correto conceitualmente, mas instância passou a exibir resíduo do bootstrap antigo.
```

### Tentativa 5 — bootstrap + manifesto

Objetivo:

```text
Criar loader estável e manifest versionado.
```

Resultado:

```text
Widget ficou preso em "Carregando bootstrap oficial do widget...".
```

Status:

```text
Descartado como arquitetura final.
```

### Tentativa 6 — retorno ao runtime direto

Objetivo:

```text
Voltar ao padrão mínimo: widget.html -> CSS + runtime JS.
```

Evidência nova:

```text
Console mostrou: [Assessment] runtime loaded assessment-0.4.3
```

Mas a tela continuou mostrando:

```text
Carregando bootstrap oficial do widget...
```

Conclusão atual:

```text
Há estado misto/cache/proxy/instância antiga do Additional App.
```

---

## Erro crítico atual

Nome oficial do ponto crítico:

```text
Ponto Crítico 1 — Carregando bootstrap oficial do widget
```

Sintoma visível:

```text
Assessment Report Builder
Carregando bootstrap oficial do widget...
```

Evidência de Network:

```text
assessment-bootstrap.js?... → 404
ajax?type=json... → 404
```

Evidência de Console:

```text
[Assessment] runtime loaded assessment-0.4.3
```

Interpretação:

```text
O dashboard/Additional App ainda está usando HTML antigo que referencia bootstrap, enquanto também consegue carregar runtime novo.
```

Hipóteses prováveis:

```text
1. Instância do widget cacheada no 3DDashboard.
2. Proxy interno do 3DEXPERIENCE cacheando HTML antigo por URL.
3. Additional App reaproveitando frame antigo sem recarregar entrypoint.
4. Mistura entre versão antiga do widget.html e asset JS novo.
5. Configuração do widget ainda apontando para conteúdo antigo do proxy.
```

Hipóteses menos prováveis neste momento:

```text
- problema de Render;
- problema de schema;
- problema de CAS;
- problema de autenticação;
- erro de endpoint /api/assessment/generate;
- falta de deploy do backend.
```

---

## Critério para considerar o ponto crítico resolvido

O ponto crítico só estará resolvido quando, dentro do 3DEXPERIENCE:

```text
1. A mensagem "Carregando bootstrap oficial do widget..." desaparecer.
2. O widget carregar a UI gerada pelo assessment-runtime.js.
3. Console mostrar runtime atual carregado.
4. Network não mostrar tentativa de assessment-bootstrap.js.
5. Status visual mostrar:
   - Sessão 3DX: verificando... ou WAFData disponível/indisponível com erro claro;
   - Backend: verificando... / online.
6. O usuário conseguir colar transcrição.
7. O botão Gerar assessment.json chamar o backend.
```

---

## Próximos passos recomendados

### Passo 1 — Congelar alterações de UI

Não alterar mais layout, CSS, iframe, bootstrap ou manifest até fechar o diagnóstico de cache/instância.

### Passo 2 — Validar fora do 3DEXPERIENCE

Abrir:

```text
https://assessment-report-builder.onrender.com/version
https://assessment-report-builder.onrender.com/
view-source:https://assessment-report-builder.onrender.com/
https://assessment-report-builder.onrender.com/assets/js/assessment-runtime.js
https://assessment-report-builder.onrender.com/assets/css/assessment.css
```

Confirmar se a raiz atual ainda contém referência a `assessment-bootstrap.js`. Se contiver, o deploy/arquivo atual ainda não está limpo.

### Passo 3 — Validar dentro do DevTools do 3DEXPERIENCE

Filtrar por:

```text
assessment
bootstrap
runtime
widget.html
frame?id
api/proxy/ajax
```

Registrar exatamente:

```text
- URL requisitada;
- status HTTP;
- tipo de recurso;
- initiator;
- response;
- se vem de cache ou network.
```

### Passo 4 — Recriar a instância do widget

Sem mudar link oficial:

```text
1. Remover a instância atual do widget no dashboard.
2. Adicionar novamente como Additional App.
3. Usar exatamente https://assessment-report-builder.onrender.com/
4. Não usar Web Page Reader.
5. Não usar query string.
6. Não usar /widget.html como link oficial.
```

### Passo 5 — Se persistir

Investigar cache/proxy do 3DEXPERIENCE para Additional App.

Possível necessidade:

```text
- revisar configuração de Additional App;
- verificar se 3DDashboard armazena cópia do conteúdo;
- verificar se o URL foi cadastrado anteriormente com conteúdo antigo;
- testar em dashboard novo/aba nova/instância limpa;
- comparar com o padrão operacional do BOM Analytics.
```

---

## Regra de governança daqui em diante

Qualquer nova alteração precisa informar:

```text
1. Qual hipótese está sendo testada.
2. Qual evidência confirma a hipótese.
3. Qual arquivo será alterado.
4. Qual resultado esperado.
5. Como reverter.
```

Sem isso, não alterar código.

---

## Decisão atual

```text
O problema "Carregando bootstrap oficial do widget" é o Ponto Crítico 1 do projeto.
Ele bloqueia avanço para IA, DOCX, bookmark, template e geração de relatório.
A próxima ação deve ser diagnóstico/recriação da instância Additional App, não criação de novas features.
```
