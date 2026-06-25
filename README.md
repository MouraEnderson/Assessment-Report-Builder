# Assessment Report Builder

Documentação oficial inicial do projeto **Assessment Report Builder**.

Este projeto tem como objetivo criar um widget escalável para transformar transcrições de reuniões de assessment em relatórios estruturados, revisáveis, rastreáveis e editáveis, utilizando:

- **GitHub** como repositório oficial e distribuição do frontend.
- **GitHub Pages** como publicação do widget frontend, quando habilitado.
- **Render** como backend seguro para processamento, IA, validação e geração de documentos.
- **3DEXPERIENCE / 3DDashboard** como ambiente operacional onde o usuário acessa o widget.
- **Bookmarks / arquivos locais / entrada manual** como fontes de transcrição e templates.
- **assessment.json** como fonte oficial da informação.
- **DOCX editável** como principal saída operacional.

---

## 1. Identificação do projeto

### Repositório GitHub

```text
https://github.com/MouraEnderson/Assessment-Report-Builder.git
```

### Render

```text
https://dashboard.render.com/web/srv-d8umn177f7vs739rab5g
```

Observação: o link acima é o dashboard do Render. O endpoint público do backend deverá ser registrado nesta documentação após o primeiro deploy público do serviço.

### Nome operacional

```text
Assessment Report Builder
```

### Objetivo operacional

```text
Transformar uma transcrição bruta de reunião de assessment em um conjunto estruturado de dados editáveis, revisar esses dados no widget e gerar um relatório final em template oficial, mantendo rastreabilidade, evidência e controle humano.
```

---

## 2. Premissa mestre

### O link do widget nunca pode mudar

Esta é a premissa mais importante do projeto.

O link usado no 3DEXPERIENCE / 3DDashboard deve permanecer fixo e imutável.

Quando o widget for publicado via GitHub Pages, o link oficial deverá ser definido uma única vez, preferencialmente no formato:

```text
https://mouraenderson.github.io/Assessment-Report-Builder/
```

ou, se for necessário apontar explicitamente para o arquivo:

```text
https://mouraenderson.github.io/Assessment-Report-Builder/index.html
```

Depois que esse link for adotado no 3DEXPERIENCE, ele não deverá mais ser alterado.

### O que pode mudar

Internamente, podem mudar:

```text
- arquivos JavaScript;
- CSS;
- versão do backend Render;
- prompts;
- schemas;
- template mapping;
- build-id;
- serviços internos;
- layout;
- rotas de API;
- versão do controller.
```

### O que não pode mudar

Não pode mudar:

```text
- URL oficial do widget no 3DDashboard;
- entrypoint operacional do widget;
- fluxo oficial de inicialização;
- controller principal sem controle de versão;
- contrato básico entre frontend e backend sem migração clara.
```

### Regra prática

```text
O dashboard aponta sempre para o mesmo link.
O link carrega sempre o mesmo entrypoint.
O entrypoint carrega a versão atual do widget.
As versões mudam por dentro, nunca mudando o link externo.
```

---

## 3. Visão macro do fluxo

O projeto não deve ser tratado como um simples resumidor de reunião.

O fluxo correto é:

```text
Transcrição da reunião
        ↓
Extração estruturada
        ↓
assessment.json
        ↓
Revisão humana no widget
        ↓
Dados aprovados
        ↓
Geração do relatório editável
        ↓
DOCX / PDF / JSON / tabelas
```

Regra central:

```text
A transcrição não vira relatório diretamente.
A transcrição vira conhecimento estruturado.
O conhecimento estruturado vira relatório.
```

---

## 4. Fonte da verdade

A fonte oficial da informação será sempre o arquivo:

```text
assessment.json
```

### Papel de cada item

```text
Transcrição = insumo bruto
Template = apresentação / layout
assessment.json = fonte da verdade
DOCX = saída editável
PDF = saída final de leitura
```

O relatório final não deve ser a fonte da verdade. Ele é uma saída gerada a partir do JSON aprovado.

---

## 5. Arquitetura oficial

```text
[3DEXPERIENCE / 3DDashboard]
              ↓
[Widget Frontend - GitHub Pages]
              ↓
[Backend Render]
              ↓
[Parser / IA / Validação / Geração DOCX]
              ↓
[assessment.json + relatório final]
```

