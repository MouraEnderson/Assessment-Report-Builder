# ADR-001 — 3DDashboard Additional App com WAFData

## Status

Aceito.

---

## Contexto

O Assessment Report Builder precisa rodar dentro do 3DEXPERIENCE e futuramente acessar contexto, bookmarks e documentos usando a sessão já autenticada do usuário.

Tentativas de tratar o widget como HTML externo comum levaram a sintomas incompatíveis com o contrato real do 3DEXPERIENCE:

```text
- HTML aparecendo sem CSS;
- JavaScript não executando;
- status travado em carregamento;
- console indicando proxy do 3DEXPERIENCE buscando recurso como JS.
```

O projeto BOM Analytics já validou um caminho operacional em 3DEXPERIENCE:

```text
Runtime: 3DDashboard Additional App
Acesso autenticado: WAFData
Dados PLM: 3DSpace REST resolvido via i3DXCompassServices
```

---

## Decisão

O Assessment Report Builder adotará o mesmo padrão de runtime:

```text
3DDashboard Additional App
        ↓
XHTML entrypoint com namespace widget
        ↓
CSS externo
        ↓
JavaScript externo
        ↓
WAFData/i3DXCompassServices/PlatformAPI no frontend
        ↓
Render apenas como backend de processamento
```

---

## Consequências

### Positivas

```text
- respeita o runtime do 3DEXPERIENCE;
- usa a sessão logada sem CAS;
- evita captura ou transporte de credenciais para o Render;
- mantém o link oficial fixo;
- elimina iframe shell;
- elimina HTML inline como base final;
- permite evoluir para bookmark/documentos com WAFData.
```

### Restrições

```text
- o widget deve ser adicionado como Additional App;
- Web Page Reader não é runtime oficial;
- chamadas a dados 3DEXPERIENCE devem usar WAFData no frontend;
- Render não pode chamar 3DEXPERIENCE diretamente em nome do usuário.
```

---

## Link oficial

```text
https://assessment-report-builder.onrender.com/
```

Esse link continua imutável.

---

## Versão de implementação

```text
assessment-0.4.3
```
