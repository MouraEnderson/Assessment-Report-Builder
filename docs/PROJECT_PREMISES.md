# Premissas oficiais — Assessment Report Builder

## 1. Propósito

O Assessment Report Builder transforma transcrições de reuniões de assessment em conhecimento estruturado, revisável, rastreável e editável.

```text
Transcrição bruta
      ↓
Extração estruturada
      ↓
assessment.json
      ↓
Revisão humana
      ↓
Dados aprovados
      ↓
Relatório editável
```

O projeto não é apenas um resumidor de reunião. Ele é um construtor controlado de assessment.

---

## 2. Premissa mestre — link imutável

O link oficial usado pelo 3DEXPERIENCE / 3DDashboard nunca pode mudar.

### Regra operacional

```text
1 URL oficial
1 entrypoint externo
1 fluxo de inicialização
1 controller oficial
0 links concorrentes
0 troca de endereço por versão
```

As versões do frontend, backend, prompts, schemas e serviços podem mudar internamente, mas a URL externa registrada no dashboard deve permanecer a mesma.

### Topologia adotada no MVP

```text
3DEXPERIENCE / 3DDashboard
            ↓
URL pública fixa do Render
            ↓
frontend/index.html + API backend
```

O GitHub é a fonte do código e da documentação. O Render é o entrypoint operacional.

### Restrições depois da publicação

```text
- não renomear o serviço Render;
- não excluir e recriar o serviço com outra URL;
- não apontar o dashboard para arquivos internos versionados;
- manter `/` como entrypoint oficial;
- preservar compatibilidade com o link raiz.
```

---

## 3. Repositório e infraestrutura

### Repositório oficial

```text
https://github.com/MouraEnderson/Assessment-Report-Builder.git
```

### Serviço Render administrativo

```text
https://dashboard.render.com/web/srv-d8umn177f7vs739rab5g
```

O endereço acima é administrativo e não deve ser usado como link do widget.

A URL pública do serviço deverá ser registrada após o primeiro deploy concluído.

---

## 4. Fonte da verdade

A fonte oficial de informação é:

```text
assessment.json
```

### Papel de cada elemento

```text
Transcrição = insumo bruto
Template = apresentação e layout
assessment.json = fonte da verdade
DOCX = saída editável
PDF = saída final de leitura
```

A transcrição nunca deve preencher diretamente o relatório.

```text
Transcrição não vira relatório direto.
Transcrição vira conhecimento estruturado.
Conhecimento estruturado vira relatório.
```

---

## 5. Origens da transcrição

A transcrição poderá ser fornecida por:

```text
1. Texto colado manualmente.
2. Arquivo local do computador.
3. Arquivo selecionado ou baixado manualmente de uma bookmark.
```

### Fluxo da bookmark no MVP

```text
1. Usuário inicia o trabalho no widget.
2. Widget preserva o estado atual.
3. Usuário abre a bookmark manualmente.
4. Usuário seleciona ou baixa o documento.
5. Usuário volta ao widget.
6. Usuário envia o arquivo ou cola o texto.
7. Widget continua do ponto salvo.
```

O MVP não depende de busca automática dentro da bookmark.

---

## 6. Origens do template

O template de saída poderá ser fornecido por:

```text
1. Arquivo local do computador.
2. Arquivo selecionado ou baixado manualmente de uma bookmark.
3. Biblioteca oficial futura do sistema.
```

O widget não deve assumir silenciosamente qual template usar. A seleção deve ser explícita.

---

## 7. Estado persistente

O usuário precisa conseguir sair do widget e voltar sem perder o trabalho.

Estado mínimo a preservar:

```text
- cliente;
- área;
- tipo de assessment;
- modo de geração;
- transcrição;
- origem da transcrição;
- template selecionado;
- origem do template;
- assessment.json;
- edições do usuário;
- validação;
- status de revisão;
- versão;
- última etapa concluída;
- erros e pendências.
```

### Estratégia por fase

```text
MVP 1: localStorage
MVP 1.2: IndexedDB para arquivos maiores
Fase futura: persistência controlada no backend
```

---

## 8. Editabilidade obrigatória

Todo conteúdo operacional deve existir como dado editável.

Não podem existir somente como imagem fixa:

```text
- mapa de software;
- mapa de gaps;
- radar de gaps;
- fluxos AS-IS;
- fluxos TO-BE;
- roadmap;
- matriz esforço x impacto;
- riscos;
- recomendações;
- tabelas de maturidade.
```

### Regra

```text
Imagem pode ser preview.
Dado editável é a fonte oficial.
```

