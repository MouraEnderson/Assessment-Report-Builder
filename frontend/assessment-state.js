(function assessmentStateModule(global) {
  const config = global.ASSESSMENT_CONFIG;

  const initialState = Object.freeze({
    clientName: '',
    businessArea: '',
    assessmentType: 'plm_assessment',
    generationMode: 'consultivo',
    transcriptText: '',
    transcriptSourceType: 'manual_text',
    transcriptFilename: null,
    transcriptOriginReference: null,
    templateSourceType: 'not_selected',
    templateFilename: null,
    templateOriginReference: null,
    assessment: null,
    validation: null,
    lastStep: 'input',
    updatedAt: null
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function load() {
    try {
      const raw = global.localStorage.getItem(config.storageKey);
      if (!raw) {
        return clone(initialState);
      }

      const parsed = JSON.parse(raw);
      return {
        ...clone(initialState),
        ...parsed
      };
    } catch (error) {
      console.error('[assessment-state] Falha ao recuperar estado:', error);
      return clone(initialState);
    }
  }

  function save(nextState) {
    const stateToSave = {
      ...nextState,
      updatedAt: new Date().toISOString()
    };

    global.localStorage.setItem(config.storageKey, JSON.stringify(stateToSave));
    return stateToSave;
  }

  function reset() {
    global.localStorage.removeItem(config.storageKey);
    return clone(initialState);
  }

  global.AssessmentState = Object.freeze({
    load,
    save,
    reset,
    initial: () => clone(initialState)
  });
})(window);
