import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import ConfirmModal from './ConfirmModal';
import styles from './DatasetSection.module.css';

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
  const [equipment, setEquipment] = useState('');
  const [calNotes, setCalNotes]   = useState('');
  const [c1Id, setC1Id]           = useState('');
  const [c2Id, setC2Id]           = useState('');
  const [isMixture, setIsMixture] = useState(false);
  const [title, setTitle]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const c1 = resourceLinks.find(r => r.id === Number(c1Id)) || null;
  const c2 = resourceLinks.find(r => r.id === Number(c2Id)) || null;

  useEffect(() => {
    if (!c1) { setTitle(''); return; }
    const suggested = isMixture && c2 ? `${c1.name} + ${c2.name}` : c1.name;
    setTitle(t => (!t || resourceLinks.some(r => t === r.name || t.includes(' + '))) ? suggested : t);
  }, [c1Id, c2Id, isMixture]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!title.trim()) return setError('El título es requerido');
    setLoading(true);
    try {
      const compounds = [
        ...(c1Id ? [{ compound_index: 1, resource_id: Number(c1Id) }] : []),
        ...(isMixture && c2Id ? [{ compound_index: 2, resource_id: Number(c2Id) }] : []),
      ];
      const ds = await api.experiments.createDataset(experimentId, {
        title, equipment, calibration_notes: calNotes, compounds,
      });
      onCreated(ds);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.newDsForm}>
      <h4 className={styles.formHeading}>Nuevo dataset</h4>
      <div className={styles.formSection}>
        <span className={styles.formSectionLabel}>Equipo</span>
        <div className={styles.formGrid}>
          <label className={styles.label}>
            Equipo
            <input className={styles.input} value={equipment} onChange={e => setEquipment(e.target.value)} placeholder="Ej: Anton Paar DMA 5000 M" autoFocus />
          </label>
          <label className={styles.label}>
            Notas de calibración
            <input className={styles.input} value={calNotes} onChange={e => setCalNotes(e.target.value)} placeholder="Fluido de ref., fecha, desviación..." />
          </label>
        </div>
      </div>

      {resourceLinks.length > 0 && (
        <div className={styles.formSection}>
          <span className={styles.formSectionLabel}>Sistema (opcional)</span>
          <div className={styles.compoundBlock}>
            <label className={styles.label}>
              Compuesto 1
              <select className={styles.input} value={c1Id} onChange={e => setC1Id(e.target.value)}>
                <option value="">Seleccionar...</option>
                {resourceLinks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            {c1 && <CompoundPill resource={c1} />}
          </div>
          <label className={styles.mixtureToggle}>
            <input type="checkbox" checked={isMixture} onChange={e => { setIsMixture(e.target.checked); if (!e.target.checked) setC2Id(''); }} />
            Mezcla binaria
          </label>
          {isMixture && (
            <div className={styles.compoundBlock}>
              <label className={styles.label}>
                Compuesto 2
                <select className={styles.input} value={c2Id} onChange={e => setC2Id(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {resourceLinks.filter(r => r.id !== Number(c1Id)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              {c2 && <CompoundPill resource={c2} />}
            </div>
          )}
        </div>
      )}

      <label className={styles.label}>
        Título del dataset *
        <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Nombre del dataset" required />
      </label>

      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary} disabled={loading}>{loading ? 'Creando...' : 'Crear dataset'}</button>
        <button type="button" className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
      </div>
    </form>
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
    setLoading(true); setError('');
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

function ColumnsEditor({ columns, onSave, onCancel }) {
  const [cols, setCols] = useState(
    columns.length > 0
      ? columns.map(c => ({ name: c.name, unit: c.unit }))
      : [{ name: '', unit: '' }]
  );
  const [saving, setSaving] = useState(false);

  function add()           { setCols(c => [...c, { name: '', unit: '' }]); }
  function remove(i)       { setCols(c => c.filter((_, j) => j !== i)); }
  function update(i, f, v) { setCols(c => c.map((x, j) => j !== i ? x : { ...x, [f]: v })); }

  async function save() {
    const valid = cols.filter(c => c.name.trim());
    if (!valid.length) return;
    setSaving(true);
    try { await onSave(valid); }
    finally { setSaving(false); }
  }

  return (
    <div className={styles.colsEditor}>
      <div className={styles.colsEditorHeader}>
        <span className={styles.colsEditorLabel}>Columnas de datos</span>
        <span className={styles.colsEditorHint}>Define las variables que se medirán en cada fila</span>
      </div>
      <div className={styles.colsEditorFields}>
        <div className={styles.colFieldHeaders}>
          <span className={styles.colFieldLabel} style={{ width: 110 }}>Variable</span>
          <span className={styles.colFieldLabel} style={{ width: 75 }}>Unidad</span>
        </div>
        {cols.map((col, i) => (
          <div key={i} className={styles.colEditorRow}>
            <input
              className={`${styles.colInput} ${styles.colInputName}`}
              value={col.name}
              onChange={e => update(i, 'name', e.target.value)}
              placeholder="ej: T"
              autoFocus={i === cols.length - 1 && col.name === ''}
            />
            <input
              className={`${styles.colInput} ${styles.colInputUnit}`}
              value={col.unit}
              onChange={e => update(i, 'unit', e.target.value)}
              placeholder="ej: K"
            />
            <button className={styles.btnIcon} onClick={() => remove(i)} title="Eliminar columna">✕</button>
          </div>
        ))}
        <button className={styles.btnAddCol} onClick={add}>+ agregar columna</button>
      </div>
      <div className={styles.colEditorActions}>
        <button className={styles.btnPrimary} onClick={save} disabled={saving || !cols.some(c => c.name.trim())}>
          {saving ? 'Guardando...' : 'Guardar columnas'}
        </button>
        <button className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function DatasetCard({ dataset: initialDs, resourceLinks = [] }) {
  const [ds, setDs]               = useState(null);
  const [loading, setLoading]     = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [editingCols, setEditingCols] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [modal, setModal]         = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    api.datasets.get(initialDs.id).then(setDs).finally(() => setLoading(false));
  }, [initialDs.id]);

  // Auto-dismiss success message after 4s
  useEffect(() => {
    if (!importMsg?.ok) return;
    const t = setTimeout(() => setImportMsg(null), 4000);
    return () => clearTimeout(t);
  }, [importMsg]);

  function deleteDataset() {
    setModal({
      message: '¿Eliminar este dataset y todos sus datos?',
      onConfirm: async () => { await api.datasets.delete(initialDs.id); setDs(null); },
    });
  }

  async function saveColumns(cols) {
    const updated = await api.datasets.setColumns(ds.id, cols);
    setDs(d => ({ ...d, columns: updated }));
    setEditingCols(false);
  }

  async function downloadExcel() {
    try {
      const res = await api.datasets.exportExcel(ds.id);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al generar Excel');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ds.title}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setImportMsg({ ok: false, text: err.message });
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImportLoading(true);
    setImportMsg(null);
    try {
      const result = await api.datasets.importExcel(ds.id, file);
      setImportMsg({ ok: true, text: `${result.imported} fila${result.imported !== 1 ? 's' : ''} importada${result.imported !== 1 ? 's' : ''}` });
      const updated = await api.datasets.get(ds.id);
      setDs(updated);
    } catch (err) {
      setImportMsg({ ok: false, text: err.message });
    } finally {
      setImportLoading(false);
      e.target.value = '';
    }
  }

  function deleteRow(rowId) {
    setModal({
      message: '¿Eliminar esta fila?',
      onConfirm: async () => {
        await api.datasets.deleteRow(ds.id, rowId);
        setDs(d => ({ ...d, rows: d.rows.filter(r => r.id !== rowId) }));
      },
    });
  }

  if (ds === null && !loading) return null;
  if (loading) return <div className={styles.dsCard}><p className={styles.muted} style={{ padding: '1rem 1.125rem' }}>Cargando...</p></div>;

  const noCompounds = ds.compounds.length === 0;
  const isMixture   = ds.compounds.length === 2;
  const comp1 = ds.compounds.find(c => c.compound_index === 1);
  const comp2 = ds.compounds.find(c => c.compound_index === 2);
  const hasColumns = ds.columns.length > 0;
  const hasRows    = ds.rows.length > 0;

  return (
    <div className={styles.dsCard}>
      {/* ── Header ── */}
      <div className={styles.dsHeader}>
        <div className={styles.dsInfo}>
          <span className={styles.dsTitle}>{ds.title}</span>
          <span className={styles.dsMeta}>
            {ds.equipment && <><strong>{ds.equipment}</strong> · </>}
            {noCompounds
              ? <span className={styles.pendingCompounds}>compuestos pendientes</span>
              : isMixture ? `${comp1?.name} + ${comp2?.name}` : comp1?.name}
            {hasRows && <> · <strong>{ds.rows.length}</strong> fila{ds.rows.length !== 1 ? 's' : ''}</>}
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
          {/* ── Compound setup ── */}
          {noCompounds && (
            <CompoundSetupForm
              datasetId={ds.id}
              resourceLinks={resourceLinks}
              onDone={compounds => setDs(d => ({ ...d, compounds }))}
            />
          )}

          {/* ── Compound info ── */}
          {!noCompounds && (
            <div className={styles.compoundsInfo}>
              {ds.compounds.map(c => (
                <span key={c.compound_index} className={styles.compoundChip}>
                  <strong>{c.name}</strong>
                  {c.cas_number && <> · CAS {c.cas_number}</>}
                  {c.purity && <> · {c.purity} {c.purity_unit}</>}
                </span>
              ))}
            </div>
          )}

          {/* ── No columns: prominent prompt ── */}
          {!hasColumns && !editingCols && (
            <div className={styles.noColumnsState}>
              <div className={styles.noColumnsIcon}>⊞</div>
              <div className={styles.noColumnsText}>
                <strong>Sin columnas definidas</strong>
                <span>Define las variables que se registrarán en cada fila de datos, por ejemplo: T (K), P (kPa), ρ (kg·m⁻³)</span>
              </div>
              <button className={styles.btnPrimary} onClick={() => setEditingCols(true)}>
                Definir columnas
              </button>
            </div>
          )}

          {/* ── Columns bar (when columns exist) ── */}
          {hasColumns && !editingCols && (
            <div className={styles.columnsBar}>
              <div className={styles.colChips}>
                {ds.columns.map(c => (
                  <span key={c.id} className={styles.colChip}>
                    {c.name}{c.unit && <em> ({c.unit})</em>}
                  </span>
                ))}
              </div>
              <button className={styles.btnEditCols} onClick={() => setEditingCols(true)}>
                Editar columnas
              </button>
            </div>
          )}

          {/* ── Inline column editor ── */}
          {editingCols && (
            <ColumnsEditor
              columns={ds.columns}
              onSave={saveColumns}
              onCancel={() => setEditingCols(false)}
            />
          )}

          {/* ── Excel actions (only when columns defined) ── */}
          {hasColumns && !editingCols && (
            <div className={styles.excelBar}>
              <button
                className={styles.btnExcelDown}
                onClick={downloadExcel}
                title="Descarga una plantilla Excel con las columnas definidas"
              >
                ⬇ Descargar plantilla
              </button>
              <label className={`${styles.btnExcelUp} ${importLoading ? styles.btnDisabled : ''}`}>
                {importLoading ? 'Importando...' : '⬆ Subir datos'}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  disabled={importLoading}
                />
              </label>
              {importMsg && (
                <span className={`${styles.importMsg} ${importMsg.ok ? styles.importMsgOk : styles.importMsgErr}`}>
                  {importMsg.ok ? '✓ ' : '✗ '}{importMsg.text}
                </span>
              )}
              {hasRows && (
                <span className={styles.rowCount}>{ds.rows.length} fila{ds.rows.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}

          {/* ── Data table ── */}
          {hasColumns && hasRows && (
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    {ds.columns.map(c => (
                      <th key={c.id}>{c.unit ? `${c.name} (${c.unit})` : c.name}</th>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ds.rows.map(row => (
                    <tr key={row.id}>
                      {ds.columns.map(c => {
                        const val = row.data[c.name];
                        return (
                          <td key={c.id}>
                            {val == null ? <span className={styles.muted}>—</span> : val}
                          </td>
                        );
                      })}
                      <td>
                        <button className={styles.btnIconDanger} onClick={() => deleteRow(row.id)} title="Eliminar fila">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Empty data state ── */}
          {hasColumns && !hasRows && !editingCols && (
            <div className={styles.noDataState}>
              <div className={styles.noDataSteps}>
                <div className={styles.noDataStep}>
                  <span className={styles.noDataStepNum}>1</span>
                  <span>Descarga la plantilla</span>
                </div>
                <span className={styles.noDataArrow}>→</span>
                <div className={styles.noDataStep}>
                  <span className={styles.noDataStepNum}>2</span>
                  <span>Completa los datos en Excel</span>
                </div>
                <span className={styles.noDataArrow}>→</span>
                <div className={styles.noDataStep}>
                  <span className={styles.noDataStepNum}>3</span>
                  <span>Sube el archivo</span>
                </div>
              </div>
            </div>
          )}

          {ds.calibration_notes && (
            <p className={styles.calibration}>📋 {ds.calibration_notes}</p>
          )}
        </>
      )}

      {modal && (
        <ConfirmModal
          message={modal.message}
          confirmLabel="Eliminar"
          danger
          onConfirm={async () => { await modal.onConfirm(); setModal(null); }}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}

export default function DatasetSection({ experimentId, resourceLinks = [] }) {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api.experiments.listDatasets(experimentId).then(setDatasets).finally(() => setLoading(false));
  }, [experimentId]);

  function onCreated(ds) {
    setDatasets(d => [...d, ds]);
    setShowForm(false);
  }

  return (
    <div>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Datasets ({datasets.length})</span>
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