### Frontend

Responsabilidades do frontend:

```text
- exibir a interface do widget;
- orientar seleção manual da transcrição;
- orientar seleção manual do template;
- aceitar upload local;
- aceitar texto colado manualmente;
- permitir retorno do usuário após abrir bookmark;
- preservar estado do trabalho;
- exibir assessment.json em formato editável;
- permitir revisão de seções;
- permitir aprovação de seções;
- permitir regeneração isolada de seções;
- solicitar geração do DOCX ao backend;
- exibir mensagens de erro claras.
```

### Backend Render

Responsabilidades do backend:

```text
- receber transcrição;
- extrair texto de DOCX/TXT/MD quando aplicável;
- receber template DOCX quando aplicável;
- chamar o serviço de IA;
- executar prompts oficiais;
- gerar assessment.json;
- validar JSON contra schema oficial;
- gerar relatório DOCX editável;
- retornar arquivos ao frontend;
- manter segredos e API keys fora do frontend;
- registrar logs técnicos mínimos;
- bloquear fallback silencioso.
```

### GitHub

Responsabilidades do GitHub:

```text
- armazenar código oficial;
- versionar documentação;
- versionar prompts;
- versionar schemas;
- versionar templates de exemplo;
- versionar frontend;
- versionar backend;
- permitir rastreabilidade por commit.
```

---

## 6. Premissa de segurança

O widget frontend nunca deve armazenar chaves sensíveis.

Proibido no frontend:

```text
- OPENAI_API_KEY;
- tokens privados;
- credenciais do Render;
- cookies do 3DEXPERIENCE;
- secrets de integração;
- tokens pessoais de GitHub;
- qualquer segredo em HTML, JS ou CSS público.
```

Regra:

```text
O widget chama o backend Render.
O backend Render chama a IA.
```

---

## 7. Premissas de entrada de dados

### 7.1 Transcrição

A transcrição pode vir de:

```text
1. Arquivo local no PC do usuário.
2. Arquivo disponível em bookmark.
3. Texto colado manualmente no widget.
```

### 7.2 Template

O template de saída pode vir de:

```text
1. Arquivo local no PC do usuário.
2. Arquivo disponível em bookmark.
3. Biblioteca oficial futura do widget.
```

### 7.3 Bookmark

No MVP, o widget não precisa buscar automaticamente arquivos dentro da bookmark.

Fluxo correto para bookmark:

```text
1. Usuário está no widget.
2. Usuário clica/orienta abertura da bookmark.
3. Usuário seleciona ou baixa manualmente o arquivo.
4. Usuário volta para o widget.
5. Widget preserva o estado anterior.
6. Usuário faz upload/input manual do arquivo.
7. Fluxo continua do ponto salvo.
```

Premissa:

```text
Bookmark é origem operacional manual no MVP.
Widget é orquestrador.
Render é processador.
```

---

## 8. Premissas de edição

Todo conteúdo gerado precisa ser editável.

Não pode existir saída operacional baseada apenas em imagem fixa para:

```text
- mapa de software;
- mapa de gaps;
- radar de gaps;
- fluxos AS-IS;
- fluxos TO-BE;
- roadmap;
- matriz esforço x impacto;
- tabelas de riscos;
- recomendações.
```

Regra:

```text
Imagem pode existir como preview.
Dado editável é a fonte oficial.
```

### Exemplos de estrutura editável

#### Mapa de software

```json
{
  "software_map": [
    {
      "area": "Engenharia",
      "software": "3DEXPERIENCE",
      "usage": "Gestão de estrutura de produto",
      "pain_points": ["Baixa padronização", "Uso parcial"],
      "integrations": ["ERP"],
      "evidence": "Cliente citou uso do 3DEXPERIENCE para estrutura de produto."
    }
  ]
}
```

#### Fluxo AS-IS

```json
{
  "flows": [
    {
      "name": "Liberação de BOM",
      "type": "AS-IS",
      "steps": [
        {
          "order": 1,
          "area": "Engenharia",
          "activity": "Cria estrutura de produto",
          "system": "3DEXPERIENCE"
        },
        {
          "order": 2,
          "area": "Manufatura",
          "activity": "Revisa dados manualmente",
          "system": "ERP"
        }
      ]
    }
  ]
}
```

