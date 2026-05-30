import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  ListChecks,
  Loader2,
  Play,
  RefreshCw,
  Send,
  XCircle
} from 'lucide-react';
import {
  batchEvaluate,
  fetchEvaluationHistory,
  normalizeEvaluation,
  runEvaluation
} from './api.js';
import './styles.css';

const emptySingleForm = {
  prompt: '',
  response: '',
  expected_output: '',
  criteria: ''
};

const sampleBatch = JSON.stringify(
  [
    {
      task: 'Summarize the refund policy.',
      model_answer: 'Customers can request a refund within 30 days.',
      reference_answer: 'Refunds are available within 30 days.',
      evaluation_mode: 'general_answer',
      criteria: 'correctness, clarity, completeness'
    },
    {
      task: 'Classify the sentiment.',
      model_answer: 'The customer is frustrated about a delayed order.',
      reference_answer: 'negative',
      evaluation_mode: 'general_answer',
      criteria: [
        {
          name: 'correctness',
          description: 'Evaluate correctness.',
          weight: 1
        }
      ]
    }
  ],
  null,
  2
);

function App() {
  const [activeTab, setActiveTab] = useState('single');
  const [singleForm, setSingleForm] = useState(emptySingleForm);
  const [batchInput, setBatchInput] = useState(sampleBatch);
  const [history, setHistory] = useState([]);
  const [latestResults, setLatestResults] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState(null);

  const analytics = useMemo(() => getAnalytics(history), [history]);

  useEffect(() => {
    refreshHistory({ quiet: true });
  }, []);

  async function refreshHistory(options = {}) {
    if (!options.quiet) setIsRefreshing(true);
    try {
      const records = await fetchEvaluationHistory();
      setHistory(records.map(normalizeEvaluation));
      if (!options.quiet) setNotice({ type: 'success', text: 'History refreshed.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setIsRefreshing(false);
    }
  }

  async function submitSingle(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);
    try {
      const result = normalizeEvaluation(await runEvaluation(singleForm));
      setLatestResults([result]);
      setHistory((current) => [result, ...current]);
      setSingleForm(emptySingleForm);
      setNotice({ type: 'success', text: 'Evaluation completed.' });
      refreshHistory({ quiet: true });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitBatch(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);
    try {
      const parsed = JSON.parse(batchInput);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Batch input must be a non-empty JSON array.');
      }
      const results = await batchEvaluate(parsed);
      const normalized = results.map(normalizeEvaluation);
      setLatestResults(normalized);
      setHistory((current) => [...normalized, ...current]);
      setNotice({ type: 'success', text: `${normalized.length} evaluations completed.` });
      refreshHistory({ quiet: true });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">API proxy: /api to http://127.0.0.1:8000</p>
          <h1>LLM Evaluation Dashboard</h1>
        </div>
        <button className="icon-button" onClick={() => refreshHistory()} title="Refresh history">
          {isRefreshing ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
        </button>
      </header>

      <section className="metrics-grid" aria-label="Evaluation analytics">
        <MetricCard icon={<BarChart3 size={20} />} label="Average Score" value={analytics.averageScore} />
        <MetricCard icon={<CheckCircle2 size={20} />} label="Pass Rate" value={analytics.passRate} />
        <MetricCard icon={<Activity size={20} />} label="Evaluations" value={analytics.total} />
        <MetricCard icon={<XCircle size={20} />} label="Top Error" value={analytics.topError} />
      </section>

      <section className="error-breakdown" aria-label="Common error types">
        <div>
          <p className="eyebrow">Analytics</p>
          <h2>Common Error Types</h2>
        </div>
        <div className="error-pills">
          {analytics.commonErrors.length ? (
            analytics.commonErrors.map(([name, count]) => (
              <span key={stableKey(name)}>
                <Value value={name} />
                <strong>{count}</strong>
              </span>
            ))
          ) : (
            <span>No error types yet</span>
          )}
        </div>
      </section>

      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      <section className="workspace">
        <div className="panel controls-panel">
          <div className="tabs" role="tablist" aria-label="Evaluation mode">
            <button
              className={activeTab === 'single' ? 'active' : ''}
              onClick={() => setActiveTab('single')}
              type="button"
            >
              <Play size={16} />
              Single
            </button>
            <button
              className={activeTab === 'batch' ? 'active' : ''}
              onClick={() => setActiveTab('batch')}
              type="button"
            >
              <ListChecks size={16} />
              Batch
            </button>
          </div>

          {activeTab === 'single' ? (
            <SingleEvaluationForm
              form={singleForm}
              isSubmitting={isSubmitting}
              onChange={setSingleForm}
              onSubmit={submitSingle}
            />
          ) : (
            <BatchEvaluationForm
              value={batchInput}
              isSubmitting={isSubmitting}
              onChange={setBatchInput}
              onSubmit={submitBatch}
            />
          )}
        </div>

        <div className="panel results-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Latest output</p>
              <h2>Results</h2>
            </div>
          </div>
          <EvaluationList evaluations={latestResults} emptyText="Run an evaluation to see results here." />
        </div>
      </section>

      <section className="history-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Stored runs</p>
            <h2>Evaluation History</h2>
          </div>
          <span>{history.length} records</span>
        </div>
        <EvaluationList evaluations={history} emptyText="No evaluation history returned by the backend yet." />
      </section>
    </main>
  );
}

function SingleEvaluationForm({ form, isSubmitting, onChange, onSubmit }) {
  function updateField(field, value) {
    onChange({ ...form, [field]: value });
  }

  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <Field label="Prompt">
        <textarea
          value={form.prompt}
          onChange={(event) => updateField('prompt', event.target.value)}
          placeholder="User prompt or task"
          required
        />
      </Field>
      <Field label="Model Response">
        <textarea
          value={form.response}
          onChange={(event) => updateField('response', event.target.value)}
          placeholder="Response to evaluate"
          required
        />
      </Field>
      <Field label="Expected Output">
        <textarea
          value={form.expected_output}
          onChange={(event) => updateField('expected_output', event.target.value)}
          placeholder="Reference answer or target behavior"
        />
      </Field>
      <Field label="Criteria">
        <input
          value={form.criteria}
          onChange={(event) => updateField('criteria', event.target.value)}
          placeholder="Accuracy, tone, safety, completeness"
        />
      </Field>
      <SubmitButton isSubmitting={isSubmitting} label="Run Evaluation" />
    </form>
  );
}

function BatchEvaluationForm({ value, isSubmitting, onChange, onSubmit }) {
  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <Field label="Batch JSON">
        <textarea
          className="batch-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck="false"
          required
        />
      </Field>
      <SubmitButton isSubmitting={isSubmitting} label="Run Batch" />
    </form>
  );
}

function SubmitButton({ isSubmitting, label }) {
  return (
    <button className="primary-button" disabled={isSubmitting} type="submit">
      {isSubmitting ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
      {isSubmitting ? 'Running...' : label}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ icon, label, value }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>
          <Value value={value} />
        </strong>
      </div>
    </article>
  );
}

function EvaluationList({ evaluations, emptyText }) {
  if (!evaluations.length) {
    return <div className="empty-state">{emptyText}</div>;
  }

  return (
    <div className="evaluation-list">
      {evaluations.map((item) => (
        <article className="evaluation-card" key={item.id}>
          <div className="evaluation-header">
            <div>
              <span className={`status ${item.passed ? 'passed' : 'failed'}`}>
                {item.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {item.passed ? 'Passed' : 'Did not pass'}
              </span>
              <h3>Evaluation {shortId(item.evaluationId)}</h3>
            </div>
            <strong>{formatScore(item.score)}</strong>
          </div>
          <dl className="details-grid">
            <div>
              <dt>Evaluation ID</dt>
              <dd>
                <Value value={item.evaluationId} />
              </dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>
                <Value value={item.evaluationMode || 'Not specified'} />
              </dd>
            </div>
            <div>
              <dt>Overall Score</dt>
              <dd>{formatScore(item.score)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{item.passed ? 'Passed' : 'Did not pass'}</dd>
            </div>
          </dl>
          {renderStringList(formatCriteria(item.criteria), {
            title: 'Criteria',
            emptyText: 'No criteria',
            variant: 'text'
          })}
          {renderCriterionScores(item.criterionScores)}
          {renderStringList(item.errorTypes, {
            title: 'Error Types',
            emptyText: 'No error types',
            variant: 'badges'
          })}
          <TextBlock title="Explanation" value={item.explanation} emptyText="No explanation provided." />
          {renderStringList(item.suggestions, {
            title: 'Suggestions',
            emptyText: 'No suggestions',
            variant: 'list'
          })}
          <div className="meta-row">
            <span>
              <Clock size={14} />
              {item.createdAt}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

function getAnalytics(records) {
  if (!records.length) {
    return {
      averageScore: '0.00',
      passRate: '0%',
      total: 0,
      topError: 'None',
      commonErrors: []
    };
  }

  const totalScore = records.reduce((sum, item) => sum + Number(item.score || 0), 0);
  const passed = records.filter((item) => item.passed).length;
  const errors = records.reduce((counts, item) => {
    item.errorTypes.forEach((errorType) => {
      const label = analyticsLabel(errorType);
      if (label) counts[label] = (counts[label] || 0) + 1;
    });
    return counts;
  }, {});

  const commonErrors = Object.entries(errors).sort((a, b) => b[1] - a[1]);
  const topError = commonErrors[0]?.[0] || 'None';

  return {
    averageScore: (totalScore / records.length).toFixed(2),
    passRate: `${Math.round((passed / records.length) * 100)}%`,
    total: records.length,
    topError,
    commonErrors
  };
}

function formatScore(score) {
  const value = Number(score);
  if (Number.isNaN(value)) return 'n/a';
  return value.toFixed(2);
}

function renderCriterionScores(criterionScores) {
  const entries = isRecord(criterionScores) ? Object.entries(criterionScores) : [];

  return (
    <section className="result-section">
      <h4>Criterion Scores</h4>
      {entries.length ? (
        <dl className="score-list">
          {entries.map(([key, entryValue]) => (
            <div key={stableKey(key)}>
              <dt>{scalarText(key)}</dt>
              <dd>
                <Value value={entryValue} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>No criterion scores reported.</p>
      )}
    </section>
  );
}

function renderStringList(values, { title, emptyText, variant }) {
  const items = Array.isArray(values) ? values : [];

  return (
    <section className="result-section">
      <h4>{title}</h4>
      {items.length ? (
        variant === 'badges' ? (
          <div className="badge-list">
            {items.map((item, index) => (
              <span key={stableKey(item, index)}>
                {listItemLabel(item)}
              </span>
            ))}
          </div>
        ) : (
          <ul className="suggestion-list">
            {items.map((item, index) => (
              <li key={stableKey(item, index)}>
                {listItemLabel(item)}
              </li>
            ))}
          </ul>
        )
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  );
}

function formatCriteria(criteria) {
  if (!criteria) return [];
  if (Array.isArray(criteria)) return criteria.map(listItemLabel).filter((item) => item !== 'n/a');
  if (typeof criteria === 'string') {
    return criteria
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (isRecord(criteria)) return Object.keys(criteria);
  return [];
}

function listItemLabel(value) {
  if (isScalar(value)) return scalarText(value);
  if (isRecord(value)) {
    const label = value.name || value.criterion || value.criteria || value.key || value.id || value.type;
    if (isScalar(label) && label !== '') return scalarText(label);
    const firstScalarEntry = Object.entries(value).find(([, entryValue]) => isScalar(entryValue));
    if (firstScalarEntry) return `${scalarText(firstScalarEntry[0])}: ${scalarText(firstScalarEntry[1])}`;
    return 'Structured item';
  }
  if (Array.isArray(value)) return value.map(listItemLabel).filter(Boolean).join(', ');
  return 'n/a';
}

function Value({ value }) {
  if (Array.isArray(value)) {
    return value.length ? (
      <ul className="nested-list">
        {value.map((item, index) => (
          <li key={stableKey(item, index)}>
            <Value value={item} />
          </li>
        ))}
      </ul>
    ) : (
      'n/a'
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    return entries.length ? (
      <dl className="inline-object">
        {entries.map(([key, entryValue]) => (
          <div key={stableKey(key)}>
            <dt>{scalarText(key)}</dt>
            <dd>
              <Value value={entryValue} />
            </dd>
          </div>
        ))}
      </dl>
    ) : (
      'n/a'
    );
  }

  return scalarText(value);
}

function TextBlock({ title, value, emptyText }) {
  const hasValue =
    (Array.isArray(value) && value.length > 0) ||
    (isRecord(value) && Object.keys(value).length > 0) ||
    (isScalar(value) && value !== '');

  return (
    <section className="result-section">
      <h4>{title}</h4>
      {hasValue ? (
        <div className="text-value">
          <Value value={value} />
        </div>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  );
}

function analyticsLabel(value) {
  if (isScalar(value) && value !== '') return scalarText(value);
  if (isRecord(value)) {
    const type = value.type || value.error_type || value.name || value.code;
    if (isScalar(type) && type !== '') return scalarText(type);
    return 'Structured error';
  }
  if (Array.isArray(value)) {
    return value.map(analyticsLabel).find(Boolean) || 'Structured error';
  }
  return '';
}

function stableKey(value, index = 0) {
  if (isScalar(value)) return `${scalarText(value)}-${index}`;
  try {
    return `${JSON.stringify(value)}-${index}`;
  } catch {
    return `item-${index}`;
  }
}

function shortId(value) {
  const text = scalarText(value);
  if (!text || text === 'n/a') return 'new';
  return text.length > 8 ? text.slice(0, 8) : text;
}

function scalarText(value) {
  if (value === null || value === undefined || value === '') return 'n/a';
  if (typeof value === 'number') return Number.isInteger(value) ? `${value}` : value.toFixed(2);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  return 'n/a';
}

function isScalar(value) {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

createRoot(document.getElementById('root')).render(<App />);
