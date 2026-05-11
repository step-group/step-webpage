import { useEffect, useState } from 'react';
import { api } from '../api/client';
import styles from './DatasetSection.module.css';

const EMPTY_POINT = {
  temperature_k: '', pressure_kpa: '101.325', mole_fraction_1: '',
  density_kg_m3: '', u_density: '', u_temperature: '', u_pressure: '',
  phase: 'liquid', notes: '',
};

function NewDatasetForm({ experimentId, onCreated, onCancel }) {
  const [form, setForm] = useState({
    title: '', equipment: '', calibration_notes: '',
    c1_name: '', c1_cas: '', c1_purity: '', c1_supplier: '',
    c2_name: '', c2_cas: '', c2_purity: '', c2_supplier: '',
  });
  const [isMixture, setIsMixture] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(f) { return e => setForm(p => ({ ...p, [f]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('El título es requerido');
    if (!form.c1_name.trim()) return setError('El nombre del compuesto 1 es requerido');
    setLoading(true);
    try {
      const compounds = [
        { compound_index: 1, name: form.c1_name, cas_number: form.c1_cas, purity: form.c1_purity || null, supplier: form.c1_supplier },
        ...(isMixture && form.c2_name.trim()
          ? [{ compound_index: 2, name: form.c2_name, cas_number: form.c2_cas, purity: form.c2_purity || null, supplier: form.c2_supplier }]
          : []),
      ];
      const ds = await api.experiments.createDataset(experimentId, {
        title: form.title, equipment: form.equipment,
        calibration_notes: form.calibration_notes, compounds,
      });
      onCreated(ds);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.newDsForm}>
      <h4 className={styles.formHeading}>Nuevo dataset de densidad</h4>

      <div className={styles.formGrid}>
        <label className={styles.label}>
          Título *
          <input className={styles.input} value={form.title} onChange={set('title')} autoFocus required />
        </label>
        <label className={styles.label}>
          Equipo
          <input className={styles.input} value={form.equipment} onChange={set('equipment')} placeholder="Ej: Anton Paar DMA 5000 M" />
        </label>
      </div>

      <div className={styles.compoundGrid}>
        <div className={styles.compoundBlock}>
          <span className={styles.compoundLabel}>Compuesto 1 *</span>
          <div className={styles.compoundRow}>
            <input className={styles.input} placeholder="Nombre" value={form.c1_name} onChange={set('c1_name')} required />
            <input className={styles.input} placeholder="N° CAS" value={form.c1_cas}  onChange={set('c1_cas')}  style={{width:110}} />
            <input className={styles.input} placeholder="Pureza" value={form.c1_purity} onChange={set('c1_purity')} style={{width:80}} type="number" min="0" max="100" step="any" />
            <input className={styles.input} placeholder="Proveedor" value={form.c1_supplier} onChange={set('c1_supplier')} />
          </div>
        </div>

        <label className={styles.mixtureToggle}>
          <input type="checkbox" checked={isMixture} onChange={e => setIsMixture(e.target.checked)} />
          Mezcla binaria (agregar compuesto 2)
        </label>

        {isMixture && (
          <div className={styles.compoundBlock}>
            <span className={styles.compoundLabel}>Compuesto 2</span>
            <div className={styles.compoundRow}>
              <input className={styles.input} placeholder="Nombre" value={form.c2_name} onChange={set('c2_name')} />
              <input className={styles.input} placeholder="N° CAS" value={form.c2_cas}  onChange={set('c2_cas')}  style={{width:110}} />
              <input className={styles.input} placeholder="Pureza" value={form.c2_purity} onChange={set('c2_purity')} style={{width:80}} type="number" min="0" max="100" step="any" />
              <input className={styles.input} placeholder="Proveedor" value={form.c2_supplier} onChange={set('c2_supplier')} />
            </div>
          </div>
        )}
      </div>

      <label className={styles.label}>
        Notas de calibración
        <textarea className={styles.input} value={form.calibration_notes} onChange={set('calibration_notes')} rows={2} placeholder="Fluidos de calibración, fecha, observaciones..." />
      </label>

      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary} disabled={loading}>{loading ? 'Creando...' : 'Crear dataset'}</button>
        <button type="button" className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

function PointRow({ point, isMixture, datasetId, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    temperature_k:   String(point.temperature_k),
    pressure_kpa:    String(point.pressure_kpa),
    mole_fraction_1: point.mole_fraction_1 != null ? String(point.mole_fraction_1) : '',
    density_kg_m3:   String(point.density_kg_m3),
    u_density:       point.u_density   != null ? String(point.u_density)   : '',
    u_temperature:   point.u_temperature != null ? String(point.u_temperature) : '',
    u_pressure:      point.u_pressure  != null ? String(point.u_pressure)  : '',
  });

  function set(f) { return e => setForm(p => ({ ...p, [f]: e.target.value })); }

  async function save() {
    const payload = {
      temperature_k:   Number(form.temperature_k),
      pressure_kpa:    Number(form.pressure_kpa),
      density_kg_m3:   Number(form.density_kg_m3),
      mole_fraction_1: form.mole_fraction_1 !== '' ? Number(form.mole_fraction_1) : null,
      u_density:       form.u_density      !== '' ? Number(form.u_density)      : null,
      u_temperature:   form.u_temperature  !== '' ? Number(form.u_temperature)  : null,
      u_pressure:      form.u_pressure     !== '' ? Number(form.u_pressure)     : null,
    };
    const updated = await api.datasets.updatePoint(datasetId, point.id, payload);
    onUpdated(updated);
    setEditing(false);
  }

  async function del() {
    if (!confirm('¿Eliminar este punto?')) return;
    await api.datasets.deletePoint(datasetId, point.id);
    onDeleted(point.id);
  }

  if (editing) {
    return (
      <tr className={styles.editRow}>
        <td><input className={styles.cellInput} value={form.temperature_k}   onChange={set('temperature_k')}   type="number" step="any" /></td>
        <td><input className={styles.cellInput} value={form.pressure_kpa}    onChange={set('pressure_kpa')}    type="number" step="any" /></td>
        {isMixture && <td><input className={styles.cellInput} value={form.mole_fraction_1} onChange={set('mole_fraction_1')} type="number" step="any" min="0" max="1" /></td>}
        <td><input className={styles.cellInput} value={form.density_kg_m3}   onChange={set('density_kg_m3')}   type="number" step="any" /></td>
        <td><input className={styles.cellInput} value={form.u_density}       onChange={set('u_density')}       type="number" step="any" placeholder="—" /></td>
        <td><input className={styles.cellInput} value={form.u_temperature}   onChange={set('u_temperature')}   type="number" step="any" placeholder="—" /></td>
        <td>
          <button className={styles.btnSave} onClick={save}>✓</button>
          <button className={styles.btnCancel} onClick={() => setEditing(false)}>✕</button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{point.temperature_k}</td>
      <td>{point.pressure_kpa}</td>
      {isMixture && <td>{point.mole_fraction_1 != null ? point.mole_fraction_1 : '—'}</td>}
      <td className={styles.boldCell}>{point.density_kg_m3}</td>
      <td className={styles.muted}>{point.u_density   != null ? `±${point.u_density}`   : '—'}</td>
      <td className={styles.muted}>{point.u_temperature != null ? `±${point.u_temperature}` : '—'}</td>
      <td>
        <button className={styles.btnIcon} onClick={() => setEditing(true)} title="Editar">✎</button>
        <button className={styles.btnIconDanger} onClick={del} title="Eliminar">✕</button>
      </td>
    </tr>
  );
}

function AddPointRow({ datasetId, isMixture, onAdded, nextOrdering }) {
  const [form, setForm] = useState({ ...EMPTY_POINT });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(f) { return e => setForm(p => ({ ...p, [f]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.temperature_k || !form.density_kg_m3) return setError('T y ρ son requeridos');
    setLoading(true);
    try {
      const point = await api.datasets.addPoint(datasetId, {
        temperature_k:   Number(form.temperature_k),
        pressure_kpa:    form.pressure_kpa !== '' ? Number(form.pressure_kpa) : 101.325,
        mole_fraction_1: form.mole_fraction_1 !== '' ? Number(form.mole_fraction_1) : null,
        density_kg_m3:   Number(form.density_kg_m3),
        u_density:       form.u_density      !== '' ? Number(form.u_density)      : null,
        u_temperature:   form.u_temperature  !== '' ? Number(form.u_temperature)  : null,
        u_pressure:      form.u_pressure     !== '' ? Number(form.u_pressure)     : null,
        ordering: nextOrdering,
      });
      onAdded(point);
      setForm({ ...EMPTY_POINT });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      {error && <tr><td colSpan={isMixture ? 7 : 6}><p className={styles.error}>{error}</p></td></tr>}
      <tr className={styles.addRow}>
        <td><input className={styles.cellInput} value={form.temperature_k}   onChange={set('temperature_k')}   type="number" step="any" placeholder="298.15" /></td>
        <td><input className={styles.cellInput} value={form.pressure_kpa}    onChange={set('pressure_kpa')}    type="number" step="any" placeholder="101.325" /></td>
        {isMixture && <td><input className={styles.cellInput} value={form.mole_fraction_1} onChange={set('mole_fraction_1')} type="number" step="any" min="0" max="1" placeholder="0.5" /></td>}
        <td><input className={styles.cellInput} value={form.density_kg_m3}   onChange={set('density_kg_m3')}   type="number" step="any" placeholder="850.230" /></td>
        <td><input className={styles.cellInput} value={form.u_density}       onChange={set('u_density')}       type="number" step="any" placeholder="—" /></td>
        <td><input className={styles.cellInput} value={form.u_temperature}   onChange={set('u_temperature')}   type="number" step="any" placeholder="—" /></td>
        <td>
          <button className={styles.btnSave} onClick={submit} disabled={loading} title="Agregar punto">
            {loading ? '...' : '+'}
          </button>
        </td>
      </tr>
    </>
  );
}

function DatasetCard({ dataset: initialDs }) {
  const [ds, setDs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    api.datasets.get(initialDs.id)
      .then(setDs)
      .finally(() => setLoading(false));
  }, [initialDs.id]);

  async function deleteDataset() {
    if (!confirm('¿Eliminar este dataset y todos sus puntos?')) return;
    await api.datasets.delete(initialDs.id);
    setDs(null);
  }

  if (ds === null && !loading) return null;
  if (loading) return <div className={styles.dsCard}><p className={styles.muted}>Cargando...</p></div>;

  const isMixture = ds.compounds.length === 2;
  const comp1 = ds.compounds.find(c => c.compound_index === 1);
  const comp2 = ds.compounds.find(c => c.compound_index === 2);

  function addPoint(p)    { setDs(d => ({ ...d, points: [...d.points, p] })); }
  function updatePoint(p) { setDs(d => ({ ...d, points: d.points.map(x => x.id === p.id ? p : x) })); }
  function deletePoint(id){ setDs(d => ({ ...d, points: d.points.filter(x => x.id !== id) })); }

  const x2Label = isMixture ? `x(${comp2?.name?.split(' ')[0] || 'C2'})` : null;

  return (
    <div className={styles.dsCard}>
      <div className={styles.dsHeader}>
        <div className={styles.dsInfo}>
          <span className={styles.dsTitle}>{ds.title}</span>
          <span className={styles.dsMeta}>
            {ds.equipment && <><strong>{ds.equipment}</strong> · </>}
            {isMixture
              ? `${comp1?.name} + ${comp2?.name}`
              : comp1?.name}
            {' · '}
            {ds.points.length} puntos
          </span>
        </div>
        <div className={styles.dsActions}>
          <button className={styles.btnSecondary} onClick={() => setCollapsed(c => !c)}>
            {collapsed ? 'Expandir' : 'Colapsar'}
          </button>
          <button className={styles.btnDanger} onClick={deleteDataset}>Eliminar</button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Compound info */}
          <div className={styles.compoundsInfo}>
            {ds.compounds.map(c => (
              <span key={c.compound_index} className={styles.compoundChip}>
                <strong>{c.name}</strong>
                {c.cas_number && <> · CAS {c.cas_number}</>}
                {c.purity && <> · {c.purity} {c.purity_unit}</>}
              </span>
            ))}
          </div>

          {/* Data table */}
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>T / K</th>
                  <th>P / kPa</th>
                  {isMixture && <th>x₁ ({comp1?.name?.split(' ')[0]})</th>}
                  <th>ρ / kg·m⁻³</th>
                  <th>u(ρ)</th>
                  <th>u(T)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ds.points.map(p => (
                  <PointRow
                    key={p.id}
                    point={p}
                    isMixture={isMixture}
                    datasetId={ds.id}
                    onUpdated={updatePoint}
                    onDeleted={deletePoint}
                  />
                ))}
                <AddPointRow
                  datasetId={ds.id}
                  isMixture={isMixture}
                  onAdded={addPoint}
                  nextOrdering={ds.points.length}
                />
              </tbody>
            </table>
          </div>

          {ds.calibration_notes && (
            <p className={styles.calibration}>📋 {ds.calibration_notes}</p>
          )}
        </>
      )}
    </div>
  );
}

export default function DatasetSection({ experimentId }) {
  const [datasets, setDatasets]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);

  useEffect(() => {
    api.experiments.listDatasets(experimentId)
      .then(setDatasets)
      .finally(() => setLoading(false));
  }, [experimentId]);

  function onCreated(ds) {
    setDatasets(d => [...d, ds]);
    setShowForm(false);
  }

  return (
    <div>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Datasets de densidad ({datasets.length})</span>
        {!showForm && (
          <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>+ Nuevo dataset</button>
        )}
      </div>

      {loading && <p className={styles.muted}>Cargando...</p>}

      {showForm && (
        <NewDatasetForm
          experimentId={experimentId}
          onCreated={onCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {datasets.map(ds => (
        <DatasetCard key={ds.id} dataset={ds} />
      ))}
    </div>
  );
}
