import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, FlaskConical, FileText, Package, Users, LogOut, Settings } from 'lucide-react';
import { api } from '../api/client';
import styles from './AppLayout.module.css';

const NAV = [
  { to: '/app/dashboard',   label: 'Inicio',       Icon: Home },
  { to: '/app/experiments', label: 'Experimentos',  Icon: FlaskConical },
  { to: '/app/templates',   label: 'Plantillas',    Icon: FileText },
  { to: '/app/resources',   label: 'Inventario',    Icon: Package },
];

function Initials({ name }) {
  const parts = (name || '?').trim().split(' ');
  const letters = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : parts[0].slice(0, 2);
  return <span className={styles.avatar}>{letters.toUpperCase()}</span>;
}

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (user?.role === 'admin') {
      api.admin.pendingCount().then(r => setPending(r.count)).catch(() => {});
    }
  }, [user]);

  function isActive(to) {
    if (to === '/app/dashboard') return location.pathname === to;
    return location.pathname.startsWith(to);
  }

  function handleLogout() {
    logout();
    navigate('/app/login');
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link to="/app/dashboard" className={styles.brand}>
          <span className={styles.brandDot} />
          STEP Lab
        </Link>

        <div className={styles.navSection}>
          <span className={styles.navLabel}>Navegación</span>
          <nav className={styles.nav}>
            {NAV.map(({ to, label, Icon }) => (
              <Link
                key={to}
                to={to}
                className={`${styles.navLink} ${isActive(to) ? styles.active : ''}`}
              >
                <Icon size={16} strokeWidth={2} />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {user?.role === 'admin' && (
          <div className={styles.navSection}>
            <span className={styles.navLabel}>Admin</span>
            <nav className={styles.nav}>
              <Link
                to="/app/admin/users"
                className={`${styles.navLink} ${isActive('/app/admin') ? styles.active : ''}`}
              >
                <Users size={16} strokeWidth={2} />
                Usuarios
                {pending > 0 && <span className={styles.badge}>{pending}</span>}
              </Link>
            </nav>
          </div>
        )}

        <div className={styles.userRow}>
          <Initials name={user?.name} />
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.name}</span>
            <span className={styles.userRole}>{user?.role === 'admin' ? 'Administrador' : 'Miembro'}</span>
          </div>
          <Link to="/app/profile" className={styles.iconBtn} title="Perfil">
            <Settings size={14} strokeWidth={2} />
          </Link>
          <button onClick={handleLogout} className={styles.iconBtn} title="Cerrar sesión">
            <LogOut size={14} strokeWidth={2} />
          </button>
        </div>
      </aside>

      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
}
