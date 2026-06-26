window.ASSESSMENT_CONFIG = Object.freeze({
  apiBaseUrl: window.localStorage.getItem('assessment.apiBaseUrl') || '',
  storageKey: 'assessment-report-builder.state.v1',
  minimumTranscriptLength: 20,
  officialWidgetPath: '/'
});
