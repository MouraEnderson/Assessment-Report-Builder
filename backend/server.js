const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const Ajv2020 = require('ajv/dist/2020');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = Number(process.env.PORT || 10000);
const serviceVersion = process.env.SERVICE_VERSION || '0.4.3';
const widgetBuild = `assessment-${serviceVersion}`;
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const configuredGeminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const geminiModel = configuredGeminiModel === 'gemini-1.5-flash' ? 'gemini-2.5-flash' : configuredGeminiModel;
const maxAiInputCharacters = Number(process.env.AI_MAX_INPUT_CHARS || 60000);

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
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

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

function geminiEnabled() {
  return Boolean(geminiApiKey.trim());
}

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function normalizeExtractedText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');

  if (first < 0 || last < first) {
    throw new Error('A IA não retornou um objeto JSON.');
  }

  return JSON.parse(candidate.slice(first, last + 1));
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
  const wordCount = countWords(transcriptText);

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

function buildAssessmentPrompt(input) {
  const client = input.client && typeof input.client === 'object' ? input.client : {};
  const transcriptText = normalizeExtractedText(input.transcript_text).slice(0, maxAiInputCharacters);

  return [
    'Você é um consultor sênior de PLM, engenharia de produto, processos, sistemas e 3DEXPERIENCE.',
    'Sua tarefa é transformar o conteúdo de um assessment em um assessment.json estritamente válido.',
    '',
    'Regras obrigatórias:',
    '- Responda somente com JSON válido, sem markdown e sem explicações fora do JSON.',
    '- Use exatamente o contrato descrito abaixo; não adicione propriedades fora do schema.',
    '- Não invente fatos. Quando inferir algo, registre como hipótese ou confiança menor.',
    '- Toda recomendação deve estar ligada a evidência, gap ou risco quando possível.',
    '- Se faltar informação, use null, arrays vazios ou open_questions.',
    '- Todos os textos devem ficar em português do Brasil.',
    '- O campo review_status deve iniciar como Pendente.',
    '',
    'Enums importantes:',
    '- confidence: Baixa, Média, Alta, Não avaliada.',
    '- reviewState: Pendente, Revisado, Aprovado, Rejeitado, Regenerar.',
    '- gap classification: Fato, Hipótese, Pendência.',
    '- flow type: AS-IS ou TO-BE.',
    '',
    'Cliente informado:',
    JSON.stringify({
      name: normalizeOptionalString(client.name),
      business_area: normalizeOptionalString(client.business_area),
      assessment_type: input.assessment_type || 'plm_assessment',
      generation_mode: input.generation_mode || 'consultivo',
      transcript_source: input.transcript_source || { type: 'local_upload' },
      template_source: input.template_source || { type: 'not_selected' }
    }, null, 2),
    '',
    'Schema JSON oficial:',
    JSON.stringify(assessmentSchema),
    '',
    'Conteúdo importado do assessment:',
    transcriptText
  ].join('\n');
}

async function createAssessmentWithGemini(input) {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: geminiModel,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  });
  const result = await model.generateContent(buildAssessmentPrompt(input));
  const response = result.response;
  const jsonText = response.text();
  const assessment = extractJsonObject(jsonText);
  const now = new Date().toISOString();

  assessment.metadata = assessment.metadata && typeof assessment.metadata === 'object' ? assessment.metadata : {};
  assessment.metadata.assessment_id = assessment.metadata.assessment_id || `ASSESS-${Date.now()}`;
  assessment.metadata.version = assessment.metadata.version || '0.1';
  assessment.metadata.status = 'draft';
  assessment.metadata.assessment_type = input.assessment_type || assessment.metadata.assessment_type || 'plm_assessment';
  assessment.metadata.generation_mode = input.generation_mode || assessment.metadata.generation_mode || 'consultivo';
  assessment.metadata.created_at = assessment.metadata.created_at || now;
  assessment.metadata.updated_at = now;

  assessment.client = assessment.client && typeof assessment.client === 'object' ? assessment.client : {};
  const client = input.client && typeof input.client === 'object' ? input.client : {};
  assessment.client.name = assessment.client.name || normalizeOptionalString(client.name);
  assessment.client.business_area = assessment.client.business_area || normalizeOptionalString(client.business_area);
  assessment.client.assessment_scope = Object.prototype.hasOwnProperty.call(assessment.client, 'assessment_scope') ? assessment.client.assessment_scope : null;
  assessment.client.participants = Array.isArray(assessment.client.participants) ? assessment.client.participants : [];

  assessment.input_sources = {
    transcript: normalizeSource(input.transcript_source, 'local_upload'),
    template: normalizeSource(input.template_source, 'not_selected')
  };

  assessment.meeting_summary = assessment.meeting_summary && typeof assessment.meeting_summary === 'object' ? assessment.meeting_summary : {};
  assessment.meeting_summary.raw_length = input.transcript_text.trim().length;
  assessment.meeting_summary.word_count = countWords(input.transcript_text);
  assessment.meeting_summary.note = assessment.meeting_summary.note || 'Assessment estruturado por IA a partir de documento importado, pendente de revisão humana.';
  assessment.meeting_summary.raw_excerpt = assessment.meeting_summary.raw_excerpt || input.transcript_text.trim().slice(0, 500);

  assessment.appendix = assessment.appendix && typeof assessment.appendix === 'object' ? assessment.appendix : {};
  assessment.appendix.transcript_processing_status = 'received';
  assessment.appendix.ai_extraction_status = 'generated';
  assessment.appendix.ai_provider = 'gemini';
  assessment.appendix.ai_model = geminiModel;
  assessment.appendix.ai_generated_at = now;

  assessment.review_status = {
    executive_summary: 'Pendente',
    software_map: 'Pendente',
    gap_map: 'Pendente',
    flows: 'Pendente',
    recommendations: 'Pendente'
  };

  return assessment;
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