#### Radar de gaps

O radar deve ser derivado dos gaps classificados.

```json
{
  "gap_radar": [
    {
      "category": "Processo",
      "score": 4,
      "source_gaps": ["GAP-001", "GAP-002"]
    },
    {
      "category": "Dados",
      "score": 3,
      "source_gaps": ["GAP-003"]
    }
  ]
}
```

---

## 9. Evidência, hipótese e recomendação

O sistema precisa separar claramente:

```text
Fato = informação citada ou confirmada na transcrição.
Hipótese = interpretação provável, mas ainda não confirmada.
Recomendação = sugestão técnica/consultiva baseada nos fatos e hipóteses.
Pendência = informação não encontrada ou que precisa de follow-up.
```

### Regra de confiança

```text
Sem evidência, não é fato.
Sem confirmação, entra como hipótese.
Sem dado suficiente, entra como pergunta aberta.
```

### Exemplo de gap

```json
{
  "id": "GAP-001",
  "description": "Ausência de workflow formal de liberação de BOM",
  "category": "Processo",
  "impact": "Alto",
  "evidence": "Cliente informou que a liberação ocorre por e-mail e planilha.",
  "confidence": "Alta",
  "recommendation": "Definir fluxo oficial de aprovação e liberação no PLM.",
  "status": "Pendente de revisão"
}
```

---

## 10. Revisão humana obrigatória

Nada deve entrar no relatório final sem revisão.

Cada seção precisa ter status:

```text
Pendente
Revisado
Aprovado
Rejeitado
Regenerar
```

Seções mínimas:

```text
- Resumo executivo
- Contexto do cliente
- Mapa de software
- Mapa de gaps
- Radar de gaps
- Fluxos AS-IS
- Fluxos TO-BE
- Riscos
- Recomendações
- Roadmap
- Perguntas abertas
```

Regra:

```text
Relatório final só usa dados aprovados ou explicitamente marcados pelo usuário para inclusão.
```

---

## 11. Modos de geração

O widget deverá suportar modos de geração.

### Modo Conservador

```text
Usa somente informações explicitamente citadas na transcrição.
Não cria inferências fortes.
Ideal para relatório técnico auditável.
```

### Modo Consultivo

```text
Usa informações citadas e inferências sinalizadas como hipótese.
É o modo padrão recomendado.
```

### Modo Executivo

```text
Gera texto mais polido para diretoria.
Mantém rastreabilidade, mas prioriza clareza e síntese.
```

---

## 12. Template de saída

O template de saída não deve ser apenas um DOCX visualmente bonito.

Ele precisa ser operacional.

### Template operacional

Um template operacional deve conter:

```text
- seções esperadas;
- placeholders;
- mapa de campos;
- suporte para tabelas;
- suporte para listas;
- suporte para blocos repetíveis;
- compatibilidade com assessment.schema.json.
```

### Exemplo de placeholders

```text
{{client.name}}
{{assessment.date}}
{{executive_summary.current_state}}
{{executive_summary.main_pains}}
{{software_map}}
{{gap_map}}
{{recommendations}}
```

### Regra

```text
Template é apresentação.
Schema é estrutura.
assessment.json é fonte da verdade.
```

---

## 13. Validação de template

Antes de gerar relatório, o backend deve validar o template.

Validações mínimas:

```text
- template foi enviado;
- formato suportado;
- placeholders obrigatórios existem;
- seções mínimas existem;
- campos repetíveis são compatíveis;
- campos ausentes são reportados ao usuário;
- nenhuma seção crítica é ignorada silenciosamente.
```

Se o template não tiver uma seção, o sistema deve avisar.

Exemplo:

```text
A seção "Radar de Gaps" não foi encontrada no template selecionado.
Escolha uma ação:
1. Ignorar seção
2. Inserir como tabela no apêndice
3. Selecionar outro template
```

---

## 14. Zero fallback silencioso

Esta regra é obrigatória.

Proibido:

