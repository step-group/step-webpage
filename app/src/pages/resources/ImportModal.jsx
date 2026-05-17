import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../../api/client';
import { structureUrl, fetchGHSBatch } from '../../utils/pubchem';
import styles from './ImportModal.module.css';
import { Upload, X, AlertTriangle, CheckCircle, Loader } from 'lucide-react';

// ── Excel parsers ──────────────────────────────────────────────────────────────

function parseQuantityUnit(raw) {
  if (!raw) return { quantity: 0, unit: '' };
  const str = String(raw).trim();
  const m = str.match(/^([\d.,]+)\s*([a-zA-Záéíóú]+)?/);
  if (!m) return { quantity: 0, unit: str };
  const unit = (m[2] || '').trim();
  return {
    quantity: parseFloat(m[1].replace(',', '.')) || 0,
    unit: unit === 'ml' ? 'mL' : unit === 'l' ? 'L' : unit,
  };
}

function normalizeEstado(raw) {
  if (!raw) return '';
  const s = String(raw).trim().toLowerCase();
  if (s.includes('liq') || s.includes('líq')) return 'Líquido';
  if (s.includes('sol')) return 'Sólido';
  if (s.includes('gas')) return 'Gas';
  return String(raw).trim();
}

function zoneLabel(raw) {
  if (!raw && raw !== 0) return '';
  const s = String(raw).trim();
  return s && s !== 'nan' ? `Zone ${s}` : '';
}

// STEP format: rows 0-5 metadata, row 6 headers, row 7+ data
function parseSTEPFormat(workbook) {
  const ws   = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  let headerIdx = rows.findIndex(r =>
    r.some(c => String(c).toLowerCase().includes('nombre'))
  );
  if (headerIdx === -1) headerIdx = 6;

  const headers = rows[headerIdx].map(h => String(h).trim().toLowerCase());

  return rows.slice(headerIdx + 1)
    .filter(r => r.some(c => c !== ''))
    .map(r => {
      const get = (...kws) => {
        for (const kw of kws) {
          const idx = headers.findIndex(h => h.includes(kw));
          if (idx !== -1 && r[idx] !== '') return r[idx];
        }
        return '';
      };
      const { quantity, unit } = parseQuantityUnit(get('cantidad'));
      return {
        name:          String(get('nombre') || '').trim(),
        quantity,
        unit,
        cas_number:    String(get('cas') || '').trim(),
        grado:         String(get('pureza') || '').trim(),
        comments:      String(get('presentac') || '').trim(),
        _zoneLabel:    zoneLabel(get('lugar')),
        estado_actual: normalizeEstado(get('estado')),
        clase_quimica: String(get('clasif') || '').trim(),
        supplier:      String(get('observ') || '').trim(),
      };
    })
    .filter(r => r.name);
}

// Generic: first row = headers
function parseGenericFormat(workbook) {
  const ws   = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return rows.map(r => {
    const k = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase().trim(), v]));
    const qty = parseQuantityUnit(k['cantidad'] || k['quantity'] || k['size'] || '');
    return {
      name:          String(k['nombre'] || k['name'] || k['container name'] || '').trim(),
      quantity:      qty.quantity,
      unit:          k['unit'] || k['unidad'] || qty.unit,
      cas_number:    String(k['cas'] || k['cas number'] || k['n° cas'] || '').trim(),
      grado:         String(k['pureza'] || k['grado'] || k['grade'] || '').trim(),
      comments:      String(k['presentacion'] || k['presentación'] || k['comments'] || '').trim(),
      _zoneLabel:    zoneLabel(k['lugar'] || k['location'] || ''),
      estado_actual: normalizeEstado(k['estado'] || k['estado actual'] || ''),
      clase_quimica: String(k['clasificacion'] || k['clasificación'] || '').trim(),
      supplier:      String(k['observaciones'] || k['supplier'] || k['proveedor'] || '').trim(),
    };
  }).filter(r => r.name);
}

// ── Component ──────────────────────────────────────────────────────────────────

const STEPS = { UPLOAD: 'upload', FETCHING: 'fetching', PREVIEW: 'preview', DONE: 'done' };

