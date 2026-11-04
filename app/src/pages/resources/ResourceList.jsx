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
  MoreHorizontal, Plus, Check, X,
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

function LocRowActions({ node, manage }) {
  const [open, setOpen] = useState(false);
  if (!manage) return null;

  return (
    <span className={styles.locActions} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        className={styles.locMenuBtn}
        onClick={() => setOpen(o => !o)}
        title="Opciones de ubicación"
      >
        <MoreHorizontal size={13} />
      </button>
      {open && (
        <>
          <div className={styles.locMenuScrim} onClick={() => setOpen(false)} />
          <div className={styles.locMenu}>
            <button type="button" onClick={() => { setOpen(false); manage.onAdd(node); }}>
              Añadir sub-ubicación
            </button>
            <button type="button" onClick={() => { setOpen(false); manage.onRename(node); }}>
              Renombrar
            </button>
            <button
              type="button"
              className={styles.locMenuDanger}
              onClick={() => { setOpen(false); manage.onDelete(node); }}
            >
              Eliminar
            </button>
          </div>
        </>
      )}
    </span>
  );
}

function LocInlineInput({ value, placeholder, onSubmit, onCancel, depth }) {
  const [draft, setDraft] = useState(value || '');
  return (
    <form
      className={styles.locInlineForm}
      style={{ paddingLeft: `${12 + depth * 14}px` }}
      onSubmit={e => { e.preventDefault(); if (draft.trim()) onSubmit(draft.trim()); }}
    >
      <input
        className={styles.locInput}
        value={draft}
        placeholder={placeholder}
        autoFocus
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
      />
      <button type="submit" className={styles.locOk} title="Guardar"><Check size={12} /></button>
      <button type="button" className={styles.locCancel} onClick={onCancel} title="Cancelar">
        <X size={12} />
      </button>
    </form>
  );
}

function LocationNode({ node, selected, onSelect, depth, manage }) {
  const hasChildren = node.children?.length > 0;
  const isSelected  = selected === node.id;
  const [open, setOpen] = useState(depth < 2);

  const renaming = manage?.editing === node.id;
  const adding   = manage?.adding  === node.id;

  return (
    <div>
      {renaming ? (
        <LocInlineInput
          value={node.name}
          depth={depth}
          onSubmit={name => manage.submitRename(node, name)}
          onCancel={manage.cancel}
        />
      ) : (
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
          <LocRowActions node={node} manage={manage} />
        </div>
      )}

      {adding && (
        <LocInlineInput
          placeholder="Nombre"
          depth={depth + 1}
          onSubmit={name => manage.submitAdd(node, name)}
          onCancel={manage.cancel}
        />
      )}

      {hasChildren && open && node.children.map(child => (
        <LocationNode
          key={child.id}
          node={child}
          selected={selected}
          onSelect={onSelect}
          depth={depth + 1}
          manage={manage}
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [locEditing, setLocEditing] = useState(null);
  const [locAdding,  setLocAdding]  = useState(null);   // node id, or 'root'
  const [locError,   setLocError]   = useState('');

  async function runLoc(fn) {
    setLocError('');
    try {
      await fn();
      setLocations(await api.locations.list());
    } catch (err) {
      setLocError(err.message);
    } finally {
      setLocEditing(null);
      setLocAdding(null);
    }
  }

  function countDesc(node) {
    if (!node.children?.length) return 0;
    return node.children.reduce((n, c) => n + 1 + countDesc(c), 0);
  }

  const manage = isAdmin ? {
    editing: locEditing,
    adding:  locAdding,
    cancel:  () => { setLocEditing(null); setLocAdding(null); },
    onAdd:    node => { setLocAdding(node.id); setLocEditing(null); },
    onRename: node => { setLocEditing(node.id); setLocAdding(null); },
    onDelete: node => {
      const n = countDesc(node);
      askConfirm(
        n > 0
          ? `Al eliminar "${node.name}" se eliminarán también sus ${n} ubicación(es) anidadas. Los contenedores guardados en ellas no se borran, pero quedarán sin ubicación asignada.`
          : `¿Eliminar la ubicación "${node.name}"? Los contenedores guardados en ella no se borran, pero quedarán sin ubicación asignada.`,
        () => runLoc(() => api.locations.delete(node.id))
      );
    },
    submitRename: (node, name) => runLoc(() => api.locations.update(node.id, { name })),
    submitAdd: (node, name) => runLoc(() => api.locations.create({
      name,
      parent_id: node.id,
      ordering: (node.children?.length || 0) + 1,
    })),
  } : null;

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
    .filter(c => q ? true : (!selectedLoc || c.location_id === selectedLoc))
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

      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Buscar por nombre, CAS o proveedor..."
          value={search}
          onChange={e => { setSearch(e.target.value); setChecked(new Set()); }}
        />
      </div>

      <div className={styles.inventoryBody}>
      {/* ── Locations Panel ─────────────────────────────────── */}
      <div className={styles.locPanel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Locations</span>
          {isAdmin && (
            <div className={styles.panelActions}>
              <button
                className={styles.locAddRootBtn}
                onClick={() => { setLocAdding('root'); setLocEditing(null); }}
                title="Nueva ubicación raíz"
              >
                <Plus size={13} />
              </button>
            </div>
          )}
        </div>
        {locError && <p className={styles.locError}>{locError}</p>}
        <div className={styles.locTree}>
          {locAdding === 'root' && (
            <LocInlineInput
              placeholder="Nueva ubicación raíz"
              depth={0}
              onSubmit={name => runLoc(() => api.locations.create({
                name, parent_id: null, ordering: locations.length + 1,
              }))}
              onCancel={() => setLocAdding(null)}
            />
          )}
          {locations.map(root => (
            <div key={root.id}>
              {manage?.editing === root.id ? (
                <LocInlineInput
                  value={root.name}
                  depth={0}
                  onSubmit={name => manage.submitRename(root, name)}
                  onCancel={manage.cancel}
                />
              ) : (
                <div className={styles.locFolder}>
                  <Folder size={13} className={styles.folderIcon} />
                  <span>{root.name}</span>
                  <LocRowActions node={root} manage={manage} />
                </div>
              )}
              {manage?.adding === root.id && (
                <LocInlineInput
                  placeholder="Nombre"
                  depth={1}
                  onSubmit={name => manage.submitAdd(root, name)}
                  onCancel={manage.cancel}
                />
              )}
              {root.children?.map(child => (
                <LocationNode
                  key={child.id}
                  node={child}
                  selected={selectedLoc}
                  onSelect={setSelectedLoc}
                  depth={1}
                  manage={manage}
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
