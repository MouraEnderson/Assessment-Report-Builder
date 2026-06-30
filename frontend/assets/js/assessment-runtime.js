/* Assessment Report Builder — 3DEXPERIENCE Additional App runtime */
(function (global, document) {
  'use strict';

  var BUILD = 'assessment-0.4.3';
  var STORAGE_KEY = 'assessment-report-builder.state.v1';
  var MIN_TRANSCRIPT_LENGTH = 20;
  var state = loadState();
  var els = {};

  try {
    if (global.console && global.console.log) {
      global.console.log('[Assessment] runtime loaded', BUILD);
    }
  } catch (ignoreLog) {}

  function trim(value) {
    return String(value || '').replace(/^\s+|\s+$/g, '');
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function ensureRoot() {
    var root = byId('assessment-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'assessment-root';
      root.className = 'assessment-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function setStatus(element, message, kind) {
    if (!element) return;
    element.className = element.className.replace(/\s+(ok|warn|err|success|error|warning|working)/g, '');
    if (kind) element.className += ' ' + kind;
    element.textContent = message;
  }

  function loadState() {
    try {
      return JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function saveState(next) {
    next.updatedAt = new Date().toISOString();
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {}
    state = next;
    return state;
  }

  function wordCount(text) {
    var normalized = trim(text);
    return normalized ? normalized.split(/\s+/).length : 0;
  }

  function sourceLabel(source) {
    if (!source || !source.type) return 'Nenhum documento importado.';
    var origin = source.type === 'bookmark_manual' ? 'Bookmark manual' : 'Arquivo local';
    var name = source.filename || 'documento .docx';
    var reference = source.origin_reference ? ' · ' + source.origin_reference : '';
    return origin + ': ' + name + reference;
  }

  function listItems(items) {
    if (!Array.isArray(items) || !items.length) return '<p class="assessment-empty">Sem itens estruturados.</p>';
    return '<ul class="assessment-list">' + items.map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('') + '</ul>';
  }

  function table(headers, rows) {
    if (!Array.isArray(rows) || !rows.length) return '<p class="assessment-empty">Sem dados estruturados.</p>';
    return '<div class="assessment-table-wrap"><table class="assessment-table"><thead><tr>' +
      headers.map(function (header) { return '<th>' + escapeHtml(header.label) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (row) {
        return '<tr>' + headers.map(function (header) {
          var value = typeof header.value === 'function' ? header.value(row) : row[header.key];
          return '<td>' + escapeHtml(value == null || value === '' ? '-' : value) + '</td>';
        }).join('') + '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function countLabel(label, value) {
    return '<span class="assessment-count"><strong>' + escapeHtml(value) + '</strong>' + escapeHtml(label) + '</span>';
  }

  function formatServerError(error, body) {
    var details;
    if (!body || !body.validation) return error.message;

    details = (body.validation.errors || []).slice(0, 3).map(function (item) {
      return (item.path || '/') + ' ' + (item.message || item.keyword || 'erro de schema');
    });

    if (!details.length) {
      details = (body.validation.warnings || []).slice(0, 3).map(function (item) {
        return (item.related_section || '/') + ' ' + (item.message || item.code || 'alerta');
      });
    }

    return details.length ? error.message + ' Detalhe: ' + details.join(' | ') : error.message;
  }

  function textValue(value, fallback) {
    if (value == null || value === '') return fallback || '-';
    if (Array.isArray(value)) return value.filter(Boolean).join('; ') || (fallback || '-');
    return String(value);
  }

  function renderQualityReview(review) {
    if (!review || typeof review !== 'object') {
      return '' +
        '<section class="assessment-preview-section">' +
          '<h3>Revisao de qualidade IA</h3>' +
          '<p class="assessment-empty">quality_review ausente. Gere novamente com IA V2 ou revise manualmente antes de exportar.</p>' +
        '</section>';
    }

    return '' +
      '<section class="assessment-preview-section">' +
        '<h3>Revisao de qualidade IA</h3>' +
        '<div class="assessment-preview-header">' +
          countLabel('Status', review.readiness || 'nao avaliado') +
          countLabel('Score', review.score == null ? '-' : review.score + '/100') +
          countLabel('Risco generico', review.generic_content_risk || 'nao avaliado') +
        '</div>' +
        '<p>' + escapeHtml(review.summary || 'Sem resumo de qualidade.') + '</p>' +
        '<h4>Bloqueios</h4>' +
        table([
          { label: 'Codigo', key: 'code' },
          { label: 'Mensagem', key: 'message' },
          { label: 'Secao', key: 'related_section' }
        ], review.blocking_issues || []) +
        '<h4>Alertas</h4>' +
        table([
          { label: 'Codigo', key: 'code' },
          { label: 'Mensagem', key: 'message' },
          { label: 'Secao', key: 'related_section' }
        ], review.warnings || []) +
        '<h4>Lacunas de evidencia</h4>' +
        listItems(review.evidence_gaps || []) +
      '</section>';
  }

  function renderReportModel(model) {
    var network;

    if (!model || typeof model !== 'object') return '';

    network = model.software_network || {};
    return '' +
      '<section class="assessment-preview-section">' +
        '<h3>Modelo consultivo para o template</h3>' +
        '<p>' + escapeHtml(model.executive_narrative || 'Sem narrativa executiva no report_model.') + '</p>' +
        '<h4>Narrativas por secao</h4>' +
        table([
          { label: 'Secao', key: 'title' },
          { label: 'Narrativa', key: 'narrative' },
          { label: 'Confianca', key: 'confidence' },
          { label: 'Evidencias', value: function (row) { return textValue(row.evidence_refs); } }
        ], model.section_narratives || []) +
        '<h4>Mapa de softwares</h4>' +
        '<p>' + escapeHtml(network.narrative || 'Sem narrativa do mapa de softwares.') + '</p>' +
        table([
          { label: 'No', key: 'label' },
          { label: 'Tipo', key: 'type' },
          { label: 'Descricao', key: 'description' },
          { label: 'Evidencias', value: function (row) { return textValue(row.evidence_refs); } }
        ], network.nodes || []) +
        '<h4>Relacoes entre softwares</h4>' +
        table([
          { label: 'Origem', key: 'source' },
          { label: 'Destino', key: 'target' },
          { label: 'Relacao', key: 'label' },
          { label: 'Tipo', key: 'type' }
        ], network.links || []) +
        '<h4>Fluxos de processo IA</h4>' +
        table([
          { label: 'Tipo', key: 'type' },
          { label: 'Titulo', key: 'title' },
          { label: 'Narrativa', key: 'narrative' },
          { label: 'Etapas', value: function (row) { return (row.steps || []).length; } },
          { label: 'Confianca', key: 'confidence' }
        ], model.process_flows || []) +
        '<h4>Analise de gaps IA</h4>' +
        table([
          { label: 'Gap', key: 'title' },
          { label: 'Analise', key: 'analysis' },
          { label: 'Impacto', key: 'impact' },
          { label: 'Recomendacao', key: 'recommendation' },
          { label: 'Confianca', key: 'confidence' }
        ], model.gap_analysis || []) +
        '<h4>Radar IA</h4>' +
        table([
          { label: 'Categoria', key: 'category' },
          { label: 'Atual', key: 'score' },
          { label: 'Alvo', key: 'target' },
          { label: 'Justificativa', key: 'justification' }
        ], model.maturity_radar || []) +
      '</section>';
  }

  function request(method, url, payload, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    if (payload) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var body = null;
      try {
        body = JSON.parse(xhr.responseText || '{}');
      } catch (parseError) {
        callback(new Error('Resposta inválida do servidor.'), null);
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300 || body.ok === false) {
        callback(new Error(body.message || body.error || ('Falha HTTP ' + xhr.status)), body);
        return;
      }
      callback(null, body);
    };
    xhr.onerror = function () {
      callback(new Error('Falha de rede.'), null);
    };
    xhr.send(payload ? JSON.stringify(payload) : null);
  }

  function requestBlob(method, url, payload, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.responseType = 'blob';
    xhr.setRequestHeader('Accept', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/json');
    if (payload) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      var reader;
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        callback(null, xhr.response, xhr);
        return;
      }
      reader = new FileReader();
      reader.onload = function () {
        var body = null;
        try { body = JSON.parse(reader.result || '{}'); } catch (error) {}
        callback(new Error((body && (body.message || body.error)) || ('Falha HTTP ' + xhr.status)), body);
      };
      reader.readAsText(xhr.response);
    };
    xhr.onerror = function () {
      callback(new Error('Falha de rede.'), null);
    };
    xhr.send(payload ? JSON.stringify(payload) : null);
  }

  function getWidgetWAFData() {
    try {
      if (global.widget && global.widget.WAFData && global.widget.WAFData.authenticatedRequest) {
        return global.widget.WAFData;
      }
    } catch (error) {}
    try {
      if (global.WAFData && global.WAFData.authenticatedRequest) {
        return global.WAFData;
      }
    } catch (error2) {}
    return null;
  }

  function getRequire() {
    if (typeof global.require !== 'undefined') return global.require;
    try {
      if (global.widget && global.widget.requirejs) return global.widget.requirejs;
    } catch (error) {}
    return null;
  }

  function check3DXSession() {
    setStatus(els.sessionStatus, 'Sessão 3DX: verificando...', 'warn');
    var existing = getWidgetWAFData();
    if (existing) {
      setStatus(els.sessionStatus, 'Sessão 3DX: WAFData disponível', 'ok');
      return;
    }

    var req = getRequire();
    if (!req) {
      setStatus(els.sessionStatus, 'Sessão 3DX: WAFData indisponível', 'err');
      setStatus(els.op, 'Runtime 3DEXPERIENCE não expôs require/WAFData. Confirme que está usando Additional App.', 'warning');
      return;
    }

    try {
      req(['DS/WAFData/WAFData'], function (WAFData) {
        if (WAFData) {
          global.WAFData = WAFData;
          setStatus(els.sessionStatus, 'Sessão 3DX: WAFData disponível', 'ok');
        } else {
          setStatus(els.sessionStatus, 'Sessão 3DX: WAFData indisponível', 'err');
        }
      }, function () {
        setStatus(els.sessionStatus, 'Sessão 3DX: falha ao carregar WAFData', 'err');
      });
    } catch (error) {
      setStatus(els.sessionStatus, 'Sessão 3DX: ' + error.message, 'err');
    }
  }

  function buildHtml() {
    return '' +
      '<div class="assessment-app">' +
        '<div class="assessment-topbar">' +
          '<div>' +
            '<p class="assessment-brand-kicker">Assessment Report Builder</p>' +
            '<strong class="assessment-brand-title">Widget oficial</strong>' +
          '</div>' +
          '<div class="assessment-statusbar">' +
            '<span id="session-status" class="assessment-pill warn">Sessão 3DX: verificando...</span>' +
            '<span id="backend-status" class="assessment-pill warn">Backend: verificando...</span>' +
            '<button id="check-health" class="assessment-button secondary" type="button">Verificar</button>' +
          '</div>' +
        '</div>' +
        '<div class="assessment-scroll">' +
          '<section class="assessment-panel assessment-hero">' +
            '<div>' +
              '<span class="assessment-eyebrow">MVP 1 · Assessment JSON Builder · ' + escapeHtml(BUILD) + '</span>' +
              '<h1 class="assessment-title">Transcrição estruturada antes do relatório</h1>' +
              '<p class="assessment-description">A transcrição é o insumo. O <strong>assessment.json</strong> revisado é a fonte da verdade. O DOCX será uma saída gerada somente depois da revisão humana.</p>' +
            '</div>' +
            '<div class="assessment-master-rule"><strong>Premissa mestre</strong><span>O link oficial do widget nunca muda.</span></div>' +
          '</section>' +
          '<section class="assessment-panel">' +
            '<div class="assessment-section-heading"><div><span class="assessment-step">Etapa 1</span><h2>Contexto do assessment</h2></div><span id="saved-status" class="assessment-muted">Carregando estado...</span></div>' +
            '<div class="assessment-grid">' +
              '<label class="assessment-field"><span>Cliente</span><input id="client-name" class="assessment-input" type="text" placeholder="Nome do cliente" /></label>' +
              '<label class="assessment-field"><span>Área principal</span><input id="business-area" class="assessment-input" type="text" placeholder="Ex.: Engenharia de Produto" /></label>' +
              '<label class="assessment-field"><span>Tipo de assessment</span><select id="assessment-type" class="assessment-select"><option value="plm_assessment">PLM Assessment</option><option value="software_assessment">Software Assessment</option><option value="process_assessment">Process Assessment</option><option value="digital_transformation_assessment">Digital Transformation Assessment</option></select></label>' +
              '<label class="assessment-field"><span>Modo de geração</span><select id="generation-mode" class="assessment-select"><option value="conservador">Conservador</option><option value="consultivo">Consultivo</option><option value="executivo">Executivo</option></select></label>' +
            '</div>' +
          '</section>' +
          '<section class="assessment-panel">' +
            '<div class="assessment-section-heading"><div><span class="assessment-step">Etapa 2</span><h2>Importação do assessment</h2></div><span id="transcript-counter" class="assessment-muted">0 caracteres · 0 palavras</span></div>' +
            '<div class="assessment-note">Importe um documento .docx local ou um arquivo baixado manualmente da bookmark. O widget registra a origem e envia ao Render somente o conteúdo do documento importado.</div>' +
            '<p id="source-summary" class="assessment-message">Nenhum documento importado.</p>' +
            '<input id="local-docx-file" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display:none" />' +
            '<input id="bookmark-docx-file" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display:none" />' +
            '<div class="assessment-actions"><button id="import-local-docx" class="assessment-button secondary" type="button">Importar arquivo local</button><button id="import-bookmark-docx" class="assessment-button secondary" type="button">Importar bookmark manual</button><button id="generate-assessment" class="assessment-button primary" type="button">Gerar assessment.json</button><button id="reset-session" class="assessment-button danger" type="button">Limpar sessão</button></div>' +
            '<p id="operation-status" class="assessment-message">Importe um documento .docx para iniciar.</p>' +
          '</section>' +
          '<section class="assessment-panel">' +
            '<div class="assessment-section-heading"><div><span class="assessment-step">Etapa 3</span><h2>Assessment estruturado</h2></div><span class="assessment-pill">Revisável</span></div>' +
            '<div id="assessment-preview" class="assessment-preview"><p class="assessment-empty">Nenhum assessment gerado.</p></div>' +
            '<details class="assessment-technical"><summary>JSON técnico e validação</summary>' +
            '<p class="assessment-muted">Use esta área para revisão técnica, validação de schema e exportação do assessment.json.</p>' +
            '<label class="assessment-field"><span>assessment.json</span><textarea id="assessment-json" class="assessment-textarea assessment-json" placeholder="O JSON gerado aparecerá aqui." spellcheck="false"></textarea></label>' +
            '<div class="assessment-actions"><button id="save-json" class="assessment-button secondary" type="button">Salvar alterações</button><button id="validate-assessment" class="assessment-button secondary" type="button">Validar schema</button><button id="export-json" class="assessment-button secondary" type="button">Exportar JSON</button><button id="export-docx" class="assessment-button primary" type="button">Exportar DOCX</button></div>' +
            '</details>' +
            '<p id="validation-status" class="assessment-message">Nenhum JSON carregado.</p>' +
          '</section>' +
        '</div>' +
      '</div>';
  }

  function cacheElements() {
    els.root = byId('assessment-root');
    els.sessionStatus = byId('session-status');
    els.backendStatus = byId('backend-status');
    els.checkHealth = byId('check-health');
    els.saved = byId('saved-status');
    els.client = byId('client-name');
    els.area = byId('business-area');
    els.type = byId('assessment-type');
    els.mode = byId('generation-mode');
    els.counter = byId('transcript-counter');
    els.sourceSummary = byId('source-summary');
    els.localDocxFile = byId('local-docx-file');
    els.bookmarkDocxFile = byId('bookmark-docx-file');
    els.importLocalDocx = byId('import-local-docx');
    els.importBookmarkDocx = byId('import-bookmark-docx');
    els.preview = byId('assessment-preview');
    els.json = byId('assessment-json');
    els.op = byId('operation-status');
    els.validation = byId('validation-status');
    els.generate = byId('generate-assessment');
    els.reset = byId('reset-session');
    els.saveJson = byId('save-json');
    els.validate = byId('validate-assessment');
    els.exportJson = byId('export-json');
    els.exportDocx = byId('export-docx');
  }

  function collectState() {
    return {
      clientName: trim(els.client.value),
      businessArea: trim(els.area.value),
      assessmentType: els.type.value,
      generationMode: els.mode.value,
      transcriptText: state.transcriptText || '',
      transcriptSource: state.transcriptSource || null,
      transcriptDiagnostics: state.transcriptDiagnostics || null,
      assessment: state.assessment || null,
      validation: state.validation || null
    };
  }

  function updateCounter() {
    var text = state.transcriptText || '';
    els.counter.textContent = text.length + ' caracteres · ' + wordCount(text) + ' palavras';
    els.sourceSummary.textContent = sourceLabel(state.transcriptSource);
  }

  function renderState() {
    els.client.value = state.clientName || '';
    els.area.value = state.businessArea || '';
    els.type.value = state.assessmentType || 'plm_assessment';
    els.mode.value = state.generationMode || 'conservador';
    els.json.value = state.assessment ? JSON.stringify(state.assessment, null, 2) : '';
    renderAssessmentPreview(state.assessment);
    updateCounter();
    els.saved.textContent = state.updatedAt ? 'Estado recuperado: ' + new Date(state.updatedAt).toLocaleString('pt-BR') : 'Nova sessão. O progresso será salvo automaticamente.';
  }

  function persist() {
    saveState(collectState());
    els.saved.textContent = 'Salvo automaticamente: ' + new Date(state.updatedAt).toLocaleTimeString('pt-BR');
  }

  function checkBackend() {
    setStatus(els.backendStatus, 'Backend: verificando...', 'warn');
    request('GET', '/version', null, function (error, body) {
      if (error) {
        setStatus(els.backendStatus, 'Backend: ' + error.message, 'err');
        return;
      }
      setStatus(els.backendStatus, 'Backend: online v' + body.version, 'ok');
    });
  }

  function parseAssessment() {
    if (!trim(els.json.value)) throw new Error('O editor está vazio.');
    return JSON.parse(els.json.value);
  }

  function renderAssessmentPreview(assessment) {
    var summary;
    var html;

    if (!els.preview) return;
    if (!assessment) {
      els.preview.innerHTML = '<p class="assessment-empty">Nenhum assessment gerado.</p>';
      return;
    }

    summary = assessment.executive_summary || {};
    html = '' +
      '<div class="assessment-preview-header">' +
        countLabel('Softwares', (assessment.software_map || []).length) +
        countLabel('Gaps', (assessment.gap_map || []).length) +
        countLabel('Fluxos', (assessment.flows || []).length) +
        countLabel('Recomendações', (assessment.recommendations || []).length) +
        countLabel('Roadmap', (assessment.roadmap || []).length) +
      '</div>' +
      renderQualityReview(assessment.quality_review) +
      renderReportModel(assessment.report_model) +
      '<section class="assessment-preview-section">' +
        '<h3>Resumo executivo</h3>' +
        '<p>' + escapeHtml(summary.current_state || 'Sem resumo estruturado.') + '</p>' +
        '<h4>Principais dores</h4>' +
        listItems(summary.main_pains) +
        '<p class="assessment-evidence"><strong>Evidência:</strong> ' + escapeHtml(summary.evidence || 'Não informada.') + '</p>' +
        '<p class="assessment-evidence"><strong>Confiança:</strong> ' + escapeHtml(summary.confidence || 'Não avaliada') + '</p>' +
      '</section>' +
      '<section class="assessment-preview-section">' +
        '<h3>Mapa de softwares</h3>' +
        table([
          { label: 'Área', key: 'area' },
          { label: 'Software', key: 'software' },
          { label: 'Uso', key: 'usage' },
          { label: 'Dores', value: function (row) { return (row.pain_points || []).join('; '); } },
          { label: 'Confiança', key: 'confidence' }
        ], assessment.software_map || []) +
      '</section>' +
      '<section class="assessment-preview-section">' +
        '<h3>Gaps e recomendações</h3>' +
        table([
          { label: 'Gap', key: 'description' },
          { label: 'Categoria', key: 'category' },
          { label: 'Impacto', key: 'impact' },
          { label: 'Classificação', key: 'classification' },
          { label: 'Recomendação', key: 'recommendation' }
        ], assessment.gap_map || []) +
      '</section>' +
      '<section class="assessment-preview-section">' +
        '<h3>Radar de gaps</h3>' +
        table([
          { label: 'Categoria', key: 'category' },
          { label: 'Score', key: 'score' },
          { label: 'Gaps fonte', value: function (row) { return (row.source_gaps || []).join(', '); } }
        ], assessment.gap_radar || []) +
      '</section>' +
      '<section class="assessment-preview-section">' +
        '<h3>Fluxos</h3>' +
        table([
          { label: 'Tipo', key: 'type' },
          { label: 'Nome', key: 'name' },
          { label: 'Etapas', value: function (row) { return (row.steps || []).length; } },
          { label: 'Problemas', value: function (row) { return (row.issues || []).join('; '); } },
          { label: 'Confiança', key: 'confidence' }
        ], assessment.flows || []) +
      '</section>' +
      '<section class="assessment-preview-section">' +
        '<h3>Recomendações e roadmap</h3>' +
        table([
          { label: 'Prioridade', key: 'priority' },
          { label: 'Título', key: 'title' },
          { label: 'Descrição', key: 'description' },
          { label: 'Esforço', key: 'effort' }
        ], assessment.recommendations || []) +
        '<h4>Roadmap</h4>' +
        table([
          { label: 'Fase', key: 'phase' },
          { label: 'Título', key: 'title' },
          { label: 'Descrição', key: 'description' },
          { label: 'Dependências', value: function (row) { return (row.dependencies || []).join('; '); } }
        ], assessment.roadmap || []) +
      '</section>' +
      '<section class="assessment-preview-section">' +
        '<h3>Perguntas abertas</h3>' +
        table([
          { label: 'Pergunta', key: 'question' },
          { label: 'Tópico', key: 'topic' },
          { label: 'Responsável', key: 'responsible' },
          { label: 'Status', key: 'status' }
        ], assessment.open_questions || []) +
      '</section>';

    els.preview.innerHTML = html;
  }

  function readFileBase64(file, callback) {
    var reader = new FileReader();
    reader.onload = function () {
      var result = String(reader.result || '');
      callback(null, result.split(',').pop());
    };
    reader.onerror = function () {
      callback(new Error('Falha ao ler o arquivo local.'), null);
    };
    reader.readAsDataURL(file);
  }

  function importDocxFile(file, sourceType, originReference) {
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) {
      setStatus(els.op, 'Importe somente arquivo .docx.', 'error');
      return;
    }
    setStatus(els.op, 'Lendo documento .docx...', 'working');
    readFileBase64(file, function (readError, contentBase64) {
      if (readError) {
        setStatus(els.op, readError.message, 'error');
        return;
      }
      request('POST', '/api/assessment/import-docx', {
        filename: file.name,
        content_base64: contentBase64,
        source: {
          type: sourceType,
          origin_reference: originReference || null
        }
      }, function (error, body) {
        var next;
        if (error) {
          setStatus(els.op, 'Falha na importação: ' + error.message, 'error');
          return;
        }
        next = collectState();
        next.transcriptText = body.text;
        next.transcriptSource = body.source;
        next.transcriptDiagnostics = body.diagnostics || null;
        next.assessment = null;
        next.validation = null;
        saveState(next);
        renderState();
        setStatus(els.op, 'Documento importado: ' + body.diagnostics.character_count + ' caracteres · ' + body.diagnostics.word_count + ' palavras.', 'success');
        setStatus(els.validation, 'Novo documento importado. Gere e valide o assessment.', 'warning');
      });
    });
  }

  function chooseBookmarkDocx() {
    var reference = global.prompt('Informe a referência da bookmark ou do documento selecionado no 3DEXPERIENCE:');
    if (reference === null) return;
    state.pendingBookmarkReference = trim(reference);
    els.bookmarkDocxFile.value = '';
    els.bookmarkDocxFile.click();
  }

  function generateAssessment() {
    var s = collectState();
    if (trim(s.transcriptText).length < MIN_TRANSCRIPT_LENGTH) {
      setStatus(els.op, 'Importe um documento .docx com pelo menos ' + MIN_TRANSCRIPT_LENGTH + ' caracteres extraídos.', 'error');
      return;
    }
    setStatus(els.op, 'Gerando assessment.json...', 'working');
    request('POST', '/api/assessment/generate', {
      client: { name: s.clientName || null, business_area: s.businessArea || null },
      transcript_text: s.transcriptText,
      assessment_type: s.assessmentType,
      generation_mode: s.generationMode,
      transcript_source: s.transcriptSource || { type: 'local_upload' },
      template_source: { type: 'not_selected' }
    }, function (error, body) {
      if (error) {
        setStatus(els.op, 'Falha: ' + formatServerError(error, body), 'error');
        return;
      }
      s.assessment = body.assessment;
      s.validation = body.validation || null;
      saveState(s);
      els.json.value = JSON.stringify(body.assessment, null, 2);
      renderAssessmentPreview(body.assessment);
      setStatus(els.op, 'assessment.json gerado. Revise antes de usar em relatório.', 'success');
      setStatus(els.validation, 'Schema válido.', 'success');
    });
  }

  function saveJsonEdits() {
    try {
      var assessment = parseAssessment();
      var next = collectState();
      next.assessment = assessment;
      next.validation = null;
      saveState(next);
      renderAssessmentPreview(assessment);
      setStatus(els.op, 'Alterações salvas localmente.', 'success');
      setStatus(els.validation, 'JSON alterado. Valide novamente.', 'warning');
    } catch (error) {
      setStatus(els.op, 'Não foi possível salvar: ' + error.message, 'error');
    }
  }

  function validateJson() {
    var assessment;
    try {
      assessment = parseAssessment();
    } catch (error) {
      setStatus(els.validation, 'Falha na validação: ' + error.message, 'error');
      return;
    }
    setStatus(els.validation, 'Validando schema...', 'working');
    request('POST', '/api/assessment/validate', { assessment: assessment }, function (error, body) {
      if (error) {
        setStatus(els.validation, 'Falha na validação: ' + error.message, 'error');
        return;
      }
      setStatus(els.validation, body.valid ? 'Schema válido.' : 'Schema inválido · ' + ((body.errors || []).length) + ' erro(s).', body.valid ? 'success' : 'error');
    });
  }

  function exportJson() {
    try {
      var assessment = parseAssessment();
      var data = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(assessment, null, 2));
      var a = document.createElement('a');
      a.href = data;
      a.download = 'assessment.json';
      document.body.appendChild(a);
      a.click();
      a.parentNode.removeChild(a);
      setStatus(els.op, 'assessment.json exportado.', 'success');
    } catch (error) {
      setStatus(els.op, 'Não foi possível exportar: ' + error.message, 'error');
    }
  }

  function exportDocx() {
    var assessment;
    var filename;
    try {
      assessment = parseAssessment();
    } catch (error) {
      setStatus(els.validation, 'Não foi possível exportar DOCX: ' + error.message, 'error');
      return;
    }

    setStatus(els.validation, 'Gerando DOCX editável...', 'working');
    requestBlob('POST', '/api/assessment/export-docx', { assessment: assessment }, function (error, blob, xhr) {
      var disposition;
      var match;
      var a;
      var url;
      if (error) {
        setStatus(els.validation, 'Falha ao gerar DOCX: ' + error.message, 'error');
        return;
      }
      disposition = xhr.getResponseHeader('Content-Disposition') || '';
      match = disposition.match(/filename="([^"]+)"/);
      filename = match ? match[1] : 'assessment.docx';
      url = global.URL.createObjectURL(blob);
      a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.parentNode.removeChild(a);
      global.URL.revokeObjectURL(url);
      setStatus(els.validation, 'DOCX editável exportado.', 'success');
    });
  }

  function resetSession() {
    if (!global.confirm('Limpar a sessão local deste widget?')) return;
    try { global.localStorage.removeItem(STORAGE_KEY); } catch (error) {}
    state = {};
    renderState();
    setStatus(els.op, 'Sessão local limpa.', 'success');
    setStatus(els.validation, 'Nenhum JSON carregado.', '');
  }

  function bindEvents() {
    var ids = ['client-name', 'business-area', 'assessment-type', 'generation-mode'];
    var i;
    for (i = 0; i < ids.length; i += 1) {
      var node = byId(ids[i]);
      if (node) {
        node.oninput = persist;
        node.onchange = persist;
      }
    }
    els.checkHealth.onclick = function () { check3DXSession(); checkBackend(); };
    els.importLocalDocx.onclick = function () {
      els.localDocxFile.value = '';
      els.localDocxFile.click();
    };
    els.importBookmarkDocx.onclick = chooseBookmarkDocx;
    els.localDocxFile.onchange = function () {
      importDocxFile(els.localDocxFile.files && els.localDocxFile.files[0], 'local_upload', null);
    };
    els.bookmarkDocxFile.onchange = function () {
      importDocxFile(els.bookmarkDocxFile.files && els.bookmarkDocxFile.files[0], 'bookmark_manual', state.pendingBookmarkReference || null);
    };
    els.generate.onclick = generateAssessment;
    els.reset.onclick = resetSession;
    els.saveJson.onclick = saveJsonEdits;
    els.validate.onclick = validateJson;
    els.exportJson.onclick = exportJson;
    els.exportDocx.onclick = exportDocx;
  }

  function showFatal(message) {
    var root = ensureRoot();
    root.innerHTML = '<div style="padding:18px;font-family:Arial;color:#b42318"><strong>Assessment Report Builder</strong><br />Falha no runtime: ' + escapeHtml(message) + '</div>';
  }

  function init() {
    try {
      var root = ensureRoot();
      root.innerHTML = buildHtml();
      cacheElements();
      renderState();
      bindEvents();
      check3DXSession();
      checkBackend();
    } catch (error) {
      showFatal(error.message || String(error));
      try {
        if (global.console && global.console.error) global.console.error('[Assessment] runtime failed', error);
      } catch (ignoreError) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this, document);
