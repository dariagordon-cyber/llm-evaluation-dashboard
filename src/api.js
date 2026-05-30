const API_BASE_URL = '/api';

export async function runEvaluation(payload) {
  return request('/evaluate', {
    method: 'POST',
    body: JSON.stringify(toEvaluationRequest(payload))
  });
}

export async function batchEvaluate(items) {
  const response = await request('/batch-evaluate', {
    method: 'POST',
    body: JSON.stringify({ evaluations: items.map(toEvaluationRequest) })
  });

  if (Array.isArray(response)) return response;
  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.evaluations)) return response.evaluations;
  return [response];
}

export async function fetchEvaluationHistory() {
  const response = await request('/evaluations');
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.evaluations)) return response.evaluations;
  if (Array.isArray(response.results)) return response.results;
  return [];
}

export function normalizeEvaluation(raw) {
  const evaluationId = raw.evaluation_id || raw.id || crypto.randomUUID();
  const id = normalizeScalar(evaluationId, crypto.randomUUID());
  const score = raw.score ?? raw.overall_score ?? raw.metrics?.score ?? 0;
  const passed =
    raw.passed ?? raw.pass ?? (raw.status ? raw.status === 'passed' : Number(score) >= 0.7);
  const errorTypes = normalizeList(raw.error_types || raw.errorTypes || raw.error_type || raw.errorType);
  const createdAt = raw.created_at || raw.createdAt || raw.timestamp || new Date().toISOString();
  const title = firstScalar(raw.task, raw.title, raw.prompt, raw.input, raw.question);
  const criterionScores = normalizeObject(raw.criterion_scores || raw.criterionScores || raw.metrics || {});

  return {
    id,
    evaluationId: normalizeScalar(evaluationId, id),
    evaluationMode: normalizeScalar(raw.evaluation_mode || raw.mode, ''),
    title,
    score: Number(score),
    passed: Boolean(passed),
    criteria: normalizeCriteria(raw.criteria || raw.criterion_names || raw.criteria_names, criterionScores),
    criterionScores,
    errorTypes,
    explanation: raw.explanation ?? '',
    suggestions: normalizeList(raw.suggestions),
    createdAt: formatDate(createdAt)
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = safeMessage(data?.detail || data?.message || `Request failed with ${response.status}`);
    throw new Error(message);
  }

  return data;
}

function cleanPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

export function toEvaluationRequest(payload) {
  const cleaned = cleanPayload(payload);
  const {
    prompt,
    response,
    expected_output: expectedOutput,
    criteria,
    task,
    model_answer: modelAnswer,
    reference_answer: referenceAnswer,
    evaluation_mode: evaluationMode,
    ...rest
  } = cleaned;

  return cleanPayload({
    ...rest,
    task: task || prompt,
    model_answer: modelAnswer || response,
    reference_answer: referenceAnswer || expectedOutput,
    evaluation_mode: evaluationMode || 'general_answer',
    criteria: toCriterionObjects(criteria)
  });
}

function toCriterionObjects(criteria) {
  if (Array.isArray(criteria)) {
    const normalized = criteria.map(toCriterionObject).filter(Boolean);
    return withEvenWeights(normalized);
  }

  if (criteria && typeof criteria === 'object') {
    const normalized = Object.entries(criteria).map(([name, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return toCriterionObject({ name, ...value });
      }
      return toCriterionObject({
        name,
        description: isScalar(value) ? String(value) : `Evaluate ${name}.`
      });
    });
    return withEvenWeights(normalized);
  }

  const names = String(criteria || 'correctness')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  return withEvenWeights(
    names.map((name) => ({
      name,
      description: `Evaluate ${name}.`
    }))
  );
}

function toCriterionObject(value) {
  if (typeof value === 'string') {
    const name = value.trim();
    if (!name) return null;
    return {
      name,
      description: `Evaluate ${name}.`
    };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const name = normalizeScalar(value.name || value.criterion || value.key || value.id, '');
  if (!name) return null;

  return cleanPayload({
    name,
    description: normalizeScalar(value.description, `Evaluate ${name}.`),
    weight: typeof value.weight === 'number' ? value.weight : undefined
  });
}

function withEvenWeights(criteria) {
  if (!criteria.length) return [];
  const evenWeight = Number((1 / criteria.length).toFixed(4));

  return criteria.map((criterion) => ({
    ...criterion,
    weight: typeof criterion.weight === 'number' ? criterion.weight : evenWeight
  }));
}

function normalizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function normalizeCriteria(value, criterionScores) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  if (value && typeof value === 'object') return Object.keys(value);
  return Object.keys(criterionScores);
}

function firstScalar(...values) {
  return values.find((value) => isScalar(value) && value !== '') || '';
}

function normalizeScalar(value, fallback) {
  if (isScalar(value) && value !== '') return value;
  return fallback;
}

function isScalar(value) {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function safeMessage(value) {
  if (isScalar(value)) return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return 'Request failed';
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return firstScalar(value, '');
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}
