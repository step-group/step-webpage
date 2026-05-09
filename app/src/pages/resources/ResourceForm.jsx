import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import AppLayout from '../../layouts/AppLayout';
import styles from './Resources.module.css';

export default function ResourceForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', category_id: '', quantity: '', unit: '',
    location: '', cas_number: '', notes: '', min_quantity: '',
  });
  const [categories, setCategories] = useState([]);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    api.resources.categories.list().then(setCategories);
    if (isEdit) {
      api.resources.get(id).then(r => setForm({
        name:         r.name,
        category_id:  r.category_id ?? '',
        quantity:     r.quantity ?? '',
        unit:         r.unit ?? '',
        location:     r.location ?? '',
        cas_number:   r.cas_number ?? '',
        notes:        r.notes ?? '',
        min_quantity: r.min_quantity ?? '',
      }));
    }
  }, [id, isEdit]);

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('El nombre es requerido');
    setLoading(true);
    try {
      const payload = {
        ...form,
        category_id:  form.category_id  || null,
        quantity:     form.quantity      !== '' ? Number(form.quantity)     : 0,
        min_quantity: form.min_quantity  !== '' ? Number(form.min_quantity) : null,
      };
      if (isEdit) {
        await api.resources.update(id, payload);
      } else {
        await api.resources.create(payload);
      }
      navigate('/app/resources');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{isEdit ? 'Editar ítem' : 'Nuevo ítem de inventario'}</h2>
        <Link to="/app/resources" className={styles.btnSecondary}>Cancelar</Link>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <p className={styles.error}>{error}</p>}

        <label>
          Nombre *
          <input value={form.name} onChange={set('name')} required autoFocus />
        </label>

        <label>
          Categoría
          <select value={form.category_id} onChange={set('category_id')}>
            <option value="">Sin categoría</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <div className={styles.formRow}>
          <label>
            Cantidad
            <input type="number" min="0" step="any" value={form.quantity} onChange={set('quantity')} placeholder="0" />
          </label>
          <label>
            Unidad
            <input value={form.unit} onChange={set('unit')} placeholder="mL, g, unidades..." />
          </label>
          <label>
            Cantidad mínima (alerta)
            <input type="number" min="0" step="any" value={form.min_quantity} onChange={set('min_quantity')} placeholder="Opcional" />
          </label>
        </div>

        <label>
          Ubicación
          <input value={form.location} onChange={set('location')} placeholder="Ej: Estante A, Nevera 2..." />
        </label>

        <label>
          Número CAS (químicos)
          <input value={form.cas_number} onChange={set('cas_number')} placeholder="Ej: 64-17-5" />
        </label>

        <label>
          Notas
          <textarea value={form.notes} onChange={set('notes')} placeholder="Observaciones, condiciones de almacenamiento..." />
        </label>

        <div className={styles.formActions}>
          <button type="submit" disabled={loading} className={styles.btnPrimary}>
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear ítem'}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}
