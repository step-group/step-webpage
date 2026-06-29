import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import styles from './WosImportModal.module.css';

export default function WosImportModal({ onClose, onImported }) {
  const [hits, setHits]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [results, setResults]   = useState([]);

  useEffect(() => {
    api.publications.wosSearch()
      .then(data => { setHits(data); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function toggle(uid) {
    setSelected(s => {
      const next = new Set(s);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  }

  function toggleAll() {
    const available = hits.filter(h => !h.already_imported);
    if (selected.size === available.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(available.map(h => h.uid)));
    }
  }

  async function importSelected() {
    const toImport = hits.filter(h => selected.has(h.uid));
    setImporting(true);
    const res = [];
    for (const h of toImport) {
      try {
        const pub = await api.publications.wosImport({
          title: h.title, authors: h.authors,
          journal: h.journal, year: h.year, doi: h.doi,
        });
        res.push({ uid: h.uid, ok: true, id: pub.id });
        setHits(prev => prev.map(x => x.uid === h.uid ? { ...x, already_imported: true } : x));
        setSelected(s => { const n = new Set(s); n.delete(h.uid); return n; });
      } catch (err) {
        res.push({ uid: h.uid, ok: false, error: err.message });
      }
    }
    setResults(res);
    setImporting(false);
    onImported();
  }

  const available = hits.filter(h => !h.already_imported);
  const allSelected = available.length > 0 && selected.size === available.length;

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Importar desde Web of Science</h3>
            <p className={styles.modalSub}>Canales, Roberto · Gajardo-Parra, Nicolas · Cea-Klapp, Esteban</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading && <p className={styles.muted}>Consultando WOS...</p>}
        {error   && (
          <div className={styles.errorBox}>
            <strong>Error:</strong> {error}
            {error.includes('API_KEY') && (
              <p className={styles.errorHint}>Agrega <code>WOS_API_KEY=tu_clave</code> al archivo <code>.env</code> de la API y reinicia el servidor.</p>
            )}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className={styles.toolbar}>
              <span className={styles.count}>
                {hits.length} publicaciones encontradas · {hits.filter(h => h.already_imported).length} ya importadas
              </span>
              {available.length > 0 && (
                <label className={styles.selectAll}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  Seleccionar todas ({available.length})
                </label>
              )}
            </div>

            <div className={styles.list}>
              {hits.map(h => {
                const imported = h.already_imported;
                const checked  = selected.has(h.uid);
                const result   = results.find(r => r.uid === h.uid);
                return (
                  <label
                    key={h.uid}
                    className={`${styles.item} ${imported ? styles.itemDone : ''} ${result?.ok ? styles.itemJustImported : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={imported}
                      onChange={() => toggle(h.uid)}
                      className={styles.checkbox}
                    />
                    <div className={styles.itemBody}>
                      <span className={styles.itemTitle}>{h.title}</span>
                      <span className={styles.itemMeta}>
                        {h.authors && <span>{h.authors}</span>}
                        {h.journal && <><span className={styles.dot}>·</span><em>{h.journal}</em></>}
                        {h.year    && <><span className={styles.dot}>·</span><span>{h.year}</span></>}
                        {h.doi     && <><span className={styles.dot}>·</span><span className={styles.doi}>DOI: {h.doi}</span></>}
                      </span>
                      {result && !result.ok && <span className={styles.importError}>{result.error}</span>}
                    </div>
                    {imported && <span className={styles.badge}>Ya importada</span>}
                    {result?.ok && <span className={styles.badgeOk}>Importada ✓</span>}
                  </label>
                );
              })}
            </div>

            <div className={styles.footer}>
              <span className={styles.muted}>{selected.size} seleccionadas</span>
              <div className={styles.footerActions}>
                <button className={styles.btnSecondary} onClick={onClose}>Cerrar</button>
                <button
                  className={styles.btnPrimary}
                  onClick={importSelected}
                  disabled={selected.size === 0 || importing}
                >
                  {importing ? 'Importando...' : `Importar ${selected.size > 0 ? selected.size : ''}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
