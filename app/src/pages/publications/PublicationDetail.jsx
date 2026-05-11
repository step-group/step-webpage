import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import AppLayout from '../../layouts/AppLayout';
import styles from './Publications.module.css';

const STATUS_LABEL = { draft: 'Borrador', submitted: 'Enviado', under_review: 'En revisión', published: 'Publicado' };

export default function PublicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pub, setPub]           = useState(null);
  const [available, setAvail]   = useState([]);
  const [linkId, setLinkId]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    Promise.all([api.publications.get(id), api.publications.availableDatasets(id)])
      .then(([p, avail]) => { setPub(p); setAvail(avail); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!confirm('¿Eliminar esta publicación?')) return;
    await api.publications.delete(id);
    navigate('/app/publications');
  }

  async function linkDataset() {
    if (!linkId) return;
    await api.publications.linkDataset(id, Number(linkId));
    const ds = available.find(d => d.id === Number(linkId));
    setPub(p => ({ ...p, datasets: [...p.datasets, ds] }));
    setAvail(a => a.filter(d => d.id !== Number(linkId)));
    setLinkId('');
  }

  async function unlinkDataset(dsId) {
    await api.publications.unlinkDataset(id, dsId);
    const ds = pub.datasets.find(d => d.id === dsId);
    setPub(p => ({ ...p, datasets: p.datasets.filter(d => d.id !== dsId) }));
    setAvail(a => [...a, ds]);
  }

  if (loading) return <AppLayout><p className={styles.muted}>Cargando...</p></AppLayout>;
  if (error || !pub) return <AppLayout><p className={styles.error}>{error || 'No encontrado'}</p></AppLayout>;

  return (
    <AppLayout>
      <div className={styles.detailHeader}>
        <div className={`${styles.statusBadge} ${styles[pub.status]}`} style={{ display: 'inline-block', marginBottom: '0.6rem' }}>
          {STATUS_LABEL[pub.status]}
        </div>
        <h2 className={styles.detailTitle}>{pub.title}</h2>
        <div className={styles.detailMeta}>
          {pub.authors && <span>{pub.authors}</span>}
          {pub.journal && <><span className={styles.dot}>·</span><span>{pub.journal}</span></>}
          {pub.year    && <><span className={styles.dot}>·</span><span>{pub.year}</span></>}
          {pub.doi     && (
            <><span className={styles.dot}>·</span>
            <a className={styles.doiLink} href={`https://doi.org/${pub.doi}`} target="_blank" rel="noreferrer">
              DOI: {pub.doi}
            </a></>
          )}
        </div>
        <div className={styles.detailActions}>
          <Link to={`/app/publications/${id}/edit`} className={styles.btnSecondary}>Editar</Link>
          <button onClick={handleDelete} className={styles.btnDanger}>Eliminar</button>
        </div>
      </div>

      {/* Abstract */}
      {pub.abstract && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Abstract</div>
          <div className={styles.abstract}>{pub.abstract}</div>
        </div>
      )}

      {/* Datasets */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Datasets vinculados ({pub.datasets.length})</div>

        <div className={styles.datasetList}>
          {pub.datasets.map(ds => (
            <div key={ds.id} className={styles.datasetChip}>
              <div className={styles.datasetChipInfo}>
                <span className={styles.datasetChipTitle}>{ds.title}</span>
                <span className={styles.datasetChipMeta}>
                  {ds.experiment_title}
                  {ds.compounds?.filter(Boolean).length > 0 && (
                    <> · {ds.compounds.filter(Boolean).map(c => c.name).join(' + ')}</>
                  )}
                  {' · '}{ds.point_count} puntos
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                <Link
                  to={`/app/experiments/${ds.experiment_id}`}
                  className={styles.btnSecondary}
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                  onClick={e => e.stopPropagation()}
                >
                  Ver experimento
                </Link>
                <button className={styles.btnDanger} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => unlinkDataset(ds.id)}>
                  Desvincular
                </button>
              </div>
            </div>
          ))}
        </div>

        {available.length > 0 && (
          <div className={styles.linkRow}>
            <select value={linkId} onChange={e => setLinkId(e.target.value)}>
              <option value="">Vincular dataset...</option>
              {available.map(d => (
                <option key={d.id} value={d.id}>
                  {d.experiment_title} — {d.title}
                  {d.compounds?.filter(Boolean).length > 0 && ` (${d.compounds.filter(Boolean).map(c => c.name).join(' + ')})`}
                </option>
              ))}
            </select>
            <button className={styles.btnPrimary} onClick={linkDataset} disabled={!linkId}>Vincular</button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
