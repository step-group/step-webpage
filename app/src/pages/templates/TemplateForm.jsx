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
  const [tagInput, setTagInput] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (isEdit) {
      api.templates.get(id).then(t => {
        setForm({ title: t.title, body: t.body, tags: t.tags || [] });
        setSteps(t.steps || []);
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
        steps: steps.filter(s => s.body.trim()).map((s, i) => ({ body: s.body, ordering: i })),
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{isEdit ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
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

        <div className={styles.formActions}>
          <button type="submit" disabled={loading} className={styles.btnPrimary}>
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear plantilla'}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}
