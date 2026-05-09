import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './AppLayout.module.css';

const NAV = [
  { to: '/app/dashboard',   label: 'Inicio',       icon: '⌂' },
  { to: '/app/experiments', label: 'Experimentos',  icon: '🧪' },
  { to: '/app/templates',   label: 'Plantillas',    icon: '📄' },
  { to: '/app/resources',   label: 'Inventario',    icon: '📦' },
];

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/app/login');
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <a href="/" className={styles.brand}>STEP Lab</a>
        <nav className={styles.nav}>
          {NAV.map(({ to, label, icon }) => (
            <Link
              key={to}
              to={to}
              className={`${styles.navLink} ${location.pathname.startsWith(to) && to !== '/app/dashboard' ? styles.active : location.pathname === to ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          {user?.role === 'admin' && (
            <Link to="/app/admin/users" className={styles.navLink}>
              <span className={styles.navIcon}>👥</span>
              Usuarios
            </Link>
          )}
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.name}</span>
            <button onClick={handleLogout} className={styles.logoutBtn}>Salir</button>
          </div>
        </div>
      </aside>
      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
}
