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
            '<div class="assessment-section-heading"><div><span class="assessment-step">Etapa 2</span><h2>Transcrição</h2></div><span id="transcript-counter" class="assessment-muted">0 caracteres · 0 palavras</span></div>' +
            '<div class="assessment-note">Neste MVP, cole o texto da transcrição. Bookmark/documentos serão lidos pelo widget usando a sessão logada do 3DEXPERIENCE, sem CAS e sem enviar credenciais ao Render.</div>' +
            '<label class="assessment-field"><span>Texto da transcrição</span><textarea id="transcript-text" class="assessment-textarea" placeholder="Cole aqui a transcrição da reunião de assessment..."></textarea></label>' +
            '<div class="assessment-actions"><button id="generate-assessment" class="assessment-button primary" type="button">Gerar assessment.json</button><button id="reset-session" class="assessment-button danger" type="button">Limpar sessão</button></div>' +
            '<p id="operation-status" class="assessment-message">Preencha o contexto e cole uma transcrição para iniciar.</p>' +
          '</section>' +
          '<section class="assessment-panel">' +
            '<div class="assessment-section-heading"><div><span class="assessment-step">Etapa 3</span><h2>Revisão do assessment.json</h2></div><span class="assessment-pill">Editável</span></div>' +
            '<p class="assessment-muted">O conteúdo abaixo pode ser alterado manualmente. Depois de editar, salve e valide contra o schema oficial.</p>' +
            '<label class="assessment-field"><span>assessment.json</span><textarea id="assessment-json" class="assessment-textarea assessment-json" placeholder="O JSON gerado aparecerá aqui." spellcheck="false"></textarea></label>' +
            '<div class="assessment-actions"><button id="save-json" class="assessment-button secondary" type="button">Salvar alterações</button><button id="validate-assessment" class="assessment-button secondary" type="button">Validar schema</button><button id="export-json" class="assessment-button primary" type="button">Exportar JSON</button></div>' +
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
    els.transcript = byId('transcript-text');
    els.counter = byId('transcript-counter');
    els.json = byId('assessment-json');
    els.op = byId('operation-status');
    els.validation = byId('validation-status');
    els.generate = byId('generate-assessment');
    els.reset = byId('reset-session');
    els.saveJson = byId('save-json');
    els.validate = byId('validate-assessment');
    els.exportJson = byId('export-json');
  }

  function collectState() {
    return {
      clientName: trim(els.client.value),
      businessArea: trim(els.area.value),
      assessmentType: els.type.value,
      generationMode: els.mode.value,
      transcriptText: els.transcript.value,
      assessment: state.assessment || null,
      validation: state.validation || null
    };
  }

  function updateCounter() {
    var text = els.transcript.value || '';
    els.counter.textContent = text.length + ' caracteres · ' + wordCount(text) + ' palavras';
  }

  function renderState() {
    els.client.value = state.clientName || '';
    els.area.value = state.businessArea || '';
    els.type.value = state.assessmentType || 'plm_assessment';
    els.mode.value = state.generationMode || 'conservador';
    els.transcript.value = state.transcriptText || '';
    els.json.value = state.assessment ? JSON.stringify(state.assessment, null, 2) : '';
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

  function generateAssessment() {
    var s = collectState();
    if (trim(s.transcriptText).length < MIN_TRANSCRIPT_LENGTH) {
      setStatus(els.op, 'A transcrição precisa ter pelo menos ' + MIN_TRANSCRIPT_LENGTH + ' caracteres.', 'error');
      return;
    }
    setStatus(els.op, 'Gerando assessment.json...', 'working');
    request('POST', '/api/assessment/generate', {
      client: { name: s.clientName || null, business_area: s.businessArea || null },
      transcript_text: s.transcriptText,
      assessment_type: s.assessmentType,
      generation_mode: s.generationMode,
      transcript_source: { type: 'manual_text' },
      template_source: { type: 'not_selected' }
    }, function (error, body) {
      if (error) {
        setStatus(els.op, 'Falha: ' + error.message, 'error');
        return;
      }
      s.assessment = body.assessment;
      s.validation = body.validation || null;
      saveState(s);
      els.json.value = JSON.stringify(body.assessment, null, 2);
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

  function resetSession() {
    if (!global.confirm('Limpar a sessão local deste widget?')) return;
    try { global.localStorage.removeItem(STORAGE_KEY); } catch (error) {}
    state = {};
    renderState();
    setStatus(els.op, 'Sessão local limpa.', 'success');
    setStatus(els.validation, 'Nenhum JSON carregado.', '');
  }

  function bindEvents() {
    var ids = ['client-name', 'business-area', 'assessment-type', 'generation-mode', 'transcript-text'];
    var i;
    for (i = 0; i < ids.length; i += 1) {
      var node = byId(ids[i]);
      if (node) {
        node.oninput = function () { updateCounter(); persist(); };
        node.onchange = persist;
      }
    }
    els.checkHealth.onclick = function () { check3DXSession(); checkBackend(); };
    els.generate.onclick = generateAssessment;
    els.reset.onclick = resetSession;
    els.saveJson.onclick = saveJsonEdits;
    els.validate.onclick = validateJson;
    els.exportJson.onclick = exportJson;
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
