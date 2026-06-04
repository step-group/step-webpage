import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../layouts/AppLayout';
import ContainerDetail from './ContainerDetail';
import ImportModal from './ImportModal';
import styles from './Resources.module.css';
import {
  ChevronRight, Info, Trash2,
  Download, List, LayoutGrid, Folder, FileUp, Package,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildFlatMap(nodes, map = {}) {
  for (const n of nodes) {
    map[n.id] = n;
    if (n.children?.length) buildFlatMap(n.children, map);
  }
  return map;
}

function getPathLabel(locId, flatMap) {
  const parts = [];
  let cur = flatMap[locId];
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.parent_id ? flatMap[cur.parent_id] : null;
  }
  return parts.slice(-2).join(' > ');
}

function findFirstLeaf(nodes) {
  for (const n of nodes) {
    if (n.children?.length) {
      const leaf = findFirstLeaf(n.children);
      if (leaf) return leaf;
    } else {
      return n;
    }
  }
  return null;
}

// ── Location tree node ─────────────────────────────────────────────────────────

function LocationNode({ node, selected, onSelect, depth }) {
  const hasChildren = node.children?.length > 0;
  const isSelected  = selected === node.id;
  const [open, setOpen] = useState(depth < 2);

  return (
    <div>
      <div
        className={`${styles.locNode} ${isSelected ? styles.locSelected : ''}`}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={() => { if (hasChildren) setOpen(o => !o); onSelect(node.id); }}
      >
        <ChevronRight
          size={11}
          className={`${styles.locArrow} ${hasChildren && open ? styles.locArrowOpen : ''}`}
        />
        <span className={styles.locLabel}>{node.name}</span>
      </div>
      {hasChildren && open && node.children.map(child => (
        <LocationNode
          key={child.id}
          node={child}
          selected={selected}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ResourceList() {
  const [locations,   setLocations]   = useState([]);
  const [containers,  setContainers]  = useState([]);
  const [selectedLoc,  setSelectedLoc]  = useState(null);
  const [search,       setSearch]       = useState('');
  const [loading,      setLoading]      = useState(true);
  const [viewMode,     setViewMode]     = useState('table');
  const [checked,      setChecked]      = useState(new Set());
  const [detailId,     setDetailId]     = useState(null);
  const [showImport,   setShowImport]   = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }
  const navigate = useNavigate();

  function askConfirm(message, onConfirm) {
    setConfirmDialog({ message, onConfirm });
  }

  useEffect(() => {
    Promise.all([api.locations.list(), api.resources.list({})])
      .then(([locs, res]) => {
        setLocations(locs);
        setContainers(res);
        const first = findFirstLeaf(locs);
        if (first) setSelectedLoc(first.id);
      })
      .finally(() => setLoading(false));
  }, []);

  const flatMap = buildFlatMap(locations);

  const q = search.trim().toLowerCase();
  const visible = containers
    .filter(c => !selectedLoc || c.location_id === selectedLoc)
    .filter(c => !q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.cas_number || '').toLowerCase().includes(q) ||
      (c.supplier || '').toLowerCase().includes(q)
    );

  function toggleOne(id) {
    setChecked(s => { const ns = new Set(s); ns.has(id) ? ns.delete(id) : ns.add(id); return ns; });
  }

  function toggleAll() {
    setChecked(s => s.size === visible.length ? new Set() : new Set(visible.map(c => c.id)));
  }

  function deleteOne(id, e) {
    e.stopPropagation();
    askConfirm('¿Eliminar este container?', async () => {
      await api.resources.archive(id, 'archived');
      setContainers(c => c.filter(x => x.id !== id));
      setChecked(s => { const ns = new Set(s); ns.delete(id); return ns; });
    });
  }

  function deleteAll() {
    if (!checked.size) return;
    askConfirm(`¿Eliminar ${checked.size} container(s) seleccionado(s)?`, async () => {
      await Promise.all([...checked].map(id => api.resources.archive(id, 'archived')));
      setContainers(c => c.filter(x => !checked.has(x.id)));
      setChecked(new Set());
    });
  }

  function downloadCSV() {
    const header = 'Container Name,Size,Location\n';
    const rows = visible.map(c =>
      `"${c.name}","${c.quantity} ${c.unit}","${c.location_id ? getPathLabel(c.location_id, flatMap) : c.location || ''}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: 'containers.csv',
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <AppLayout>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <Package size={20} className={styles.pageHeaderIcon} />
          <h1 className={styles.pageTitle}>Inventario</h1>
        </div>
        <Link to="/app/dashboard" className={styles.backLink}>← Inicio</Link>
      </div>

      <div className={styles.inventoryBody}>
      {/* ── Locations Panel ─────────────────────────────────── */}
      <div className={styles.locPanel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Locations</span>
        </div>
        <div className={styles.locTree}>
          {locations.map(root => (
            <div key={root.id}>
              <div className={styles.locFolder}>
                <Folder size={13} className={styles.folderIcon} />
                <span>{root.name}</span>
              </div>
              {root.children?.map(child => (
                <LocationNode
                  key={child.id}
                  node={child}
                  selected={selectedLoc}
                  onSelect={setSelectedLoc}
                  depth={1}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Containers Panel ────────────────────────────────── */}
      <div className={styles.containersPanel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Containers</span>
          <div className={styles.panelActions}>
            <button className={styles.importBtn} onClick={() => setShowImport(true)}>
              <FileUp size={13} /> Import
            </button>
            <button
              className={styles.deleteAllBtn}
              onClick={deleteAll}
              disabled={!checked.size}
            >
              <Trash2 size={13} /> Delete All
            </button>
          </div>
        </div>

        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Buscar por nombre, CAS o proveedor..."
            value={search}
            onChange={e => { setSearch(e.target.value); setChecked(new Set()); }}
          />
        </div>

        <div className={styles.containersMeta}>
          <span className={styles.countText}>
            {visible.length} container{visible.length !== 1 ? 's' : ''}{search ? ` para "${search}"` : ''}
          </span>
          <div className={styles.viewControls}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewActive : ''}`}
              onClick={() => setViewMode('table')}
            >
              <List size={13} /> Table view
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewActive : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={13} /> Grid view
            </button>
            <button className={styles.downloadBtn} onClick={downloadCSV}>
              <Download size={13} /> Download Results
            </button>
          </div>
        </div>

        {viewMode === 'table' && (
          <div className={styles.cTable}>
            <div className={styles.cTableHead}>
              <span className={styles.colCheck}>
                <input
                  type="checkbox"
                  checked={checked.size > 0 && checked.size === visible.length}
                  onChange={toggleAll}
                />
              </span>
              <span className={styles.colName}>Container Name</span>
              <span className={styles.colSize}>Size</span>
              <span className={styles.colLocCol}>Location</span>
              <span className={styles.colAct}>Actions</span>
            </div>

            {loading && <div className={styles.emptyRow}>Loading...</div>}
            {!loading && visible.length === 0 && (
              <div className={styles.emptyRow}>No containers in this location.</div>
            )}

            {visible.map(c => (
              <div
                key={c.id}
                className={`${styles.cTableRow} ${checked.has(c.id) ? styles.rowChecked : ''}`}
              >
                <span className={styles.colCheck}>
                  <input
                    type="checkbox"
                    checked={checked.has(c.id)}
                    onChange={() => toggleOne(c.id)}
                    onClick={e => e.stopPropagation()}
                  />
                </span>
                <span
                  className={styles.containerName}
                  onClick={() => setDetailId(c.id)}
                >
                  {c.name}
                </span>
                <span className={styles.colSize}>{c.quantity} {c.unit}</span>
                <span className={styles.colLocCol}>
                  {c.location_id
                    ? getPathLabel(c.location_id, flatMap)
                    : c.location || '—'}
                </span>
                <span className={styles.colAct}>
                  <button
                    className={styles.actBtn}
                    title="Ver detalle"
                    onClick={() => setDetailId(c.id)}
                  >
                    <Info size={13} />
                  </button>
                  <button
                    className={`${styles.actBtn} ${styles.actDanger}`}
                    title="Eliminar"
                    onClick={e => deleteOne(c.id, e)}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'grid' && (
          <div className={styles.cGrid}>
            {!loading && visible.length === 0 && (
              <p className={styles.emptyRow}>No containers in this location.</p>
            )}
            {visible.map(c => (
              <div
                key={c.id}
                className={styles.cCard}
                onClick={() => setDetailId(c.id)}
              >
                <div className={styles.cCardName}>{c.name}</div>
                <div className={styles.cCardDetail}>{c.quantity} {c.unit}</div>
                <div className={styles.cCardLoc}>
                  {c.location_id
                    ? getPathLabel(c.location_id, flatMap)
                    : c.location || '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detailId && (
        <ContainerDetail
          containerId={detailId}
          onClose={() => setDetailId(null)}
          onUpdated={() => api.resources.list({}).then(setContainers)}
        />
      )}

      {showImport && (
        <ImportModal
          locations={locations}
          onClose={() => setShowImport(false)}
          onImported={() => api.resources.list({}).then(setContainers)}
        />
      )}
      </div>

      {confirmDialog && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmDialog(null)}>
          <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}><Trash2 size={20} /></div>
            <p className={styles.confirmMsg}>{confirmDialog.message}</p>
            <div className={styles.confirmActions}>
              <button
                className={styles.confirmCancel}
                onClick={() => setConfirmDialog(null)}
              >
                Cancelar
              </button>
              <button
                className={styles.confirmDelete}
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
