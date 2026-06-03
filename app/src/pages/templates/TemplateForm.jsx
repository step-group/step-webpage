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
        setDatasets((t.datasets || []).map(d => ({
          title: d.title,
          equipment: d.equipment,
          columns: (d.columns || []).map(c => ({ name: c.name, unit: c.unit })),
        })));
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

  function updateDataset(i, field, value) {
    setDatasets(ds => ds.map((x, idx) => idx === i ? { ...x, [field]: value } : x));
  }
  function addColumn(di) {
    setDatasets(ds => ds.map((x, i) => i !== di ? x : { ...x, columns: [...(x.columns || []), { name: '', unit: '' }] }));
  }
  function updateColumn(di, ci, field, value) {
    setDatasets(ds => ds.map((x, i) => i !== di ? x : {
      ...x,
      columns: x.columns.map((c, j) => j !== ci ? c : { ...c, [field]: value }),
    }));
  }
  function removeColumn(di, ci) {
    setDatasets(ds => ds.map((x, i) => i !== di ? x : {
      ...x,
      columns: x.columns.filter((_, j) => j !== ci),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('El título es requerido');
    setLoading(true);
    try {
      const payload = {
        ...form,
        steps: steps.filter(s => s.body.trim()).map((s, i) => ({ body: s.body, ordering: i })),
        datasets: datasets.filter(d => d.title.trim()).map((d, i) => ({
          title:    d.title.trim(),
          equipment: d.equipment,
          ordering: i,
          columns:  (d.columns || []).filter(c => c.name.trim()).map((c, j) => ({ name: c.name.trim(), unit: c.unit, ordering: j })),
        })),
      };
      if (isEdit) {
        await api.templates.update(id, payload);
      } else {
        await api.templates.create(payload);
      }
      navigate('/app/templates');
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

        {/* Steps */}
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

        {/* Datasets */}
        <div>
          <div className={styles.stepsHeader} style={{ marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Datasets del experimento</span>
            <span style={{ fontWeight: 400, fontSize: '0.78rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
              — se crean automáticamente al usar esta plantilla
            </span>
          </div>
          <div className={styles.stepsEditor}>
            {datasets.map((d, di) => (
              <div key={di} className={styles.datasetEditorBlock}>
                {/* Title + equipment row */}
                <div className={styles.datasetEditorMainRow}>
                  <span className={styles.stepNumber}>{di + 1}</span>
                  <input
                    className={styles.datasetInput}
                    value={d.title}
                    onChange={e => updateDataset(di, 'title', e.target.value)}
                    placeholder="Título del dataset"
                  />
                  <input
                    className={styles.datasetInput}
                    value={d.equipment}
                    onChange={e => updateDataset(di, 'equipment', e.target.value)}
                    placeholder="Equipo"
                  />
                  <button
                    type="button"
                    className={styles.stepDelete}
                    onClick={() => setDatasets(ds => ds.filter((_, idx) => idx !== di))}
                  >×</button>
                </div>

                {/* Columns sub-editor */}
                <div className={styles.columnsSubSection}>
                  <span className={styles.colsLabel}>Columnas de datos</span>
                  {(d.columns || []).map((col, ci) => (
                    <div key={ci} className={styles.colEditorRow}>
                      <input
                        className={`${styles.colInput} ${styles.colInputName}`}
                        value={col.name}
                        onChange={e => updateColumn(di, ci, 'name', e.target.value)}
                        placeholder="Nombre (T)"
                      />
                      <input
                        className={`${styles.colInput} ${styles.colInputUnit}`}
                        value={col.unit}
                        onChange={e => updateColumn(di, ci, 'unit', e.target.value)}
                        placeholder="Unidad (K)"
                      />
                      <button type="button" className={styles.stepDelete} onClick={() => removeColumn(di, ci)}>×</button>
                    </div>
                  ))}
                  <button type="button" className={styles.btnAddCol} onClick={() => addColumn(di)}>
                    + columna
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={styles.btnSecondary}
            style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}
            onClick={() => setDatasets(ds => [...ds, { title: '', equipment: '', columns: [] }])}
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
