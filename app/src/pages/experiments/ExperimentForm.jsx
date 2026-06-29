import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import AppLayout from '../../layouts/AppLayout';
import styles from './Experiments.module.css';

const STATUS_OPTIONS = [
  { value: 'running',           label: 'En curso' },
  { value: 'success',           label: 'Exitoso' },
  { value: 'failure',           label: 'Fallido' },
  { value: 'need_to_be_redone', label: 'Repetir' },
];

export default function ExperimentForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '', body: '', status: 'running',
    date: new Date().toISOString().slice(0, 10),
    tags: [], template_id: '',
  });
  const [steps, setSteps]               = useState([]);
  const [templates, setTemplates]       = useState([]);
  const [appliedTemplate, setApplied]   = useState(null); // { id, title }
  const [tagInput, setTagInput]         = useState('');
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    const templateParam = searchParams.get('template');

    Promise.all([
      api.templates.list(),
      isEdit ? api.experiments.get(id) : Promise.resolve(null),
    ]).then(([tmplList, expData]) => {
      setTemplates(tmplList);

      if (isEdit && expData) {
        setForm({
          title:       expData.title,
          body:        expData.body,
          status:      expData.status,
          date:        expData.date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          tags:        expData.tags || [],
          template_id: expData.template_id ? String(expData.template_id) : '',
        });
        setSteps(expData.steps || []);
        if (expData.template_id) {
          const matched = tmplList.find(x => x.id === expData.template_id);
          if (matched) setApplied({ id: matched.id, title: matched.title });
        }
      } else if (templateParam) {
        const matched = tmplList.find(t => String(t.id) === templateParam);
        if (matched) {
          api.templates.get(matched.id).then(t => {
            setForm(f => ({ ...f, body: t.body || '', tags: t.tags || [], template_id: String(t.id) }));
            setSteps((t.steps || []).map(s => ({ body: s.body, ordering: s.ordering, finished: false })));
            setApplied({ id: t.id, title: t.title });
          });
        }
      }
    });
  }, [id, isEdit]);

  function applyTemplate(tmplId) {
    if (!tmplId) {
      setApplied(null);
      setForm(f => ({ ...f, body: '', tags: [], template_id: '' }));
      setSteps([]);
      return;
    }
    api.templates.get(tmplId).then(t => {
      setForm(f => ({ ...f, body: t.body || '', tags: t.tags || [], template_id: String(t.id) }));
      setSteps((t.steps || []).map(s => ({ body: s.body, ordering: s.ordering, finished: false })));
      setApplied({ id: t.id, title: t.title });
    });
  }

  function addTag(tag) {
    const t = tag.trim().toLowerCase();
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t] }));
    setTagInput('');
  }

  function removeTag(tag) { setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) })); }

  function addStep() {
    setSteps(s => [...s, { body: '', ordering: s.length, finished: false }]);
  }

  function updateStepBody(idx, value) {
    setSteps(s => s.map((step, i) => i === idx ? { ...step, body: value } : step));
  }

  function removeStep(idx) {
    setSteps(s => s.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('El título es requerido');
    setLoading(true);
    try {
      const payload = { ...form, template_id: form.template_id || undefined };

      if (isEdit) {
        await api.experiments.update(id, {
          title: payload.title, body: payload.body,
          status: payload.status, date: payload.date, tags: payload.tags,
        });
        for (const s of steps.filter(s => !s.id)) {
          await api.experiments.addStep(id, { body: s.body, ordering: s.ordering });
        }
        navigate(`/app/experiments/${id}`);
      } else {
        const exp = await api.experiments.create(payload);
        for (const s of steps.filter(s => !s.id)) {
          await api.experiments.addStep(exp.id, { body: s.body, ordering: s.ordering });
        }
        navigate(`/app/experiments/${exp.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className={styles.pageHeader}>
        <h2>{isEdit ? 'Editar experimento' : 'Nuevo experimento'}</h2>
        <Link
          to={isEdit ? `/app/experiments/${id}` : '/app/experiments'}
          className={styles.btnSecondary}
        >
          Cancelar
        </Link>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <p className={styles.error}>{error}</p>}

        {/* Template selector / banner */}
        {!isEdit && (
          appliedTemplate ? (
            <div className={styles.templateBanner}>
              <span>📋 Plantilla: <strong>{appliedTemplate.title}</strong></span>
              <button type="button" onClick={() => applyTemplate('')}>Cambiar</button>
            </div>
          ) : (
            <label>
              Usar plantilla <span className={styles.optional}>(opcional)</span>
              <select
                value={form.template_id}
                onChange={e => applyTemplate(e.target.value)}
              >
                <option value="">Sin plantilla</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </label>
          )
        )}

        <label>
          Título *
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
            autoFocus
            placeholder={
              appliedTemplate
                ? `Ej: ${appliedTemplate.title} — ${form.date}`
                : 'Nombre del experimento'
            }
          />
        </label>

        <div className={styles.formRow}>
          <label>
            Estado
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label>
            Fecha
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </label>
        </div>

        <label>
          Etiquetas
          <div className={styles.tagInput}>
            {form.tags.map(t => (
              <span key={t} className={styles.tagChip}>
                {t} <button type="button" onClick={() => removeTag(t)}>×</button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); }
              }}
              placeholder="Agregar etiqueta..."
            />
          </div>
          <span className={styles.hint}>Presiona Enter o coma para agregar</span>
        </label>

        <label>
          Descripción / Protocolo
          <textarea
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            placeholder="Describe el experimento, materiales, procedimiento..."
          />
        </label>

        <div>
          <div className={styles.stepsHeader}>
            <span>Pasos del protocolo</span>
            {appliedTemplate && steps.length > 0 && (
              <span className={styles.stepsFromTemplate}>copiados desde la plantilla — puedes editarlos</span>
            )}
          </div>
          <div className={styles.stepsEditor}>
            {steps.map((s, i) => (
              <div key={i} className={styles.stepEditorItem}>
                <span className={styles.stepNumber}>{i + 1}</span>
                <input
                  value={s.body}
                  onChange={e => updateStepBody(i, e.target.value)}
                  placeholder={`Paso ${i + 1}`}
                />
                <button type="button" className={styles.stepDelete} onClick={() => removeStep(i)}>×</button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={styles.btnSecondary}
            style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}
            onClick={addStep}
          >
            + Agregar paso
          </button>
        </div>

        <div className={styles.formActions}>
          <button type="submit" disabled={loading} className={styles.btnPrimary}>
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear experimento'}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}