export default function ImportModal({ locations, onClose, onImported }) {
  const fileRef = useRef();
  const [step,       setStep]       = useState(STEPS.UPLOAD);
  const [rows,       setRows]       = useState([]);
  const [fileName,   setFileName]   = useState('');
  const [progress,   setProgress]   = useState({ done: 0, total: 0 });
  const [importResult, setResult]   = useState(null);
  const [loading,    setLoading]    = useState(false);

  const zoneMap = buildZoneMap(locations);
  function buildZoneMap(nodes, map = {}) {
    for (const n of nodes) {
      map[n.name] = n.id;
      if (n.children?.length) buildZoneMap(n.children, map);
    }
    return map;
  }

  function resolveRows(parsed) {
    return parsed.map(r => ({
      ...r,
      location_id: r._zoneLabel ? (zoneMap[r._zoneLabel] ?? null) : null,
      _resolvedZone: r._zoneLabel
        ? (zoneMap[r._zoneLabel] ? r._zoneLabel : `⚠ "${r._zoneLabel}" no encontrada`)
        : '—',
      // placeholders until PubChem fetch
      _ghs: null,
    }));
  }

  function handleFile(e) {
    const file = e.target.files?.[0] || e.dataTransfer?.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target.result);
      const wb   = XLSX.read(data, { type: 'array' });
      let parsed = parseSTEPFormat(wb);
      if (!parsed.length) parsed = parseGenericFormat(wb);
      const resolved = resolveRows(parsed);
      setRows(resolved);
      // auto-start PubChem fetch
      startPubChemFetch(resolved);
    };
    reader.readAsArrayBuffer(file);
  }

  async function startPubChemFetch(parsed) {
    const casNumbers = parsed.map(r => r.cas_number || '');
    const withCAS    = casNumbers.filter(Boolean).length;
    setProgress({ done: 0, total: withCAS });
    setStep(STEPS.FETCHING);

    const ghsResults = await fetchGHSBatch(casNumbers, {
      concurrency: 3,
      onProgress: (done) => setProgress(p => ({ ...p, done })),
    });

    const enriched = parsed.map((r, i) => {
      const ghs = ghsResults[i];
      return {
        ...r,
        _ghs:             ghs,
        hazard_codes:     ghs?.hazardCodes?.join(', ') ?? '',
        ghs_signal_word:  ghs?.signalWord  ?? '',
        // Use GHS physical state only if not already set
        estado_fisico: r.estado_fisico || '',
      };
    });

    setRows(enriched);
    setStep(STEPS.PREVIEW);
  }

  async function handleImport() {
    setLoading(true);
    try {
      const result = await api.resources.bulkImport(rows);
      setResult(result);
      setStep(STEPS.DONE);
      onImported?.();
    } catch (err) {
      setResult({ created: 0, errors: [{ row: 0, error: err.message }] });
      setStep(STEPS.DONE);
    } finally {
      setLoading(false);
    }
  }

  const withCAS  = rows.filter(r => r.cas_number).length;
  const withGHS  = rows.filter(r => r._ghs?.hazardCodes?.length).length;
  const warnZone = rows.some(r => r._resolvedZone?.startsWith('⚠'));

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>Import Containers from Excel / CSV</span>
          <button className={styles.closeBtn} onClick={onClose}><X size={15} /></button>
        </div>

        <div className={styles.body}>

          {/* ── UPLOAD ── */}
          {step === STEPS.UPLOAD && (
            <>
              <div
                className={styles.dropZone}
                onClick={() => fileRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFile({ dataTransfer: e.dataTransfer }); }}
              >
                <Upload size={28} className={styles.uploadIcon} />
                <p className={styles.dropText}>
                  Arrastra tu archivo <strong>.xlsx</strong> o <strong>.csv</strong> aquí, o haz clic para elegirlo
                </p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                  className={styles.fileInput} onChange={handleFile} />
              </div>
              <p className={styles.hint}>
                Compatible con el formato del Inventario STEP (<em>N° inventario, Nombre, Pureza, Cantidad, Presentación, Lugar, Estado, Clasificación, Observaciones</em>).
                Luego se consultará PubChem automáticamente por CAS para obtener la estructura 2D y los códigos GHS.
              </p>
            </>
          )}

          {/* ── FETCHING ── */}
          {step === STEPS.FETCHING && (
            <div className={styles.fetchingBox}>
              <Loader size={32} className={styles.spinIcon} />
              <p className={styles.fetchTitle}>Consultando PubChem…</p>
              <p className={styles.fetchSub}>
                {progress.done} / {progress.total} compuestos con CAS procesados
              </p>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className={styles.fetchNote}>
                Descargando estructuras 2D y clasificaciones GHS. Esto puede tardar ~{Math.ceil(progress.total * 0.5)} segundos.
              </p>
            </div>
          )}

          {/* ── PREVIEW ── */}
          {step === STEPS.PREVIEW && (
            <div className={styles.previewWrap}>
              <div className={styles.previewStats}>
                <span className={styles.statChip}>{rows.length} containers</span>
                <span className={styles.statChip}>{withCAS} con CAS</span>
                <span className={`${styles.statChip} ${styles.statGreen}`}>{withGHS} con datos GHS</span>
                {warnZone && <span className={`${styles.statChip} ${styles.statWarn}`}><AlertTriangle size={11} /> zonas sin asignar</span>}
              </div>

              <div className={styles.tableScroll}>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      <th>Estructura</th>
                      <th>Nombre</th>
                      <th>CAS</th>
                      <th>Cantidad</th>
                      <th>Zona</th>
                      <th>GHS</th>
                      <th>Proveedor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={r._resolvedZone?.startsWith('⚠') ? styles.rowWarn : ''}>
                        <td className={styles.thumbCell}>
                          {r.cas_number ? (
                            <img
                              src={structureUrl(r.cas_number, '80x60')}
                              alt=""
                              className={styles.thumb}
                              onError={e => { e.target.style.opacity = '0.2'; }}
                            />
                          ) : <span className={styles.noThumb}>—</span>}
                        </td>
                        <td className={styles.nameCell}>{r.name}</td>
                        <td className={styles.casCell}>{r.cas_number || '—'}</td>
                        <td className={styles.sizeCell}>{r.quantity} {r.unit}</td>
                        <td className={r._resolvedZone?.startsWith('⚠') ? styles.warnCell : ''}>
                          {r._resolvedZone}
                        </td>
                        <td className={styles.ghsCell}>
                          {r._ghs?.pictogramUrls?.length > 0
                            ? r._ghs.pictogramUrls.slice(0, 3).map((url, j) => (
                                <img key={j} src={url} alt="GHS" className={styles.ghsPic} />
                              ))
                            : r._ghs
                              ? <span className={styles.noGHS}>{r._ghs.hazardCodes?.length ? r._ghs.hazardCodes.slice(0,3).join(' ') : '—'}</span>
                              : <span className={styles.noGHS}>—</span>
                          }
                        </td>
                        <td>{r.supplier}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {step === STEPS.DONE && importResult && (
            <div className={styles.resultBox}>
              <CheckCircle size={36} className={styles.successIcon} />
              <p className={styles.resultText}>
                <strong>{importResult.created}</strong> container(s) importado(s) correctamente.
              </p>
              {importResult.errors?.length > 0 && (
                <div className={styles.errorList}>
                  <p className={styles.errorTitle}>{importResult.errors.length} error(s):</p>
                  {importResult.errors.map((e, i) => (
                    <p key={i} className={styles.errorItem}>
                      Fila {e.row}{e.name ? ` (${e.name})` : ''}: {e.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {step === STEPS.PREVIEW && (
            <>
              <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
              <button
                className={styles.importBtn}
                onClick={handleImport}
                disabled={loading}
              >
                {loading ? 'Importando…' : `Importar ${rows.length} containers`}
              </button>
            </>
          )}
          {(step === STEPS.UPLOAD || step === STEPS.FETCHING) && (
            <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          )}
          {step === STEPS.DONE && (
            <button className={styles.importBtn} onClick={onClose}>Cerrar</button>
          )}
        </div>
      </div>
    </div>
  );
}