---

## 9. Mapa de software

O mapa de software não deve ser apenas uma lista de nomes.

Campos esperados:

```text
- identificador;
- software;
- área usuária;
- finalidade;
- processo atendido;
- integrações;
- dores;
- dependências;
- riscos;
- oportunidades;
- evidência;
- confiança.
```

O usuário precisa conseguir adicionar, remover e editar registros.

---

## 10. Mapa de gaps

Cada gap deve ser estruturado e rastreável.

Campos esperados:

```text
- identificador;
- descrição;
- categoria;
- impacto;
- evidência;
- nível de confiança;
- classificação;
- recomendação inicial;
- status de revisão.
```

### Regra

```text
Sem evidência, não é fato.
Sem confirmação, é hipótese.
Sem informação suficiente, é pendência.
```

---

## 11. Radar de gaps

O radar não deve possuir dados independentes dos gaps.

```text
Gaps classificados
      ↓
Agregação por categoria
      ↓
Score sugerido
      ↓
Revisão do usuário
      ↓
Radar visual
```

O usuário pode editar o score, mas a origem do score deve continuar rastreável.

---

## 12. Fluxos AS-IS e TO-BE

Fluxos devem nascer como estruturas de etapas editáveis, não como imagens.

Campos de etapa esperados:

```text
- ordem;
- área;
- atividade;
- sistema;
- entrada;
- saída;
- responsável;
- problema;
- observação.
```

O desenho visual será uma renderização desses dados.

---

## 13. Fato, hipótese, recomendação e pendência

O sistema deve separar claramente:

```text
Fato = informação explicitamente citada ou confirmada.
Hipótese = interpretação ainda não validada.
Recomendação = orientação consultiva baseada em dados.
Pendência = informação ausente ou que exige follow-up.
```

A IA não pode misturar esses conceitos em um texto sem classificação.

---

## 14. Evidência e confiança

Informações relevantes devem conter evidência ou indicação explícita de ausência.

Níveis de confiança iniciais:

```text
Alta
Média
Baixa
Não avaliada
```

Exemplo:

```json
{
  "description": "Ausência de workflow formal de liberação de BOM",
  "classification": "Fato",
  "evidence": "O cliente informou que a liberação ocorre por e-mail e planilha.",
  "confidence": "Alta"
}
```

---

## 15. Revisão humana obrigatória

Nenhuma seção gerada deve ser considerada final sem revisão.

Estados oficiais:

```text
Pendente
Revisado
Aprovado
Rejeitado
Regenerar
```

Seções mínimas de revisão:

```text
- resumo executivo;
- contexto do cliente;
- mapa de software;
- mapa de processos;
- mapa de gaps;
- radar de gaps;
- fluxos;
- riscos;
- recomendações;
- roadmap;
- perguntas abertas.
```

O relatório final só deve usar dados aprovados ou explicitamente autorizados pelo usuário.

---

## 16. Modos de geração

### Conservador

Usa apenas informações explícitas da transcrição.

### Consultivo

Usa informações explícitas e inferências identificadas como hipóteses.

É o modo padrão recomendado.

### Executivo

Gera linguagem mais resumida para liderança, mantendo rastreabilidade e sem transformar hipótese em fato.

---

## 17. Schema oficial

O contrato oficial está em:

```text
backend/schemas/assessment.schema.json
```

Estrutura mínima:

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

### Regra

```text
Nada entra no relatório sem passar pelo schema.
```

---

## 18. Template operacional

Um template não é apenas um documento visual.

Ele deverá possuir:

```text
- identificador;
- versão;
- seções esperadas;
- placeholders;
- blocos repetíveis;
- suporte a tabelas;
- mapa de campos;
- compatibilidade com o schema.
```

### Separação de responsabilidades

```text
Schema define o que existe.
Template define como apresentar.
assessment.json contém os dados.
```

---

## 19. Validação do template

Antes de gerar DOCX, o sistema deverá verificar:

```text
- formato suportado;
- placeholders obrigatórios;
- seções mínimas;
- blocos repetíveis;
- campos ausentes;
- incompatibilidades com o schema.
```

Nenhuma seção crítica deve ser omitida silenciosamente.

---

## 20. Arquivo final editável

A saída principal será DOCX editável.

Priorizar:

```text
- textos nativos;
- tabelas nativas;
- listas nativas;
- seções editáveis;
- dados de gráficos preservados;
- fluxos derivados de dados estruturados.
```

Evitar:

```text
- prints;
- tabelas rasterizadas;
- radar somente em PNG;
- fluxo somente em imagem;
- elementos travados sem necessidade.
```

