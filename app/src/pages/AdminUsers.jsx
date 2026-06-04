import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import AppLayout from '../layouts/AppLayout';
import styles from './AdminUsers.module.css';

const STATUS_LABEL = { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' };
const STATUS_CLASS  = { pending: 'pending',  approved: 'approved',  rejected: 'rejected' };

export default function AdminUsers() {
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [rowError, setRowError] = useState('');

  useEffect(() => {
    api.admin.users()
      .then(setUsers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id, status) {
    try {
      const updated = await api.admin.setStatus(id, status);
      setUsers(u => u.map(x => x.id === updated.id ? updated : x));
    } catch (err) {
      setRowError(err.message);
    }
  }

  async function updateRole(id, role) {
    try {
      const updated = await api.admin.setRole(id, role);
      setUsers(u => u.map(x => x.id === updated.id ? updated : x));
    } catch (err) {
      setRowError(err.message);
    }
  }

  return (
    <AppLayout>
      <div className={styles.pageHeader}>
        <h2>Gestión de usuarios</h2>
      </div>

      {loading && <p className={styles.muted}>Cargando...</p>}
      {error    && <p className={styles.error}>{error}</p>}
      {rowError && <p className={styles.error}>{rowError}</p>}

      {!loading && !error && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Estado</th>
                <th>Rol</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[STATUS_CLASS[u.status]]}`}>
                      {STATUS_LABEL[u.status]}
                    </span>
                  </td>
                  <td>
                    <select
                      value={u.role}
                      onChange={e => updateRole(u.id, e.target.value)}
                      className={styles.select}
                    >
                      <option value="member">Miembro</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className={styles.actions}>
                    <Link to={`/app/admin/users/${u.id}`} className={styles.btnView}>
                      Ver actividad
                    </Link>
                    {u.status !== 'approved' && (
                      <button className={styles.btnApprove} onClick={() => updateStatus(u.id, 'approved')}>
                        Aprobar
                      </button>
                    )}
                    {u.status !== 'rejected' && (
                      <button className={styles.btnReject} onClick={() => updateStatus(u.id, 'rejected')}>
                        Rechazar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
