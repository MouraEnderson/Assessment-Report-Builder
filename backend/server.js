const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const port = process.env.PORT || 10000;
const serviceVersion = process.env.SERVICE_VERSION || '0.1.0';

const allowedOrigins = (process.env.ASSESSMENT_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    }
  })
);

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'assessment-report-builder-backend',
    version: serviceVersion,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'assessment-report-builder-backend',
    version: serviceVersion,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.post('/api/assessment/generate', (req, res) => {
  const { transcript_text: transcriptText, assessment_type: assessmentType = 'plm_assessment', generation_mode: generationMode = 'consultivo' } = req.body || {};

  if (!transcriptText || typeof transcriptText !== 'string' || transcriptText.trim().length < 20) {
    return res.status(400).json({
      ok: false,
      error: 'TRANSCRIPT_TEXT_REQUIRED',
      message: 'Informe uma transcrição válida com pelo menos 20 caracteres.'
    });
  }

  const now = new Date().toISOString();

  return res.status(200).json({
    ok: true,
    assessment: {
      metadata: {
        assessment_id: `ASSESS-${Date.now()}`,
        version: '0.1',
        status: 'draft',
        assessment_type: assessmentType,
        generation_mode: generationMode,
        created_at: now,
        updated_at: now
      },
      client: {
        name: null,
        business_area: null
      },
      input_sources: {
        transcript: {
          type: 'manual_text',
          received_at: now
        }
      },
      executive_summary: {
        current_state: 'MVP técnico ativo. A extração com IA será implementada na próxima etapa.',
        main_pains: [],
        overall_maturity: null,
        evidence: null,
        confidence: 'Baixa'
      },
      meeting_summary: {
        raw_length: transcriptText.length,
        note: 'Transcrição recebida com sucesso pelo backend.'
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
      appendix: {},
      review_status: {
        executive_summary: 'Pendente',
        software_map: 'Pendente',
        gap_map: 'Pendente',
        flows: 'Pendente',
        recommendations: 'Pendente'
      }
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'NOT_FOUND',
    message: `Rota não encontrada: ${req.method} ${req.path}`
  });
});

app.use((err, req, res, next) => {
  console.error('[assessment-backend:error]', err);
  res.status(500).json({
    ok: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'Erro interno no backend.'
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Assessment Report Builder backend running on port ${port}`);
});
