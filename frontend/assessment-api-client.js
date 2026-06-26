(function assessmentApiClientModule(global) {
  const config = global.ASSESSMENT_CONFIG;

  function buildUrl(path) {
    const base = (config.apiBaseUrl || '').replace(/\/$/, '');
    return `${base}${path}`;
  }

  async function request(path, options = {}) {
    const response = await fetch(buildUrl(path), {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error(`Resposta inválida do backend (${response.status}).`);
    }

    if (!response.ok || payload.ok === false) {
      const message = payload.message || payload.error || `Falha HTTP ${response.status}`;
      const requestError = new Error(message);
      requestError.code = payload.error || 'REQUEST_FAILED';
      requestError.details = payload;
      throw requestError;
    }

    return payload;
  }

  function health() {
    return request('/health', { method: 'GET', headers: {} });
  }

  function generateAssessment(input) {
    return request('/api/assessment/generate', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }

  function validateAssessment(assessment) {
    return request('/api/assessment/validate', {
      method: 'POST',
      body: JSON.stringify({ assessment })
    });
  }

  global.AssessmentApiClient = Object.freeze({
    health,
    generateAssessment,
    validateAssessment
  });
})(window);
