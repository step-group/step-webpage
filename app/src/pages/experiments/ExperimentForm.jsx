import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '', body: '', status: 'running',
    date: new Date().toISOString().slice(0, 10),
    tags: [], template_id: '',
  });
  const [steps, setSteps]       = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tagInput, setTagInput]  = useState('');
  const [error, setError]        = useState('');
  const [loading, setLoading]    = useState(false);

  useEffect(() => {
    api.templates.list().then(setTemplates);
    if (isEdit) {
      api.experiments.get(id).then(exp => {
        setForm({
          title:       exp.title,
          body:        exp.body,
          status:      exp.status,
          date:        exp.date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          tags:        exp.tags || [],
          template_id: exp.template_id || '',
        });
        setSteps(exp.steps || []);
      });
    }
  }, [id, isEdit]);

  function applyTemplate(tmplId) {
    if (!tmplId) return;
    api.templates.get(tmplId).then(t => {
      setForm(f => ({ ...f, body: t.body, tags: t.tags, template_id: tmplId }));
      setSteps(t.steps.map(s => ({ body: s.body, ordering: s.ordering, finished: false })));
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
      const payload = {
        ...form,
        template_id: form.template_id || undefined,
        tags: form.tags,
      };

      if (isEdit) {
        await api.experiments.update(id, { title: payload.title, body: payload.body, status: payload.status, date: payload.date, tags: payload.tags });
        // Sync steps: for edit, we add new steps only (existing steps managed inline on detail page)
        for (const s of steps.filter(s => !s.id)) {
          await api.experiments.addStep(id, { body: s.body, ordering: s.ordering });
        }
        navigate(`/app/experiments/${id}`);
      } else {
        const exp = await api.experiments.create(payload);
        // Steps are copied from template automatically by the API; add extra ones if any
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
        <Link to={isEdit ? `/app/experiments/${id}` : '/app/experiments'} className={styles.btnSecondary}>Cancelar</Link>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <p className={styles.error}>{error}</p>}

        {!isEdit && (
          <label>
            Usar plantilla (opcional)
            <select
              value={form.template_id}
              onChange={e => { setForm(f => ({ ...f, template_id: e.target.value })); applyTemplate(e.target.value); }}
            >
              <option value="">Sin plantilla</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
        )}

        <label>
          Título *
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required autoFocus
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
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
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
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); } }}
              placeholder="Agregar etiqueta..."
            />
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Presiona Enter o coma para agregar</span>
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
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            Pasos del protocolo
          </div>
          <div className={styles.stepsEditor}>
            {steps.map((s, i) => (
              <div key={i} className={styles.stepEditorItem}>
                <span className={styles.dragHandle}>⠿</span>
                <input
                  value={s.body}
                  onChange={e => updateStepBody(i, e.target.value)}
                  placeholder={`Paso ${i + 1}`}
                />
                <button type="button" className={styles.stepDelete} onClick={() => removeStep(i)}>×</button>
              </div>
            ))}
          </div>
          <button type="button" className={styles.btnSecondary} style={{ marginTop: '0.5rem', fontSize: '0.8rem' }} onClick={addStep}>
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
