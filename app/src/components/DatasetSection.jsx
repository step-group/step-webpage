import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { downloadThermoML } from '../utils/thermoml';
import styles from './DatasetSection.module.css';

const EMPTY_POINT = {
  temperature_k: '', pressure_kpa: '101.325', mole_fraction_1: '',
  density_kg_m3: '', u_density: '', u_temperature: '', u_pressure: '',
  phase: 'liquid', notes: '',
};

function CompoundPill({ resource }) {
  if (!resource) return null;
  return (
    <div className={styles.compoundPill}>
      <strong>{resource.name}</strong>
      {resource.cas_number && <span>CAS {resource.cas_number}</span>}
      {resource.grado      && <span>{resource.grado}</span>}
      {resource.supplier   && <span>{resource.supplier}</span>}
    </div>
  );
}

function NewDatasetForm({ experimentId, resourceLinks = [], onCreated, onCancel }) {
  const [equipment, setEquipment]   = useState('');
  const [calNotes, setCalNotes]     = useState('');
  const [c1Id, setC1Id]             = useState('');
  const [c2Id, setC2Id]             = useState('');
  const [isMixture, setIsMixture]   = useState(false);
  const [title, setTitle]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const c1 = resourceLinks.find(r => r.id === Number(c1Id)) || null;
  const c2 = resourceLinks.find(r => r.id === Number(c2Id)) || null;

  // auto-suggest title when compounds change
  useEffect(() => {
    if (!c1) { setTitle(''); return; }
    const suggested = isMixture && c2
      ? `Densidad: ${c1.name} + ${c2.name}`
      : `Densidad: ${c1.name}`;
    setTitle(t => (!t || t.startsWith('Densidad:')) ? suggested : t);
  }, [c1Id, c2Id, isMixture]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!title.trim()) return setError('El título es requerido');
    if (!c1Id)         return setError('Selecciona el compuesto 1');
    setLoading(true);
    try {
      const compounds = [
        { compound_index: 1, resource_id: Number(c1Id) },
        ...(isMixture && c2Id
          ? [{ compound_index: 2, resource_id: Number(c2Id) }]
          : []),
      ];
      const ds = await api.experiments.createDataset(experimentId, {
        title, equipment, calibration_notes: calNotes, compounds,
      });
      onCreated(ds);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  const availableForC2 = resourceLinks.filter(r => r.id !== Number(c1Id));

  return (
    <form onSubmit={handleSubmit} className={styles.newDsForm}>
      <h4 className={styles.formHeading}>Nuevo dataset de densidad</h4>

      {/* Equipment */}
      <div className={styles.formSection}>
        <span className={styles.formSectionLabel}>Equipo</span>
        <div className={styles.formGrid}>
          <label className={styles.label}>
            Densímetro *
            <input
              className={styles.input}
              value={equipment}
              onChange={e => setEquipment(e.target.value)}
              placeholder="Ej: Anton Paar DMA 5000 M"
              autoFocus
            />
          </label>
          <label className={styles.label}>
            Notas de calibración
            <input
              className={styles.input}
              value={calNotes}
              onChange={e => setCalNotes(e.target.value)}
              placeholder="Fluido de ref., fecha, desviación..."
            />
          </label>
        </div>
      </div>

      {/* Compounds */}
      <div className={styles.formSection}>
        <span className={styles.formSectionLabel}>Sistema</span>

        {resourceLinks.length === 0 ? (
          <p className={styles.noResources}>
            Vincula compuestos desde el inventario al experimento antes de crear un dataset.
          </p>
        ) : (
          <>
            <div className={styles.compoundBlock}>
              <label className={styles.label}>
                Compuesto 1 *
                <select
                  className={styles.input}
                  value={c1Id}
                  onChange={e => setC1Id(e.target.value)}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {resourceLinks.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
              <CompoundPill resource={c1} />
            </div>

            <label className={styles.mixtureToggle}>
              <input
                type="checkbox"
                checked={isMixture}
                onChange={e => { setIsMixture(e.target.checked); if (!e.target.checked) setC2Id(''); }}
              />
              Mezcla binaria (agregar compuesto 2)
            </label>

            {isMixture && (
              <div className={styles.compoundBlock}>
                <label className={styles.label}>
                  Compuesto 2
                  <select
                    className={styles.input}
                    value={c2Id}
                    onChange={e => setC2Id(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {availableForC2.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </label>
                <CompoundPill resource={c2} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Title */}
      <label className={styles.label}>
        Título del dataset *
        <input
          className={styles.input}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Se auto-completa al seleccionar compuestos"
          required
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary} disabled={loading || resourceLinks.length === 0}>
          {loading ? 'Creando...' : 'Crear dataset'}
        </button>
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

function CompoundSetupForm({ datasetId, resourceLinks, onDone }) {
  const [c1Id, setC1Id]           = useState('');
  const [c2Id, setC2Id]           = useState('');
  const [isMixture, setIsMixture] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const c1 = resourceLinks.find(r => r.id === Number(c1Id)) || null;
  const c2 = resourceLinks.find(r => r.id === Number(c2Id)) || null;

  async function save() {
    if (!c1Id) return setError('Selecciona el compuesto 1');
    setLoading(true);
    setError('');
    try {
      const compounds = [
        { compound_index: 1, resource_id: Number(c1Id) },
        ...(isMixture && c2Id ? [{ compound_index: 2, resource_id: Number(c2Id) }] : []),
      ];
      const updated = await api.datasets.setCompounds(datasetId, compounds);
      onDone(updated);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  if (resourceLinks.length === 0) {
    return (
      <p className={styles.noCompounds}>
        Vincula compuestos desde el inventario al experimento para configurar este dataset.
      </p>
    );
  }

  return (
    <div className={styles.compoundSetup}>
      <p className={styles.compoundSetupTitle}>Selecciona los compuestos del sistema</p>
      <div className={styles.compoundSetupRow}>
        <label className={styles.compoundSetupLabel}>
          Compuesto 1
          <select className={styles.compoundSetupSelect} value={c1Id} onChange={e => setC1Id(e.target.value)}>
            <option value="">Seleccionar...</option>
            {resourceLinks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        {c1 && <CompoundPill resource={c1} />}
      </div>

      <label className={styles.mixtureToggleInline}>
        <input type="checkbox" checked={isMixture} onChange={e => { setIsMixture(e.target.checked); if (!e.target.checked) setC2Id(''); }} />
        Mezcla binaria
      </label>

      {isMixture && (
        <div className={styles.compoundSetupRow}>
          <label className={styles.compoundSetupLabel}>
            Compuesto 2
            <select className={styles.compoundSetupSelect} value={c2Id} onChange={e => setC2Id(e.target.value)}>
              <option value="">Seleccionar...</option>
              {resourceLinks.filter(r => r.id !== Number(c1Id)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          {c2 && <CompoundPill resource={c2} />}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.btnPrimary} onClick={save} disabled={loading || !c1Id}>
        {loading ? 'Guardando...' : 'Confirmar compuestos'}
      </button>
    </div>
  );
}

function DatasetCard({ dataset: initialDs, resourceLinks = [] }) {
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

  const noCompounds = ds.compounds.length === 0;
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
            {noCompounds
              ? <span className={styles.pendingCompounds}>compuestos pendientes</span>
              : isMixture
                ? `${comp1?.name} + ${comp2?.name}`
                : comp1?.name}
            {!noCompounds && <> · {ds.points.length} puntos</>}
          </span>
        </div>
        <div className={styles.dsActions}>
          <button className={styles.btnSecondary} onClick={() => setCollapsed(c => !c)}>
            {collapsed ? 'Expandir' : 'Colapsar'}
          </button>
          <button
            className={styles.btnXml}
            onClick={() => downloadThermoML(ds)}
            title="Exportar como ThermoML (.xml)"
            disabled={ds.points.length === 0}
          >
            ThermoML ↓
          </button>
          <button className={styles.btnDanger} onClick={deleteDataset}>Eliminar</button>
        </div>
      </div>

      {!collapsed && noCompounds && (
        <CompoundSetupForm
          datasetId={ds.id}
          resourceLinks={resourceLinks}
          onDone={compounds => setDs(d => ({ ...d, compounds }))}
        />
      )}

      {!collapsed && !noCompounds && (
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

export default function DatasetSection({ experimentId, resourceLinks = [] }) {
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
          resourceLinks={resourceLinks}
          onCreated={onCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {datasets.map(ds => (
        <DatasetCard key={ds.id} dataset={ds} resourceLinks={resourceLinks} />
      ))}
    </div>
  );
}
