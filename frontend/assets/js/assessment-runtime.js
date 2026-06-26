/* Assessment Report Builder — 3DEXPERIENCE Additional App runtime */
(function (global) {
  'use strict';

  var BUILD = 'assessment-0.4.0';
  var STORAGE_KEY = 'assessment-report-builder.state.v1';
  var MIN_TRANSCRIPT_LENGTH = 20;

  var state = loadState();
  var els = {};

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
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    state = next;
    return state;
  }

  function wordCount(text) {
    var normalized = String(text || '').trim();
    return normalized ? normalized.split(/\s+/).length : 0;
  }

  function getRequire() {
    if (typeof global.require !== 'undefined') return global.require;
    try {
      if (global.widget && global.widget.requirejs) return global.widget.requirejs;
    } catch (eWidget) { /* noop */ }
    try {
      if (global.parent && global.parent !== global && global.parent.require) return global.parent.require;
    } catch (eParent) { /* cross-origin expected */ }
    try {
      if (global.top && global.top !== global && global.top.require) return global.top.require;
    } catch (eTop) { /* cross-origin expected */ }
    return null;
  }

  function getWidgetWAFData() {
    try {
      if (global.widget && global.widget.WAFData && global.widget.WAFData.authenticatedRequest) {
        return global.widget.WAFData;
      }
    } catch (error) { /* noop */ }
    if (typeof global.WAFData !== 'undefined' && global.WAFData && global.WAFData.authenticatedRequest) {
      return global.WAFData;
    }
    return null;
  }

  function ensure3DXSession() {
    return new Promise(function (resolve) {
      var existing = getWidgetWAFData();
      if (existing) {
        resolve({ ok: true, mode: 'widget.WAFData', WAFData: existing });
        return;
      }

      var req = getRequire();
      if (!req) {
        resolve({
          ok: false,
          mode: 'not_available',
          message: 'Runtime 3DEXPERIENCE não expôs require/WAFData. Use Additional App, não Web Page Reader.'
        });
        return;
      }

      req([
        'DS/WAFData/WAFData',
        'DS/i3DXCompassServices/i3DXCompassServices',
        'DS/PlatformAPI/PlatformAPI'
      ], function (WAFData, CompassServices, PlatformAPI) {
        if (WAFData) global.WAFData = WAFData;
        if (CompassServices) global.__3DX_COMPASS__ = CompassServices;
        if (PlatformAPI) global.__3DX_PLATFORM_API__ = PlatformAPI;
        resolve({ ok: !!WAFData, mode: 'require', WAFData: WAFData });
      }, function (error) {
        resolve({
          ok: false,
          mode: 'require_failed',
          message: error && error.message ? error.message : 'Falha ao carregar módulos DS.'
        });
      });
    });
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
          '<section class="assessment-panel"><h2>Regras operacionais ativas</h2><div class="assessment-principles"><article class="assessment-principle"><strong>Sem CAS</strong><p>A sessão logada fica no widget 3DEXPERIENCE.</p></article><article class="assessment-principle"><strong>Render sem credencial</strong><p>O backend recebe dados, nunca cookies ou tokens 3DX.</p></article><article class="assessment-principle"><strong>JSON como verdade</strong><p>O relatório final nasce do assessment aprovado.</p></article><article class="assessment-principle"><strong>Sem fallback silencioso</strong><p>Erro, ausência e incerteza ficam visíveis.</p></article></div></section>' +
        '</div>' +
      '</div>';
  }

  function cacheElements() {
    els = {
      root: document.getElementById('assessment-root'),
      sessionStatus: byId('session-status'),
      backendStatus: byId('backend-status'),
      checkHealth: byId('check-health'),
      saved: byId('saved-status'),
      client: byId('client-name'),
      area: byId('business-area'),
      type: byId('assessment-type'),
      mode: byId('generation-mode'),
      transcript: byId('transcript-text'),
      counter: byId('transcript-counter'),
      json: byId('assessment-json'),
      op: byId('operation-status'),
      validation: byId('validation-status'),
      generate: byId('generate-assessment'),
      reset: byId('reset-session'),
      saveJson: byId('save-json'),
      validate: byId('validate-assessment'),
      exportJson: byId('export-json')
    };
  }

  function collectState() {
    return {
      clientName: els.client.value.replace(/^\s+|\s+$/g, ''),
      businessArea: els.area.value.replace(/^\s+|\s+$/g, ''),
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
    els.saved.textContent = state.updatedAt
      ? 'Estado recuperado: ' + new Date(state.updatedAt).toLocaleString('pt-BR')
      : 'Nova sessão. O progresso será salvo automaticamente.';
  }

  function persist() {
    saveState(collectState());
    els.saved.textContent = 'Salvo automaticamente: ' + new Date(state.updatedAt).toLocaleTimeString('pt-BR');
  }

  function request(url, payload) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok || body.ok === false) {
          throw new Error(body.message || body.error || 'Falha HTTP ' + response.status);
        }
        return body;
      });
    });
  }

  function checkBackend() {
    setStatus(els.backendStatus, 'Backend: verificando...', 'warn');
    return fetch('/version', { cache: 'no-store' })
      .then(function (response) { return response.json(); })
      .then(function (body) {
        if (!body.ok) throw new Error(body.message || 'Backend respondeu sem ok');
        setStatus(els.backendStatus, 'Backend: online v' + body.version, 'ok');
      })
      .catch(function (error) {
        setStatus(els.backendStatus, 'Backend: ' + error.message, 'err');
      });
  }

  function check3DXSession() {
    setStatus(els.sessionStatus, 'Sessão 3DX: verificando...', 'warn');
    return ensure3DXSession().then(function (session) {
      if (session.ok) {
        setStatus(els.sessionStatus, 'Sessão 3DX: WAFData disponível', 'ok');
      } else {
        setStatus(els.sessionStatus, 'Sessão 3DX: indisponível', 'err');
        setStatus(els.op, session.message || 'Use Additional App no 3DDashboard para acesso autenticado.', 'warning');
      }
    });
  }

  function generateAssessment() {
    var s = collectState();
    if (s.transcriptText.replace(/^\s+|\s+$/g, '').length < MIN_TRANSCRIPT_LENGTH) {
      setStatus(els.op, 'A transcrição precisa ter pelo menos ' + MIN_TRANSCRIPT_LENGTH + ' caracteres.', 'error');
      return;
    }

    setStatus(els.op, 'Gerando assessment.json...', 'working');

    request('/api/assessment/generate', {
      client: {
        name: s.clientName || null,
        business_area: s.businessArea || null
      },
      transcript_text: s.transcriptText,
      assessment_type: s.assessmentType,
      generation_mode: s.generationMode,
      transcript_source: { type: 'manual_text' },
      template_source: { type: 'not_selected' }
    }).then(function (body) {
      saveState(Object.assign(s, { assessment: body.assessment, validation: body.validation || null }));
      els.json.value = JSON.stringify(body.assessment, null, 2);
      setStatus(els.op, 'assessment.json gerado. Revise antes de usar em relatório.', 'success');
      if (body.validation && body.validation.valid) setStatus(els.validation, 'Schema válido.', 'success');
    }).catch(function (error) {
      setStatus(els.op, 'Falha: ' + error.message, 'error');
    });
  }

  function parseAssessment() {
    if (!els.json.value.replace(/^\s+|\s+$/g, '')) throw new Error('O editor está vazio.');
    return JSON.parse(els.json.value);
  }

  function saveJsonEdits() {
    try {
      var assessment = parseAssessment();
      saveState(Object.assign(collectState(), { assessment: assessment, validation: null }));
      setStatus(els.op, 'Alterações salvas localmente.', 'success');
      setStatus(els.validation, 'JSON alterado. Valide novamente.', 'warning');
    } catch (error) {
      setStatus(els.op, 'Não foi possível salvar: ' + error.message, 'error');
    }
  }

  function validateAssessment() {
    var assessment;
    try {
      assessment = parseAssessment();
    } catch (error) {
      setStatus(els.validation, 'Falha na validação: ' + error.message, 'error');
      return;
    }

    setStatus(els.validation, 'Validando schema...', 'working');
    request('/api/assessment/validate', { assessment: assessment })
      .then(function (body) {
        saveState(Object.assign(collectState(), { assessment: assessment, validation: body }));
        setStatus(
          els.validation,
          body.valid ? 'Schema válido.' : 'Schema inválido · ' + ((body.errors || []).length) + ' erro(s).',
          body.valid ? 'success' : 'error'
        );
      })
      .catch(function (error) {
        setStatus(els.validation, 'Falha na validação: ' + error.message, 'error');
      });
  }

  function exportJson() {
    try {
      var assessment = parseAssessment();
      var blob = new Blob([JSON.stringify(assessment, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'assessment.json';
      document.body.appendChild(a);
      a.click();
      a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus(els.op, 'assessment.json exportado.', 'success');
    } catch (error) {
      setStatus(els.op, 'Não foi possível exportar: ' + error.message, 'error');
    }
  }

  function resetSession() {
    if (!global.confirm('Limpar a sessão local deste widget?')) return;
    global.localStorage.removeItem(STORAGE_KEY);
    state = {};
    renderState();
    setStatus(els.op, 'Sessão local limpa.', 'success');
    setStatus(els.validation, 'Nenhum JSON carregado.', '');
  }

  function bindEvents() {
    var autoSaveIds = ['client-name', 'business-area', 'assessment-type', 'generation-mode', 'transcript-text'];
    autoSaveIds.forEach(function (id) {
      var node = byId(id);
      node.addEventListener('input', function () { updateCounter(); persist(); });
      node.addEventListener('change', persist);
    });

    els.checkHealth.addEventListener('click', function () {
      check3DXSession();
      checkBackend();
    });
    els.generate.addEventListener('click', generateAssessment);
    els.reset.addEventListener('click', resetSession);
    els.saveJson.addEventListener('click', saveJsonEdits);
    els.validate.addEventListener('click', validateAssessment);
    els.exportJson.addEventListener('click', exportJson);
  }

  function init() {
    var root = document.getElementById('assessment-root');
    if (!root) return;
    root.innerHTML = buildHtml();
    cacheElements();
    renderState();
    bindEvents();
    check3DXSession();
    checkBackend();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
