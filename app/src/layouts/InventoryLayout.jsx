import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Search, Plus, ShoppingCart, MapPin, FileText,
  Settings, LogOut, ChevronRight, ExternalLink,
} from 'lucide-react';
import styles from './InventoryLayout.module.css';

export default function InventoryLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [orderOpen, setOrderOpen]   = useState(false);
  const [adminOpen, setAdminOpen]   = useState(false);
  const [searchVal, setSearchVal]   = useState('');

  function handleLogout() {
    logout();
    navigate('/app/login');
  }

  const isLocations = location.pathname.startsWith('/app/resources');

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        {/* Search */}
        <div className={styles.searchWrap}>
          <Search size={13} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search"
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
          />
        </div>

        <nav className={styles.nav}>
          {/* Add a Container */}
          <Link to="/app/resources/new" className={styles.navAdd}>
            <Plus size={14} />
            Add a Container
          </Link>

          {/* Order Requests */}
          <button
            className={styles.navItem}
            onClick={() => setOrderOpen(o => !o)}
          >
            <ShoppingCart size={14} />
            <span>Order Requests</span>
            <ChevronRight
              size={12}
              className={`${styles.chevron} ${orderOpen ? styles.chevronOpen : ''}`}
            />
          </button>
          {orderOpen && (
            <div className={styles.subMenu}>
              <span className={styles.subMenuEmpty}>No pending orders</span>
            </div>
          )}

          {/* Locations */}
          <Link
            to="/app/resources"
            className={`${styles.navItem} ${isLocations ? styles.navActive : ''}`}
          >
            <MapPin size={14} />
            <span>Locations</span>
          </Link>

          {/* SDS and File Storage */}
          <button className={styles.navItem}>
            <FileText size={14} />
            <span>SDS and File Storage</span>
          </button>

          {/* Administration */}
          <button
            className={styles.navItem}
            onClick={() => setAdminOpen(o => !o)}
          >
            <Settings size={14} />
            <span>Administration</span>
            <ChevronRight
              size={12}
              className={`${styles.chevron} ${adminOpen ? styles.chevronOpen : ''}`}
            />
          </button>
          {adminOpen && user?.role === 'admin' && (
            <div className={styles.subMenu}>
              <Link to="/app/admin/users" className={styles.subMenuItem}>
                Users
              </Link>
            </div>
          )}
        </nav>

        <div className={styles.footer}>
          <p className={styles.signedIn}>
            Signed in as <strong>{user?.name}</strong>
          </p>
          <a
            href="https://cheminventory.net/support"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.supportLink}
          >
            ChemInventory support <ExternalLink size={10} />
          </a>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <LogOut size={12} /> Logout
          </button>
        </div>
      </aside>

      <div className={styles.content}>{children}</div>
    </div>
  );
}
