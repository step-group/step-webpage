import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { fetchGHS, structureUrl } from '../../utils/pubchem';
import styles from './ContainerDetail.module.css';
import { X } from 'lucide-react';

// ── Inline-edit field ─────────────────────────────────────────────────────────

function Field({ label, value, fieldKey, containerId, onSave }) {
  const [editing, setEditing]   = useState(false);
  const [draft,   setDraft]     = useState(value ?? '');
  const [saving,  setSaving]    = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.resources.update(containerId, { [fieldKey]: draft || null });
      onSave(fieldKey, draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancel() { setDraft(value ?? ''); setEditing(false); }

  return (
    <div className={styles.field}>
      <div className={styles.fieldHeader}>
        <span className={styles.fieldLabel}>{label}</span>
        {!editing && (
          <button className={styles.editLink} onClick={() => setEditing(true)}>Edit</button>
        )}
      </div>
      {editing ? (
        <div className={styles.fieldEdit}>
          <input
            className={styles.fieldInput}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          />
          <button className={styles.saveBtn} onClick={save} disabled={saving}>
            {saving ? '…' : 'Save'}
          </button>
          <button className={styles.cancelBtn} onClick={cancel}>Cancel</button>
        </div>
      ) : (
        <div className={styles.fieldValue}>{value || <span className={styles.none}>None</span>}</div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ContainerDetail({ containerId, onClose, onUpdated }) {
  const [container,  setContainer]  = useState(null);
  const [liveGHS,    setLiveGHS]    = useState(null);
  const [ghsLoading, setGhsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!containerId) return;
    api.resources.get(containerId).then(c => {
      setContainer(c);
      setLiveGHS(null);
    });
  }, [containerId]);

  // Fetch live GHS (for pictograms) when CAS available
  useEffect(() => {
    if (!container?.cas_number) return;
    setGhsLoading(true);
    fetchGHS(container.cas_number)
      .then(setLiveGHS)
      .finally(() => setGhsLoading(false));
  }, [container?.cas_number]);

  function handleSave(key, val) {
    setContainer(c => ({ ...c, [key]: val }));
    onUpdated?.();
  }

  if (!containerId) return null;

  const locationLabel = container
    ? [container.location_parent_name, container.location_name].filter(Boolean).join(' > ')
    : '';

  const imgUrl = container?.cas_number
    ? structureUrl(container.cas_number, '250x200')
    : null;

  // Prefer live GHS data; fall back to stored hazard_codes instantly
  const storedCodes  = container?.hazard_codes
    ? container.hazard_codes.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const hazardCodes  = liveGHS?.hazardCodes?.length ? liveGHS.hazardCodes : storedCodes;
  const pictograms   = liveGHS?.pictogramUrls ?? [];
  const signalWord   = liveGHS?.signalWord || container?.ghs_signal_word || '';
  const cid          = liveGHS?.cid;

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        {/* ── Close ── */}
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        <div className={styles.body}>
          {/* ── LEFT: structure + GHS ── */}
          <div className={styles.left}>
            <div className={styles.structureBox}>
              {imgUrl ? (
                <img
                  src={imgUrl}
                  alt="Molecular structure"
                  className={styles.structureImg}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              ) : (
                <span className={styles.noStructure}>No structure available</span>
              )}
            </div>

            <div className={styles.ghsSection}>
              <div className={styles.ghsHeader}>
                <span className={styles.ghsTitle}>GHS Safety Summary</span>
                {cid && (
                  <a
                    href={`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.viewMore}
                  >
                    View more ▾
                  </a>
                )}
              </div>

              {/* Stored codes shown instantly while live fetch loads */}
              {storedCodes.length > 0 && !liveGHS && (
                <p className={styles.ghsCodes}>
                  {storedCodes.map(h => <span key={h} className={styles.hCode}>{h}</span>)}
                  {ghsLoading && <span className={styles.ghsMuted}> (cargando…)</span>}
                </p>
              )}

              {/* Live pictograms */}
              {pictograms.length > 0 && (
                <div className={styles.ghsPics}>
                  {pictograms.map((url, i) => (
                    <img key={i} src={url} alt="GHS" className={styles.ghsPic} />
                  ))}
                </div>
              )}

              {/* Live H-codes */}
              {liveGHS && hazardCodes.length > 0 && (
                <p className={styles.ghsCodes}>
                  Hazard Codes:{' '}
                  {hazardCodes.map(h => <span key={h} className={styles.hCode}>{h}</span>)}
                </p>
              )}

              {signalWord && (
                <p className={styles.signalWord}>{signalWord}</p>
              )}

              {ghsLoading && !storedCodes.length && (
                <p className={styles.ghsMuted}>Loading safety data…</p>
              )}
              {!ghsLoading && !liveGHS && !storedCodes.length && container?.cas_number && (
                <p className={styles.ghsMuted}>No safety data found.</p>
              )}
              {!container?.cas_number && (
                <p className={styles.ghsMuted}>No CAS number — safety data unavailable.</p>
              )}
            </div>
          </div>

          {/* ── CENTER column ── */}
          <div className={styles.col}>
            <Field label="Container Name"    fieldKey="name"          value={container?.name}           containerId={containerId} onSave={handleSave} />
            <Field label="CAS Number"        fieldKey="cas_number"    value={container?.cas_number}     containerId={containerId} onSave={handleSave} />
            <Field label="Container Size"    fieldKey="quantity"      value={container ? `${container.quantity} ${container.unit}` : ''} containerId={containerId} onSave={handleSave} />
            <Field label="Barcode"           fieldKey="barcode"       value={container?.barcode}        containerId={containerId} onSave={handleSave} />
            <Field label="Location"          fieldKey="_location"     value={locationLabel}             containerId={containerId} onSave={handleSave} />
            <Field label="Supplier"          fieldKey="supplier"      value={container?.supplier}       containerId={containerId} onSave={handleSave} />
            <Field label="Date Acquired"     fieldKey="date_acquired" value={container?.date_acquired}  containerId={containerId} onSave={handleSave} />

            <div className={styles.sdsField}>
              <div className={styles.fieldHeader}>
                <span className={styles.fieldLabel}>SDS and File Storage</span>
                <button className={styles.manageLink}>Manage</button>
              </div>
              <div className={styles.sdsGroup}>
                <span className={styles.sdsSubLabel}>Container Files</span>
                <span className={styles.none}>None</span>
              </div>
              <div className={styles.sdsGroup}>
                <span className={styles.sdsSubLabel}>Substance Files</span>
                <span className={styles.none}>None</span>
              </div>
            </div>

            <Field label="Comments"          fieldKey="comments"      value={container?.comments}       containerId={containerId} onSave={handleSave} />
            <Field label="Estado actual"     fieldKey="estado_actual" value={container?.estado_actual}  containerId={containerId} onSave={handleSave} />
          </div>

          {/* ── RIGHT column ── */}
          <div className={styles.col}>
            <Field label="Grado"                    fieldKey="grado"                    value={container?.grado}                    containerId={containerId} onSave={handleSave} />
            <Field label="Número"                   fieldKey="numero"                   value={container?.numero}                   containerId={containerId} onSave={handleSave} />
            <Field label="Status en inventario"     fieldKey="inventory_status"         value={container?.inventory_status}         containerId={containerId} onSave={handleSave} />
            <Field label="Almacenamiento requerido" fieldKey="almacenamiento_requerido" value={container?.almacenamiento_requerido} containerId={containerId} onSave={handleSave} />
            <Field label="Clase química"            fieldKey="clase_quimica"            value={container?.clase_quimica}            containerId={containerId} onSave={handleSave} />
            <Field label="Disposición de residuos"  fieldKey="disposicion_residuos"     value={container?.disposicion_residuos}     containerId={containerId} onSave={handleSave} />
            <Field label="Estado físico (25 °C)"    fieldKey="estado_fisico"            value={container?.estado_fisico}            containerId={containerId} onSave={handleSave} />
            <Field label="Modelación"               fieldKey="modelacion"               value={container?.modelacion}               containerId={containerId} onSave={handleSave} />
            <Field label="Polaridad"                fieldKey="polaridad"                value={container?.polaridad}                containerId={containerId} onSave={handleSave} />

            <div className={styles.panelActions}>
              <button className={styles.actionLink}>Duplicate Container</button>
              <button className={styles.actionLink}>View History</button>
            </div>
            <div className={styles.panelActions}>
              <button className={styles.actionLink}>Create GHS Label</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
