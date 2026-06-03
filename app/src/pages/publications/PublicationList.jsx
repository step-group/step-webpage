import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import AppLayout from '../../layouts/AppLayout';
import WosImportModal from './WosImportModal';
import styles from './Publications.module.css';

const STATUS_LABEL = { draft: 'Borrador', submitted: 'Enviado', under_review: 'En revisión', published: 'Publicado' };

export default function PublicationList() {
  const [pubs, setPubs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [showWos, setShowWos] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const params = {};
    if (status) params.status = status;
    if (search) params.search = search;
    setLoading(true);
    api.publications.list(params).then(setPubs).finally(() => setLoading(false));
  }, [search, status]);

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
          onImported={() => {
            api.publications.list({}).then(setPubs);
          }}
        />
      )}

      <div className={styles.filters}>
        <input className={styles.searchInput} placeholder="Buscar por título o autores..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.select} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading && <p className={styles.muted}>Cargando...</p>}
      {!loading && pubs.length === 0 && (
        <p className={styles.muted}>No hay publicaciones. <Link to="/app/publications/new">Crea la primera.</Link></p>
      )}

      <div className={styles.list}>
        {pubs.map(p => (
          <div key={p.id} className={styles.card} onClick={() => navigate(`/app/publications/${p.id}`)}>
            <div className={styles.cardTop}>
              <span className={styles.cardTitle}>{p.title}</span>
              <span className={`${styles.statusBadge} ${styles[p.status]}`}>{STATUS_LABEL[p.status]}</span>
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
    </AppLayout>
  );
}
