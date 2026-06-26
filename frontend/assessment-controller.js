(function assessmentControllerModule(global) {
  const api = global.AssessmentApiClient;
  const stateStore = global.AssessmentState;
  const config = global.ASSESSMENT_CONFIG;

  let state = stateStore.load();
  let saveTimer = null;

  const elements = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    Object.assign(elements, {
      backendStatus: byId('backend-status'),
      checkHealthButton: byId('check-health'),
      clientName: byId('client-name'),
      businessArea: byId('business-area'),
      assessmentType: byId('assessment-type'),
      generationMode: byId('generation-mode'),
      transcriptText: byId('transcript-text'),
      transcriptCounter: byId('transcript-counter'),
      generateButton: byId('generate-assessment'),
      saveJsonButton: byId('save-json'),
      validateButton: byId('validate-assessment'),
      exportButton: byId('export-json'),
      resetButton: byId('reset-session'),
      assessmentJson: byId('assessment-json'),
      operationStatus: byId('operation-status'),
      validationStatus: byId('validation-status'),
      savedStatus: byId('saved-status')
    });
  }

  function setOperationStatus(message, type = 'info') {
    elements.operationStatus.textContent = message;
    elements.operationStatus.dataset.type = type;
  }

  function setValidationStatus(message, type = 'neutral') {
    elements.validationStatus.textContent = message;
    elements.validationStatus.dataset.type = type;
  }

  function setSavedStatus(message) {
    elements.savedStatus.textContent = message;
  }

  function countWords(text) {
    const normalized = text.trim();
    return normalized ? normalized.split(/\s+/).length : 0;
  }

  function updateTranscriptCounter() {
    const text = elements.transcriptText.value;
    elements.transcriptCounter.textContent = `${text.length} caracteres · ${countWords(text)} palavras`;
  }

  function renderState() {
    elements.clientName.value = state.clientName || '';
    elements.businessArea.value = state.businessArea || '';
    elements.assessmentType.value = state.assessmentType || 'plm_assessment';
    elements.generationMode.value = state.generationMode || 'consultivo';
    elements.transcriptText.value = state.transcriptText || '';
    elements.assessmentJson.value = state.assessment
      ? JSON.stringify(state.assessment, null, 2)
      : '';

    updateTranscriptCounter();

    if (state.updatedAt) {
      setSavedStatus(`Estado recuperado: ${new Date(state.updatedAt).toLocaleString('pt-BR')}`);
    } else {
      setSavedStatus('Nova sessão. O progresso será salvo automaticamente neste navegador.');
    }

    if (state.validation) {
      renderValidation(state.validation);
    }
  }

  function collectFormState() {
    return {
      ...state,
      clientName: elements.clientName.value.trim(),
      businessArea: elements.businessArea.value.trim(),
      assessmentType: elements.assessmentType.value,
      generationMode: elements.generationMode.value,
      transcriptText: elements.transcriptText.value,
      transcriptSourceType: 'manual_text'
    };
  }

  function persistFormState() {
    state = stateStore.save(collectFormState());
    setSavedStatus(`Salvo automaticamente: ${new Date(state.updatedAt).toLocaleTimeString('pt-BR')}`);
  }

  function scheduleSave() {
    global.clearTimeout(saveTimer);
    saveTimer = global.setTimeout(persistFormState, 350);
  }

  async function checkHealth() {
    elements.backendStatus.textContent = 'Verificando backend...';
    elements.backendStatus.dataset.type = 'checking';

    try {
      const response = await api.health();
      elements.backendStatus.textContent = `Online · ${response.service} · v${response.version}`;
      elements.backendStatus.dataset.type = 'online';
    } catch (error) {
      elements.backendStatus.textContent = `Offline · ${error.message}`;
      elements.backendStatus.dataset.type = 'offline';
    }
  }

  function buildGeneratePayload() {
    const formState = collectFormState();
    const transcriptText = formState.transcriptText.trim();

    if (transcriptText.length < config.minimumTranscriptLength) {
      throw new Error(`A transcrição precisa ter pelo menos ${config.minimumTranscriptLength} caracteres.`);
    }

    return {
      client: {
        name: formState.clientName || null,
        business_area: formState.businessArea || null
      },
      transcript_text: transcriptText,
      transcript_source: {
        type: formState.transcriptSourceType || 'manual_text',
        filename: formState.transcriptFilename || null,
        origin_reference: formState.transcriptOriginReference || null
      },
      template_source: {
        type: formState.templateSourceType || 'not_selected',
        filename: formState.templateFilename || null,
        origin_reference: formState.templateOriginReference || null
      },
      assessment_type: formState.assessmentType,
      generation_mode: formState.generationMode
    };
  }

  async function generateAssessment() {
    elements.generateButton.disabled = true;
    setOperationStatus('Gerando estrutura oficial do assessment...', 'working');
    setValidationStatus('Aguardando geração.', 'neutral');

    try {
      const payload = buildGeneratePayload();
      const response = await api.generateAssessment(payload);

      state = stateStore.save({
        ...collectFormState(),
        assessment: response.assessment,
        validation: response.validation || null,
        lastStep: 'review'
      });

      elements.assessmentJson.value = JSON.stringify(response.assessment, null, 2);
      setOperationStatus('assessment.json gerado. Revise e edite antes de aprovar qualquer conteúdo.', 'success');

      if (response.validation) {
        renderValidation(response.validation);
      } else {
        setValidationStatus('JSON gerado; execute a validação para confirmar o contrato.', 'neutral');
      }
    } catch (error) {
      setOperationStatus(`Falha na geração: ${error.message}`, 'error');
    } finally {
      elements.generateButton.disabled = false;
    }
  }

  function parseAssessmentEditor() {
    const raw = elements.assessmentJson.value.trim();
    if (!raw) {
      throw new Error('O editor de assessment.json está vazio.');
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`JSON inválido: ${error.message}`);
    }
  }

  function saveJsonEdits() {
    try {
      const assessment = parseAssessmentEditor();
      state = stateStore.save({
        ...collectFormState(),
        assessment,
        validation: null,
        lastStep: 'review'
      });
      setOperationStatus('Alterações do assessment.json salvas localmente.', 'success');
      setValidationStatus('O JSON foi alterado e precisa ser validado novamente.', 'warning');
    } catch (error) {
      setOperationStatus(`Não foi possível salvar: ${error.message}`, 'error');
    }
  }

  function renderValidation(validation) {
    if (validation.valid) {
      setValidationStatus('Schema válido. O JSON atende ao contrato oficial.', 'valid');
      return;
    }

    const errors = validation.errors || [];
    const summary = errors
      .slice(0, 5)
      .map((item) => `${item.path || '/'}: ${item.message}`)
      .join(' | ');

    setValidationStatus(
      `Schema inválido · ${errors.length} erro(s)${summary ? ` · ${summary}` : ''}`,
      'invalid'
    );
  }

  async function validateAssessment() {
    elements.validateButton.disabled = true;
    setValidationStatus('Validando contra o schema oficial...', 'checking');

    try {
      const assessment = parseAssessmentEditor();
      const response = await api.validateAssessment(assessment);
      const validation = {
        valid: response.valid,
        errors: response.errors || [],
        warnings: response.warnings || []
      };

      state = stateStore.save({
        ...collectFormState(),
        assessment,
        validation,
        lastStep: 'review'
      });

      renderValidation(validation);
    } catch (error) {
      setValidationStatus(`Falha na validação: ${error.message}`, 'invalid');
    } finally {
      elements.validateButton.disabled = false;
    }
  }

  function exportAssessment() {
    try {
      const assessment = parseAssessmentEditor();
      const clientPart = (assessment.client?.name || 'cliente')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
      const versionPart = String(assessment.metadata?.version || '0-1').replace(/\./g, '-');
      const filename = `assessment-${clientPart || 'cliente'}-v${versionPart}.json`;
      const blob = new Blob([JSON.stringify(assessment, null, 2)], {
        type: 'application/json;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setOperationStatus(`Arquivo exportado: ${filename}`, 'success');
    } catch (error) {
      setOperationStatus(`Não foi possível exportar: ${error.message}`, 'error');
    }
  }

  function resetSession() {
    const confirmed = global.confirm(
      'Apagar a transcrição, o JSON e todo o estado salvo desta sessão neste navegador?'
    );

    if (!confirmed) {
      return;
    }

    state = stateStore.reset();
    renderState();
    setOperationStatus('Sessão local limpa. Nenhum dado foi enviado ou excluído no backend.', 'info');
    setValidationStatus('Nenhum JSON carregado.', 'neutral');
  }

  function bindEvents() {
    [
      elements.clientName,
      elements.businessArea,
      elements.assessmentType,
      elements.generationMode,
      elements.transcriptText
    ].forEach((element) => {
      element.addEventListener('input', () => {
        updateTranscriptCounter();
        scheduleSave();
      });
      element.addEventListener('change', scheduleSave);
    });

    elements.assessmentJson.addEventListener('input', () => {
      setValidationStatus('Conteúdo alterado. Salve e valide novamente.', 'warning');
    });

    elements.checkHealthButton.addEventListener('click', checkHealth);
    elements.generateButton.addEventListener('click', generateAssessment);
    elements.saveJsonButton.addEventListener('click', saveJsonEdits);
    elements.validateButton.addEventListener('click', validateAssessment);
    elements.exportButton.addEventListener('click', exportAssessment);
    elements.resetButton.addEventListener('click', resetSession);
  }

  function init() {
    cacheElements();
    renderState();
    bindEvents();
    checkHealth();
  }

  global.AssessmentController = Object.freeze({ init });
})(window);
