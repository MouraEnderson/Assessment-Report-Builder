const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const Ajv2020 = require('ajv/dist/2020');

const app = express();
const port = Number(process.env.PORT || 10000);
const serviceVersion = process.env.SERVICE_VERSION || '0.4.2';
const widgetBuild = 'assessment-0.4.2';

const frontendPath = path.resolve(__dirname, '..', 'frontend');
const schemaPath = path.resolve(__dirname, 'schemas', 'assessment.schema.json');
const assessmentSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateSchema = ajv.compile(assessmentSchema);

const allowedSourceTypes = new Set([
  'manual_text',
  'local_upload',
  'bookmark_manual',
  'official_library',
  'not_selected'
]);

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, frameguard: false }));
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

function applyNoCacheHeaders(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

function sendFrontendFile(filename, contentType) {
  return function (req, res) {
    const absolutePath = path.join(frontendPath, filename);

    if (!fs.existsSync(absolutePath)) {
      return res.status(500).json({
        ok: false,
        error: 'FRONTEND_FILE_MISSING',
        message: `Arquivo não encontrado no container: ${filename}`
      });
    }

    applyNoCacheHeaders(res);
    res.type(contentType);
    return res.sendFile(absolutePath);
  };
}

function healthPayload() {
  return {
    ok: true,
    service: 'assessment-report-builder-backend',
    version: serviceVersion,
    build: widgetBuild,
    entrypoint: 'server.js',
    widget_runtime: '3DDashboard Additional App',
    public_entrypoint: '/',
    widget_entrypoint: 'frontend/widget.html',
    runtime: 'frontend/assets/js/assessment-runtime.js',
    css: 'frontend/assets/css/assessment.css',
    authentication_boundary: '3DEXPERIENCE session stays in frontend WAFData; Render never receives CAS/cookies/tokens',
    environment: process.env.NODE_ENV || 'development',
    schema: 'assessment.schema.json'
  };
}

function normalizeValidationErrors(errors = []) {
  return errors.map((error) => ({
    path: error.instancePath || '/',
    keyword: error.keyword,
    message: error.message || 'Erro de validação.',
    params: error.params
  }));
}

function validateAssessment(assessment) {
  const valid = validateSchema(assessment);
  return {
    valid: Boolean(valid),
    errors: valid ? [] : normalizeValidationErrors(validateSchema.errors),
    warnings: []
  };
}

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeSource(source, fallbackType) {
  const safeSource = source && typeof source === 'object' ? source : {};
  const requestedType = typeof safeSource.type === 'string' ? safeSource.type : fallbackType;
  const type = allowedSourceTypes.has(requestedType) ? requestedType : fallbackType;

  return {
    type,
    filename: normalizeOptionalString(safeSource.filename),
    origin_reference: normalizeOptionalString(safeSource.origin_reference),
    received_at: type === 'not_selected' ? null : new Date().toISOString()
  };
}

function createAssessmentDraft(input) {
  const transcriptText = input.transcript_text.trim();
  const now = new Date().toISOString();
  const client = input.client && typeof input.client === 'object' ? input.client : {};
  const wordCount = transcriptText.split(/\s+/).filter(Boolean).length;

  return {
    metadata: {
      assessment_id: `ASSESS-${Date.now()}`,
      version: '0.1',
      status: 'draft',
      assessment_type: input.assessment_type || 'plm_assessment',
      generation_mode: input.generation_mode || 'consultivo',
      created_at: now,
      updated_at: now
    },
    client: {
      name: normalizeOptionalString(client.name),
      business_area: normalizeOptionalString(client.business_area),
      assessment_scope: null,
      participants: []
    },
    input_sources: {
      transcript: normalizeSource(input.transcript_source, 'manual_text'),
      template: normalizeSource(input.template_source, 'not_selected')
    },
    executive_summary: {
      current_state: null,
      main_pains: [],
      overall_maturity: null,
      evidence: null,
      confidence: 'Não avaliada'
    },
    meeting_summary: {
      raw_length: transcriptText.length,
      word_count: wordCount,
      note: 'Estrutura inicial criada sem conclusões automáticas.',
      raw_excerpt: transcriptText.slice(0, 500)
    },
    software_map: [],
    process_map: [],
    gap_map: [],
    gap_radar: [],
    flows: [],
    risks: [],
    recommendations: [],
    roadmap: [],
    open_questions: [],
    appendix: {
      transcript_processing_status: 'received',
      ai_extraction_status: 'not_implemented'
    },
    review_status: {
      executive_summary: 'Pendente',
      software_map: 'Pendente',
      gap_map: 'Pendente',
      flows: 'Pendente',
      recommendations: 'Pendente'
    }
  };
}

app.get('/', sendFrontendFile('widget.html', 'html'));
app.get('/index.html', sendFrontendFile('widget.html', 'html'));
app.get('/widget.html', sendFrontendFile('widget.html', 'html'));
app.get('/assets/css/assessment.css', sendFrontendFile(path.join('assets', 'css', 'assessment.css'), 'css'));
app.get('/assets/js/assessment-runtime.js', sendFrontendFile(path.join('assets', 'js', 'assessment-runtime.js'), 'application/javascript'));

app.get('/health', (req, res) => {
  res.status(200).json(healthPayload());
});

app.get('/api/health', (req, res) => {
  res.status(200).json(healthPayload());
});

app.get('/version', (req, res) => {
  res.status(200).json(healthPayload());
});

app.get('/api/assessment/schema', (req, res) => {
  res.status(200).json({ ok: true, schema: assessmentSchema });
});

app.post('/api/assessment/generate', (req, res) => {
  const input = req.body || {};
  const transcriptText = input.transcript_text;

  if (!transcriptText || typeof transcriptText !== 'string' || transcriptText.trim().length < 20) {
    return res.status(400).json({
      ok: false,
      error: 'TRANSCRIPT_TEXT_REQUIRED',
      message: 'Informe uma transcrição válida com pelo menos 20 caracteres.'
    });
  }

  const allowedModes = ['conservador', 'consultivo', 'executivo'];
  if (input.generation_mode && !allowedModes.includes(input.generation_mode)) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_GENERATION_MODE',
      message: `Modo de geração inválido: ${input.generation_mode}`
    });
  }

  const assessment = createAssessmentDraft(input);
  const validation = validateAssessment(assessment);

  if (!validation.valid) {
    return res.status(500).json({
      ok: false,
      error: 'GENERATED_ASSESSMENT_INVALID',
      message: 'O backend gerou um assessment incompatível com o schema oficial.',
      validation
    });
  }

  return res.status(200).json({ ok: true, assessment, validation });
});

app.post('/api/assessment/validate', (req, res) => {
  const assessment = req.body?.assessment;

  if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) {
    return res.status(400).json({
      ok: false,
      error: 'ASSESSMENT_REQUIRED',
      message: 'Envie um objeto assessment para validação.'
    });
  }

  const validation = validateAssessment(assessment);
  return res.status(200).json({ ok: true, ...validation });
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'NOT_FOUND',
    message: `Rota não encontrada: ${req.method} ${req.path}`
  });
});

app.use((error, req, res, next) => {
  console.error('[assessment-report-builder]', error);
  res.status(500).json({
    ok: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: error.message || 'Erro interno no backend.'
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Assessment Report Builder v${serviceVersion} running on port ${port} using server.js`);
});
