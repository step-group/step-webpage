import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import AppLayout from '../../layouts/AppLayout';
import styles from './Publications.module.css';

const STATUS_OPTIONS = [
  { value: 'draft',        label: 'Borrador' },
  { value: 'submitted',    label: 'Enviado' },
  { value: 'under_review', label: 'En revisión' },
  { value: 'published',    label: 'Publicado' },
];

export default function PublicationForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '', authors: '', journal: '', year: '',
    doi: '', abstract: '', status: 'draft',
  });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit) {
      api.publications.get(id).then(p => setForm({
        title:    p.title,
        authors:  p.authors || '',
        journal:  p.journal || '',
        year:     p.year    || '',
        doi:      p.doi     || '',
        abstract: p.abstract || '',
        status:   p.status,
      }));
    }
  }, [id, isEdit]);

  function set(f) { return e => setForm(p => ({ ...p, [f]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('El título es requerido');
    setLoading(true);
    try {
      const payload = { ...form, year: form.year ? Number(form.year) : null };
      if (isEdit) {
        await api.publications.update(id, payload);
        navigate(`/app/publications/${id}`);
      } else {
        const pub = await api.publications.create(payload);
        navigate(`/app/publications/${pub.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
          {isEdit ? 'Editar publicación' : 'Nueva publicación'}
        </h2>
        <Link to={isEdit ? `/app/publications/${id}` : '/app/publications'} className={styles.btnSecondary}>
          Cancelar
        </Link>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <p className={styles.error}>{error}</p>}

        <label>
          Título *
          <input value={form.title} onChange={set('title')} required autoFocus />
        </label>

        <label>
          Autores
          <input value={form.authors} onChange={set('authors')} placeholder="Apellido, N.; Apellido, N.; ..." />
        </label>

        <div className={styles.formRow}>
          <label>
            Revista / Conferencia
            <input value={form.journal} onChange={set('journal')} placeholder="J. Chem. Eng. Data" />
          </label>
          <label>
            Año
            <input value={form.year} onChange={set('year')} type="number" min="1900" max="2100" placeholder="2026" />
          </label>
          <label>
            Estado
            <select value={form.status} onChange={set('status')}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <label>
          DOI
          <input value={form.doi} onChange={set('doi')} placeholder="10.1021/xxxxxxxx" />
        </label>

        <label>
          Abstract
          <textarea value={form.abstract} onChange={set('abstract')} rows={5}
            placeholder="Resumen de la publicación..." />
        </label>

        <div className={styles.formActions}>
          <button type="submit" disabled={loading} className={styles.btnPrimary}>
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear publicación'}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}