```text
- inventar dado quando a transcrição não traz informação;
- gerar relatório sem avisar campo ausente;
- trocar template automaticamente sem informar;
- usar mock como se fosse dado real;
- usar fallback de cliente/teste como se fosse produção;
- esconder erro do usuário;
- gerar imagem fixa quando a premissa exige dado editável.
```

Regra:

```text
Erro precisa ser visível.
Ausência de dado precisa ser visível.
Incerteza precisa ser visível.
```

---

## 15. Estado do widget

Como o usuário pode sair para bookmark e voltar, o widget precisa preservar estado.

Estado mínimo:

```text
- sessão atual do assessment;
- nome do cliente;
- tipo de assessment;
- transcrição carregada;
- origem da transcrição;
- template selecionado;
- origem do template;
- assessment.json gerado;
- edições do usuário;
- status de revisão por seção;
- versão atual;
- erros e pendências;
- última etapa concluída.
```

Possíveis mecanismos:

```text
- localStorage para MVP simples;
- IndexedDB para arquivos e payloads maiores;
- backend session storage em fase futura;
- export/import de assessment.json para recuperação manual.
```

Regra:

```text
O usuário pode sair e voltar sem perder o fluxo.
```

---

## 16. Versionamento do assessment

Cada assessment deve ter versão.

Exemplo:

```text
v0.1 - Extração inicial
v0.2 - Revisão do consultor
v0.3 - Ajuste de gaps
v1.0 - Relatório aprovado
```

O JSON deve conter metadados:

```json
{
  "metadata": {
    "assessment_id": "ASSESS-2026-0001",
    "client_name": "Cliente XPTO",
    "version": "0.1",
    "status": "draft",
    "created_at": "2026-06-25T00:00:00-03:00",
    "updated_at": "2026-06-25T00:00:00-03:00"
  }
}
```

---

## 17. Estrutura mínima do assessment.json

```json
{
  "metadata": {},
  "client": {},
  "input_sources": {},
  "executive_summary": {},
  "meeting_summary": {},
  "software_map": [],
  "process_map": [],
  "gap_map": [],
  "gap_radar": [],
  "flows": [],
  "risks": [],
  "recommendations": [],
  "roadmap": [],
  "open_questions": [],
  "appendix": {},
  "review_status": {}
}
```

---

## 18. Estrutura de diretórios recomendada

```text
Assessment-Report-Builder/
│
├── README.md
│
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── assessment-controller.js
│   ├── assessment-ui.js
│   ├── assessment-state.js
│   ├── assessment-api-client.js
│   ├── config.js
│   └── styles.css
│
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── routes/
│   │   ├── health.routes.js
│   │   ├── extract.routes.js
│   │   ├── assessment.routes.js
│   │   ├── validate.routes.js
│   │   └── report.routes.js
│   │
│   ├── services/
│   │   ├── transcript-parser.service.js
│   │   ├── ai-extraction.service.js
│   │   ├── schema-validator.service.js
│   │   ├── template-validator.service.js
│   │   ├── docx-generator.service.js
│   │   ├── evidence.service.js
│   │   └── versioning.service.js
│   │
│   ├── prompts/
│   │   ├── executive-summary.prompt.txt
│   │   ├── software-map.prompt.txt
│   │   ├── gap-map.prompt.txt
│   │   ├── flows.prompt.txt
│   │   ├── recommendations.prompt.txt
│   │   └── roadmap.prompt.txt
│   │
│   ├── schemas/
│   │   └── assessment.schema.json
│   │
│   └── templates/
│       ├── assessment-template.example.docx
│       └── template-map.example.json
│
└── docs/
    ├── ARCHITECTURE.md
    ├── PREMISES.md
    ├── API_CONTRACT.md
    ├── TEMPLATE_RULES.md
    ├── ASSESSMENT_SCHEMA.md
    └── ROADMAP.md
```

---

## 19. Controller oficial

O frontend deve ter um controller oficial:

```text
assessment-controller.js
```

Responsabilidades:

```text
- inicializar widget;
- carregar configuração;
- recuperar estado salvo;
- controlar seleção de transcrição;
- controlar seleção de template;
- chamar backend;
- receber assessment.json;
- renderizar editor de seções;
- controlar status de revisão;
- controlar geração do relatório;
- bloquear fluxos concorrentes;
- exibir erros claros.
```

