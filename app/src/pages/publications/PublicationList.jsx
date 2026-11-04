import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../layouts/AppLayout';
import ConfirmModal from '../../components/ConfirmModal';
import WosImportModal from './WosImportModal';
import { Trash2 } from 'lucide-react';
import styles from './Publications.module.css';

const STATUS_LABEL = { draft: 'Borrador', submitted: 'Enviado', under_review: 'En revisión', published: 'Publicado' };

export default function PublicationList() {
  const [pubs, setPubs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [sortOrder, setSort]  = useState('desc');
  const [showWos, setShowWos] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [pendingDelete, setPendingDelete] = useState(null); // { ids, label }
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const canDelete = user?.role === 'admin';

  function toggle(id, e) {
    e.stopPropagation();
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function confirmDelete() {
    const { ids } = pendingDelete;
    setPendingDelete(null);
    setError('');
    try {
      for (const id of ids) await api.publications.delete(id);
      setPubs(list => list.filter(x => !ids.includes(x.id)));
      setSelected(s => { const n = new Set(s); ids.forEach(i => n.delete(i)); return n; });
    } catch (err) {
      setError(err.message);
      api.publications.list({}).then(setPubs);
    }
  }

  useEffect(() => {
    const params = {};
    if (status) params.status = status;
    if (search) params.search = search;
    setLoading(true);
    api.publications.list(params).then(setPubs).finally(() => setLoading(false));
    setSelected(new Set());
  }, [search, status]);

  const sorted = [...pubs].sort((a, b) =>
    sortOrder === 'desc' ? (b.year || 0) - (a.year || 0) : (a.year || 0) - (b.year || 0)
  );

  return (
    <AppLayout>
      <div className={styles.pageHeader}>
        <h2>Publicaciones</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={styles.btnSecondary} onClick={() => setShowWos(true)}>
            Importar WOS
          </button>
          <Link to="/app/publications/new" className={styles.btnPrimary}>+ Nueva</Link>
        </div>
      </div>

      {showWos && (
        <WosImportModal
          onClose={() => setShowWos(false)}
          onImported={() => api.publications.list({}).then(setPubs)}
        />
      )}

      <div className={styles.filters}>
        <input className={styles.searchInput} placeholder="Buscar por título o autores..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.select} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button
          className={styles.sortBtn}
          onClick={() => setSort(s => s === 'desc' ? 'asc' : 'desc')}
          title="Ordenar por año"
        >
          Año {sortOrder === 'desc' ? '↓' : '↑'}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {canDelete && selected.size > 0 && (
        <div className={styles.bulkBar}>
          <span>
            {selected.size === 1
              ? '1 publicación seleccionada'
              : `${selected.size} publicaciones seleccionadas`}
          </span>
          <button className={styles.bulkClear} onClick={() => setSelected(new Set())}>
            Quitar selección
          </button>
          <button
            className={styles.bulkDelete}
            onClick={() => setPendingDelete({
              ids: [...selected],
              label: `las ${selected.size} publicaciones seleccionadas`,
            })}
          >
            <Trash2 size={13} /> Eliminar seleccionadas
          </button>
        </div>
      )}

      {loading && <p className={styles.muted}>Cargando...</p>}
      {!loading && sorted.length === 0 && (
        <p className={styles.muted}>No hay publicaciones. <Link to="/app/publications/new">Crea la primera.</Link></p>
      )}

      <div className={styles.list}>
        {sorted.map(p => (
          <div key={p.id} className={styles.card} onClick={() => navigate(`/app/publications/${p.id}`)}>
            <div className={styles.cardTop}>
              {canDelete && (
                <input
                  type="checkbox"
                  className={styles.cardCheck}
                  checked={selected.has(p.id)}
                  onClick={e => toggle(p.id, e)}
                  onChange={() => {}}
                  aria-label={`Seleccionar ${p.title}`}
                />
              )}
              <span className={styles.cardTitle}>{p.title}</span>
              <span className={`${styles.statusBadge} ${styles[p.status]}`}>{STATUS_LABEL[p.status]}</span>
              {canDelete && (
                <button
                  className={styles.cardDelete}
                  title="Eliminar publicación"
                  onClick={e => {
                    e.stopPropagation();
                    setPendingDelete({ ids: [p.id], label: `"${p.title}"` });
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className={styles.cardMeta}>
              {p.authors && <span>{p.authors}</span>}
              {p.authors && (p.journal || p.year) && <span className={styles.dot}>·</span>}
              {p.journal && <span>{p.journal}</span>}
              {p.year    && <span>{p.year}</span>}
              {Number(p.dataset_count) > 0 && (
                <><span className={styles.dot}>·</span><span>{p.dataset_count} dataset{p.dataset_count > 1 ? 's' : ''}</span></>
              )}
            </div>
          </div>
        ))}
      </div>

      {pendingDelete && (
        <ConfirmModal
          danger
          confirmLabel="Eliminar"
          message={`¿Eliminar ${pendingDelete.label}? Esta acción no se puede deshacer. Los datasets asociados no se borran, pero perderán su vínculo con la publicación.`}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </AppLayout>
  );
}
