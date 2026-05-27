import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import AppLayout from '../../layouts/AppLayout';
import styles from './Templates.module.css';

export default function TemplateForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm]         = useState({ title: '', body: '', tags: [] });
  const [steps, setSteps]       = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (isEdit) {
      api.templates.get(id).then(t => {
        setForm({ title: t.title, body: t.body, tags: t.tags || [] });
        setSteps(t.steps || []);
        setDatasets((t.datasets || []).map(d => ({ title: d.title, equipment: d.equipment })));
      });
    }
  }, [id, isEdit]);

  function addTag(tag) {
    const t = tag.trim().toLowerCase();
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t] }));
    setTagInput('');
  }
  function removeTag(tag) { setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) })); }

  function addStep() { setSteps(s => [...s, { body: '' }]); }
  function updateStep(i, value) { setSteps(s => s.map((x, idx) => idx === i ? { ...x, body: value } : x)); }
  function removeStep(i) { setSteps(s => s.filter((_, idx) => idx !== i)); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('El título es requerido');
    setLoading(true);
    try {
      const payload = {
        ...form,
        steps:    steps.filter(s => s.body.trim()).map((s, i) => ({ body: s.body, ordering: i })),
        datasets: datasets.filter(d => d.title.trim()).map((d, i) => ({ title: d.title.trim(), equipment: d.equipment, ordering: i })),
      };
      if (isEdit) {
        await api.templates.update(id, payload);
        navigate('/app/templates');
      } else {
        await api.templates.create(payload);
        navigate('/app/templates');
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
        <h2>{isEdit ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
        <Link to="/app/templates" className={styles.btnSecondary}>Cancelar</Link>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <p className={styles.error}>{error}</p>}

        <label>
          Título *
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required autoFocus />
        </label>

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
        </label>

        <label>
          Descripción / Protocolo base
          <textarea
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            placeholder="Escribe el protocolo base de esta plantilla..."
          />
        </label>

        <div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            Pasos del protocolo
          </div>
          <div className={styles.stepsEditor}>
            {steps.map((s, i) => (
              <div key={i} className={styles.stepEditorItem}>
                <span className={styles.stepNumber}>{i + 1}</span>
                <input
                  value={s.body}
                  onChange={e => updateStep(i, e.target.value)}
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

        <div>
          <div className={styles.stepsHeader} style={{ marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Datasets del experimento</span>
            <span style={{ fontWeight: 400, fontSize: '0.78rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
              — se crean automáticamente al usar esta plantilla
            </span>
          </div>
          <div className={styles.stepsEditor}>
            {datasets.map((d, i) => (
              <div key={i} className={styles.datasetEditorItem}>
                <span className={styles.stepNumber}>{i + 1}</span>
                <input
                  className={styles.datasetInput}
                  value={d.title}
                  onChange={e => setDatasets(ds => ds.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))}
                  placeholder="Título del dataset"
                />
                <input
                  className={styles.datasetInput}
                  value={d.equipment}
                  onChange={e => setDatasets(ds => ds.map((x, idx) => idx === i ? { ...x, equipment: e.target.value } : x))}
                  placeholder="Equipo (ej: Anton Paar DMA 5000 M)"
                />
                <button
                  type="button"
                  className={styles.stepDelete}
                  onClick={() => setDatasets(ds => ds.filter((_, idx) => idx !== i))}
                >×</button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={styles.btnSecondary}
            style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}
            onClick={() => setDatasets(ds => [...ds, { title: 'Dataset de densidad', equipment: '' }])}
          >
            + Agregar dataset
          </button>
        </div>

        <div className={styles.formActions}>
          <button type="submit" disabled={loading} className={styles.btnPrimary}>
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear plantilla'}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}