Regra:

```text
1 controller oficial.
1 fluxo operacional.
0 finalizadores concorrentes.
0 fallback silencioso.
```

---

## 20. API backend inicial

### Health

```text
GET /health
```

Resposta esperada:

```json
{
  "ok": true,
  "service": "assessment-report-builder-backend",
  "version": "0.1.0"
}
```

### Extração de transcrição

```text
POST /api/transcript/extract
```

Entrada:

```text
multipart/form-data
- transcript_file
```

Saída:

```json
{
  "ok": true,
  "text": "Texto extraído da transcrição...",
  "source": {
    "type": "local_upload",
    "filename": "transcricao.docx"
  }
}
```

### Geração do assessment

```text
POST /api/assessment/generate
```

Entrada:

```json
{
  "transcript_text": "...",
  "assessment_type": "plm_assessment",
  "generation_mode": "consultivo"
}
```

Saída:

```json
{
  "ok": true,
  "assessment": {}
}
```

### Validação do assessment

```text
POST /api/assessment/validate
```

Entrada:

```json
{
  "assessment": {}
}
```

Saída:

```json
{
  "ok": true,
  "valid": true,
  "errors": [],
  "warnings": []
}
```

### Geração do relatório

```text
POST /api/report/generate-docx
```

Entrada:

```text
multipart/form-data
- assessment_json
- template_docx
```

Saída:

```json
{
  "ok": true,
  "file_url": "...",
  "filename": "assessment-report.docx"
}
```

---

## 21. Variáveis de ambiente no Render

Variáveis previstas:

```text
NODE_ENV=production
PORT=10000
OPENAI_API_KEY=<secret>
ASSESSMENT_ALLOWED_ORIGINS=<github_pages_url>
MAX_UPLOAD_MB=25
LOG_LEVEL=info
```

Regras:

```text
- secrets ficam somente no Render;
- frontend público nunca recebe API key;
- CORS deve permitir apenas o domínio oficial do widget;
- backend deve responder /health para validação de deploy.
```

---

## 22. Integração com 3DEXPERIENCE

No MVP, a integração com 3DEXPERIENCE será assistida e manual.

### Permitido no MVP

```text
- widget rodando dentro do 3DDashboard;
- usuário abrir bookmark manualmente;
- usuário selecionar/baixar arquivo manualmente;
- usuário voltar ao widget;
- widget preservar estado;
- usuário fazer upload/input manual;
- widget registrar origem informada.
```

### Evitar no MVP

```text
- buscar arquivo automaticamente na bookmark;
- depender de cookie/CAS do usuário;
- fazer scraping de DOM;
- usar clipboard como fluxo principal;
- depender de permissões complexas de documento;
- salvar automaticamente no 3DEXPERIENCE sem contrato validado;
- considerar abertura visual como sucesso de integração.
```

### Evolução futura

Depois do MVP estável, avaliar com documentação oficial:

```text
- PlatformAPI;
- WAFData;
- contexto do dashboard;
- leitura controlada de documentos;
- gravação controlada de saída;
- integração com bookmark/documentos;
- registro de origem do arquivo dentro da plataforma.
```

---

## 23. Saídas do projeto

O sistema deve gerar, conforme fase:

```text
- assessment.json;
- assessment-reviewed.json;
- relatório DOCX editável;
- PDF final de leitura;
- tabela de gaps exportável;
- tabela de software exportável;
- resumo da reunião;
- perguntas abertas;
- roadmap;
- log de evidências.
```

### Regra DOCX

O DOCX deve ser editável.

Evitar:

```text
- tabelas como imagem;
- radar como imagem fixa sem dados;
- fluxos como PNG sem estrutura;
- prints;
- elementos rasterizados como única fonte;
- conteúdo travado.
```

---

## 24. MVPs planejados

### MVP 1 - Assessment JSON Builder

Objetivo:

```text
Gerar assessment.json a partir de transcrição e permitir revisão/editabilidade no widget.
```

Escopo:

```text
- frontend básico;
- backend Render;
- upload de TXT/DOCX;
- extração de texto;
- prompts por seção;
- geração de assessment.json;
- editor visual simples;
- exportação JSON.
```

### MVP 2 - DOCX Generator

