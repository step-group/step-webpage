import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../layouts/AppLayout';
import styles from './Resources.module.css';

export default function ResourceList() {
  const [resources, setResources]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [catFilter, setCat]         = useState('');
  const [lowStock, setLowStock]     = useState(false);
  const [newCat, setNewCat]         = useState({ name: '', color: '#2c3e8c', show: false });
  const { user } = useAuth();
  const navigate = useNavigate();

  function load() {
    const params = {};
    if (catFilter)    params.category_id = catFilter;
    if (search)       params.search = search;
    if (lowStock)     params.low_stock = 'true';
    setLoading(true);
    Promise.all([
      api.resources.list(params),
      api.resources.categories.list(),
    ]).then(([res, cats]) => {
      setResources(res);
      setCategories(cats);
    }).finally(() => setLoading(false));
  }

  useEffect(load, [search, catFilter, lowStock]);

  async function archive(id, e) {
    e.stopPropagation();
    if (!confirm('¿Archivar este recurso?')) return;
    await api.resources.archive(id, 'archived');
    setResources(r => r.filter(x => x.id !== id));
  }

  async function createCategory() {
    if (!newCat.name.trim()) return;
    const cat = await api.resources.categories.create({ name: newCat.name.trim(), color: newCat.color });
    setCategories(c => [...c, cat]);
    setNewCat({ name: '', color: '#2c3e8c', show: false });
  }

  // Group by category
  const grouped = resources.reduce((acc, r) => {
    const key = r.category_name || 'Sin categoría';
    if (!acc[key]) acc[key] = { color: r.category_color || '#6c757d', items: [] };
    acc[key].items.push(r);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className={styles.pageHeader}>
        <h2>Inventario</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {user?.role === 'admin' && (
            <button className={styles.btnSecondary} onClick={() => setNewCat(c => ({ ...c, show: !c.show }))}>
              + Categoría
            </button>
          )}
          <Link to="/app/resources/new" className={styles.btnPrimary}>+ Nuevo ítem</Link>
        </div>
      </div>

      {newCat.show && (
        <div className={styles.inlineForm}>
          <input
            className={styles.inlineInput}
            placeholder="Nombre de categoría"
            value={newCat.name}
            onChange={e => setNewCat(c => ({ ...c, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && createCategory()}
          />
          <input
            type="color"
            value={newCat.color}
            onChange={e => setNewCat(c => ({ ...c, color: e.target.value }))}
            style={{ width: '2.5rem', height: '2rem', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer' }}
          />
          <button className={styles.btnPrimary} onClick={createCategory}>Crear</button>
        </div>
      )}

      <div className={styles.filters}>
        <input
          className={styles.searchInput}
          placeholder="Buscar por nombre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className={styles.select} value={catFilter} onChange={e => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className={styles.checkLabel}>
          <input type="checkbox" checked={lowStock} onChange={e => setLowStock(e.target.checked)} />
          Stock bajo
        </label>
      </div>

      {loading && <p className={styles.muted}>Cargando...</p>}

      {!loading && resources.length === 0 && (
        <p className={styles.muted}>No hay ítems. <Link to="/app/resources/new">Agrega el primero.</Link></p>
      )}

      {!loading && Object.entries(grouped).map(([catName, { color, items }]) => (
        <div key={catName} className={styles.group}>
          <div className={styles.groupHeader}>
            <span className={styles.groupDot} style={{ background: color }} />
            <span className={styles.groupName}>{catName}</span>
            <span className={styles.groupCount}>{items.length} ítems</span>
          </div>
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span>Nombre</span>
              <span>Cantidad</span>
              <span>Ubicación</span>
              <span>N° CAS</span>
              <span></span>
            </div>
            {items.map(r => {
              const isLow = r.min_quantity != null && Number(r.quantity) <= Number(r.min_quantity);
              return (
                <div key={r.id} className={`${styles.tableRow} ${isLow ? styles.lowStock : ''}`}
                     onClick={() => navigate(`/app/resources/${r.id}/edit`)}>
                  <span className={styles.resourceName}>
                    {r.name}
                    {isLow && <span className={styles.lowBadge}>Stock bajo</span>}
                  </span>
                  <span>{r.quantity} {r.unit}</span>
                  <span className={styles.muted}>{r.location || '—'}</span>
                  <span className={styles.muted}>{r.cas_number || '—'}</span>
                  <span className={styles.rowActions} onClick={e => e.stopPropagation()}>
                    <Link to={`/app/resources/${r.id}/edit`} className={styles.btnSecondary}>Editar</Link>
                    {user?.role === 'admin' && (
                      <button className={styles.btnDanger} onClick={(e) => archive(r.id, e)}>Archivar</button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </AppLayout>
  );
}