app.post('/api/assessment/import-docx', async (req, res) => {
  const input = req.body || {};
  const filename = normalizeOptionalString(input.filename);
  const source = input.source && typeof input.source === 'object' ? input.source : {};
  const sourceType = allowedSourceTypes.has(source.type) ? source.type : 'local_upload';
  const contentBase64 = typeof input.content_base64 === 'string' ? input.content_base64 : '';

  if (!filename || !filename.toLowerCase().endsWith('.docx')) {
    return res.status(400).json({
      ok: false,
      error: 'DOCX_FILE_REQUIRED',
      message: 'Importe um arquivo .docx válido.'
    });
  }

  if (!contentBase64) {
    return res.status(400).json({
      ok: false,
      error: 'DOCX_CONTENT_REQUIRED',
      message: 'Conteúdo do arquivo .docx não recebido.'
    });
  }

  let buffer;
  try {
    buffer = Buffer.from(contentBase64, 'base64');
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: 'DOCX_BASE64_INVALID',
      message: 'Conteúdo base64 do arquivo .docx é inválido.'
    });
  }

  if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
    return res.status(400).json({
      ok: false,
      error: 'DOCX_SIZE_INVALID',
      message: 'O arquivo .docx precisa ter até 8 MB.'
    });
  }

  try {
    const extracted = await mammoth.extractRawText({ buffer });
    const text = normalizeExtractedText(extracted.value);
    const wordCount = countWords(text);

    if (text.length < 20) {
      return res.status(422).json({
        ok: false,
        error: 'DOCX_TEXT_NOT_EXTRACTED',
        message: 'Não foi possível extrair texto suficiente do arquivo .docx.'
      });
    }

    return res.status(200).json({
      ok: true,
      filename,
      source: normalizeSource({
        type: sourceType,
        filename,
        origin_reference: source.origin_reference
      }, 'local_upload'),
      text,
      diagnostics: {
        character_count: text.length,
        word_count: wordCount,
        warning_count: extracted.messages.length,
        warnings: extracted.messages.map((message) => ({
          type: message.type,
          message: message.message
        }))
      }
    });
  } catch (error) {
    return res.status(422).json({
      ok: false,
      error: 'DOCX_IMPORT_FAILED',
      message: error.message || 'Falha ao extrair texto do arquivo .docx.'
    });
  }
});

app.post('/api/assessment/generate', async (req, res) => {
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

  let assessment;
  try {
    assessment = geminiEnabled() ? await createAssessmentWithGemini(input) : createAssessmentDraft(input);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: 'AI_ASSESSMENT_GENERATION_FAILED',
      message: error.message || 'Falha ao gerar assessment com IA.',
      provider: 'gemini',
      model: geminiModel
    });
  }

  const validation = validateAssessment(assessment);

  if (!validation.valid) {
    return res.status(500).json({
      ok: false,
      error: geminiEnabled() ? 'AI_ASSESSMENT_SCHEMA_INVALID' : 'GENERATED_ASSESSMENT_INVALID',
      message: geminiEnabled()
        ? 'A IA gerou um assessment incompatível com o schema oficial.'
        : 'O backend gerou um assessment incompatível com o schema oficial.',
      validation,
      provider: geminiEnabled() ? 'gemini' : null,
      model: geminiEnabled() ? geminiModel : null
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