Objetivo:

```text
Gerar relatório DOCX editável a partir de assessment.json aprovado e template selecionado.
```

Escopo:

```text
- upload de template DOCX;
- validação de placeholders;
- geração de relatório;
- tabelas nativas editáveis;
- download do DOCX.
```

### MVP 3 - Bookmark Assisted Flow

Objetivo:

```text
Apoiar o uso com bookmark no 3DEXPERIENCE sem depender de automação invisível.
```

Escopo:

```text
- instruções guiadas no widget;
- preservar estado ao sair/voltar;
- registrar origem manual;
- recuperar sessão;
- checklist de arquivos selecionados.
```

### MVP 4 - Integração 3DEXPERIENCE avançada

Objetivo:

```text
Avaliar leitura/gravação controlada via APIs oficiais do 3DEXPERIENCE.
```

Escopo futuro:

```text
- leitura de contexto;
- integração com documentos;
- salvar saída na plataforma;
- rastreabilidade por objeto/documento;
- validação com permissões reais.
```

---

## 25. Critérios de aceite

### Critério 1 - Link fixo

```text
O widget deve funcionar no mesmo link oficial mesmo após novas versões.
```

### Critério 2 - Sem segredo no frontend

```text
Nenhuma chave sensível pode aparecer no código público.
```

### Critério 3 - JSON antes do relatório

```text
Toda geração de relatório deve passar primeiro por assessment.json.
```

### Critério 4 - Editabilidade

```text
Mapa de software, gaps, radar, fluxos, recomendações e roadmap devem ser editáveis.
```

### Critério 5 - Evidência

```text
Gaps e conclusões relevantes devem conter evidência, hipótese ou pendência.
```

### Critério 6 - Revisão humana

```text
Seções geradas precisam ser revisáveis antes de entrar no relatório final.
```

### Critério 7 - Erros visíveis

```text
Campos ausentes, template incompatível e falhas de processamento devem ser exibidos ao usuário.
```

### Critério 8 - Sem fallback silencioso

```text
O sistema não pode usar dados fake, mock ou fallback sem informar claramente.
```

---

## 26. Regras de desenvolvimento

```text
1. Manter o link oficial do widget imutável.
2. Manter frontend e backend separados.
3. Não colocar segredo no frontend.
4. Criar um controller oficial.
5. Criar um schema oficial.
6. Criar prompts separados por seção.
7. Validar JSON antes de renderizar relatório.
8. Validar template antes de gerar DOCX.
9. Não gerar imagens fixas como única saída.
10. Não criar fallback silencioso.
11. Registrar erro de forma clara.
12. Versionar alterações por commit.
13. Manter documentação atualizada.
```

---

## 27. Próximos passos sugeridos

### Fase imediata

```text
1. Criar estrutura base frontend/ e backend/.
2. Criar frontend/index.html como entrypoint oficial.
3. Criar backend/server.js com rota /health.
4. Configurar deploy no Render.
5. Registrar URL pública do Render nesta documentação.
6. Configurar GitHub Pages.
7. Definir URL oficial do widget.
8. Criar assessment.schema.json.
9. Criar primeiro prompt de resumo executivo.
10. Criar primeiro fluxo: transcrição texto → assessment.json.
```

### Primeira entrega funcional

```text
Usuário cola uma transcrição no widget, clica em gerar, recebe assessment.json editável e consegue exportar o JSON.
```

### Segunda entrega funcional

```text
Usuário faz upload de transcrição DOCX/TXT, gera assessment.json, revisa mapa de software e gaps, e exporta JSON.
```

### Terceira entrega funcional

```text
Usuário faz upload de template DOCX, gera relatório editável a partir do JSON aprovado e baixa o arquivo final.
```

---

## 28. Frase guia do projeto

```text
Nada que o usuário não consiga revisar deve entrar no relatório.
Nada que o usuário não consiga editar deve ser considerado saída oficial.
Nada que não tenha evidência deve ser apresentado como fato.
O link oficial do widget nunca muda.
```

---

## 29. Status atual

```text
Repositório criado.
Render criado.
Documentação inicial criada.
Arquitetura definida.
Premissas principais definidas.
Próxima etapa: criar estrutura base do código e health check do backend.
```