PDF será uma saída de leitura, não a fonte editável.

---

## 21. Edição antes e depois da geração

### Dentro do widget

É a edição oficial e deve atualizar o `assessment.json`.

### No DOCX final

O usuário também poderá alterar o documento manualmente.

Alterações feitas diretamente no DOCX não retornam automaticamente para o JSON, salvo futura função de reimportação.

---

## 22. Regeneração isolada

Cada seção poderá ser regenerada sem apagar o restante.

Exemplos:

```text
- regenerar resumo executivo;
- regenerar mapa de software;
- regenerar gaps;
- regenerar recomendações;
- regenerar roadmap.
```

Conteúdo já revisado não deve ser substituído sem confirmação.

---

## 23. Versionamento

Cada assessment deve possuir versão.

Exemplo:

```text
v0.1 — extração inicial
v0.2 — revisão do consultor
v0.3 — ajustes do cliente
v1.0 — aprovado
```

Metadados mínimos:

```text
- assessment_id;
- version;
- status;
- created_at;
- updated_at;
- assessment_type;
- generation_mode.
```

---

## 24. Saídas previstas

```text
- assessment.json;
- assessment-reviewed.json;
- relatório DOCX;
- PDF;
- tabela de softwares;
- tabela de gaps;
- resumo da reunião;
- perguntas abertas;
- roadmap;
- log de evidências.
```

---

## 25. Segurança

O frontend nunca deverá conter:

```text
- API keys;
- tokens privados;
- credenciais do Render;
- tokens pessoais do GitHub;
- cookies do 3DEXPERIENCE;
- secrets de integração.
```

Regra:

```text
Frontend chama backend.
Backend chama serviços privados.
```

---

## 26. Zero fallback silencioso

É proibido:

```text
- inventar dado ausente;
- transformar hipótese em fato;
- usar mock como dado real;
- trocar template sem aviso;
- ignorar seção ausente;
- ocultar falha de validação;
- gerar resultado fake para parecer completo;
- usar cliente ou exemplo de teste como produção.
```

Erro, ausência e incerteza precisam ser visíveis.

---

## 27. Controller oficial

O controller principal do frontend é:

```text
frontend/assessment-controller.js
```

Responsabilidades:

```text
- inicialização;
- recuperação de estado;
- controle de inputs;
- chamadas de API;
- recebimento do JSON;
- edição;
- validação;
- revisão;
- exportação;
- mensagens de erro;
- bloqueio de fluxos concorrentes.
```

Regra:

```text
1 controller oficial
1 fluxo oficial
0 finalizadores concorrentes
0 fallback silencioso
```

---

## 28. Responsabilidades por camada

### GitHub

```text
- código oficial;
- documentação;
- histórico;
- schemas;
- prompts;
- exemplos;
- CI.
```

### Render

```text
- link operacional;
- frontend;
- API;
- segredos;
- IA;
- parsing;
- validação;
- geração de documentos.
```

### 3DEXPERIENCE

```text
- ambiente operacional;
- abertura do widget;
- acesso manual a bookmarks no MVP;
- origem/destino futuro de documentos.
```

### Usuário

```text
- escolher a transcrição;
- escolher o template;
- revisar dados;
- editar dados;
- aprovar seções;
- confirmar geração final.
```

---

## 29. Fases de entrega

### MVP 1

```text
Texto colado → assessment.json vazio/estruturado → edição → validação → exportação
```

### MVP 1.1

```text
Editor visual por seção + importação de JSON
```

### MVP 1.2

```text
Upload TXT/DOCX + extração de texto + origem local/bookmark
```

### MVP 2

```text
Extração com IA por seção, evidência e confiança
```

### MVP 3

```text
Template DOCX + validação + relatório editável
```

### MVP 4

```text
Integração avançada com APIs oficiais do 3DEXPERIENCE
```

---

## 30. Critérios de aceite gerais

```text
- link oficial permanece fixo;
- backend responde health check;
- nenhum segredo está no frontend;
- JSON atende ao schema;
- estado pode ser recuperado;
- conteúdo é editável;
- erro é visível;
- nenhuma conclusão falsa é criada;
- relatório usa dados aprovados;
- saída DOCX é editável.
```

---

## 31. Regras de ouro

```text
Nada que o usuário não consiga revisar deve entrar no relatório.
Nada que o usuário não consiga editar deve ser considerado saída oficial.
Nada que não tenha evidência deve ser apresentado como fato.
O link oficial do widget nunca muda.
```
