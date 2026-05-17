import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import InventoryLayout from '../../layouts/InventoryLayout';
import styles from './Resources.module.css';

const UNITS = ['g', 'mg', 'kg', 'mL', 'L', 'µL', 'mol', 'mmol', 'unidades'];

const INVENTORY_STATUS = [
  'available', 'in_use', 'ordered', 'low_stock', 'out_of_stock', 'expired',
];

const ESTADO_ACTUAL = ['Sólido', 'Líquido', 'Gas', 'Solución', 'Suspensión', 'Otro'];

function flattenLocations(nodes, depth = 0, result = []) {
  for (const n of nodes) {
    result.push({ id: n.id, label: '  '.repeat(depth) + n.name });
    if (n.children?.length) flattenLocations(n.children, depth + 1, result);
  }
  return result;
}

export default function ResourceForm() {
  const { id }   = useParams();
  const isEdit   = Boolean(id);
  const navigate = useNavigate();

  const [locations, setLocations] = useState([]);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [noCAS,     setNoCAS]     = useState(false);
  const [noBarcode, setNoBarcode] = useState(false);

  const [form, setForm] = useState({
    name:             '',
    cas_number:       '',
    quantity:         '',
    unit:             'g',
    barcode:          '',
    location_id:      '',
    supplier:         '',
    estado_actual:    '',
    grado:            '',
    numero:           '',
    inventory_status: 'available',
    notes:            '',
    min_quantity:     '',
    date_acquired:              '',
    comments:                   '',
    almacenamiento_requerido:   '',
    clase_quimica:              '',
    disposicion_residuos:       '',
    estado_fisico:              '',
    modelacion:                 '',
    polaridad:                  '',
  });

  useEffect(() => {
    api.locations.list().then(locs => setLocations(flattenLocations(locs)));
    if (isEdit) {
      api.resources.get(id).then(r => {
        setForm({
          name:             r.name,
          cas_number:       r.cas_number       ?? '',
          quantity:         r.quantity         ?? '',
          unit:             r.unit             || 'g',
          barcode:          r.barcode          ?? '',
          location_id:      r.location_id      ?? '',
          supplier:         r.supplier         ?? '',
          estado_actual:    r.estado_actual    ?? '',
          grado:            r.grado            ?? '',
          numero:           r.numero           ?? '',
          inventory_status: r.inventory_status || 'available',
          notes:            r.notes            ?? '',
          min_quantity:     r.min_quantity     ?? '',
          date_acquired:            r.date_acquired            ?? '',
          comments:                 r.comments                 ?? '',
          almacenamiento_requerido: r.almacenamiento_requerido ?? '',
          clase_quimica:            r.clase_quimica            ?? '',
          disposicion_residuos:     r.disposicion_residuos     ?? '',
          estado_fisico:            r.estado_fisico            ?? '',
          modelacion:               r.modelacion               ?? '',
          polaridad:                r.polaridad                ?? '',
        });
        if (!r.cas_number) setNoCAS(true);
        if (!r.barcode)    setNoBarcode(true);
      });
    }
  }, [id, isEdit]);

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('El nombre es requerido');
    setLoading(true);
    try {
      const payload = {
        ...form,
        cas_number:   noCAS     ? '' : form.cas_number,
        barcode:      noBarcode ? '' : form.barcode,
        quantity:     form.quantity     !== '' ? Number(form.quantity)     : 0,
        min_quantity: form.min_quantity !== '' ? Number(form.min_quantity) : null,
        location_id:  form.location_id  !== '' ? form.location_id          : null,
        category_id:  null,
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
    <InventoryLayout>
      <div className={styles.formPage}>
        <div className={styles.formCard}>
          <div className={styles.formCardHeader}>
            <h2 className={styles.formTitle}>
              {isEdit ? 'Edit Container' : 'Add a Container'}
            </h2>
            <Link to="/app/resources" className={styles.cancelLink}>← Back</Link>
          </div>

          <form onSubmit={handleSubmit} className={styles.addForm}>
            {error && <p className={styles.formError}>{error}</p>}

            {/* Container Name */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Container Name</label>
              <input
                className={styles.formInput}
                value={form.name}
                onChange={set('name')}
                required
                autoFocus
                placeholder="e.g. Aluminum chloride"
              />
            </div>

            {/* CAS Number */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>
                CAS Number
                <button
                  type="button"
                  className={styles.toggleLink}
                  onClick={() => { setNoCAS(v => !v); setForm(f => ({ ...f, cas_number: '' })); }}
                >
                  {noCAS ? 'add CAS number' : 'no CAS number?'}
                </button>
              </label>
              {!noCAS ? (
                <input
                  className={styles.formInput}
                  value={form.cas_number}
                  onChange={set('cas_number')}
                  placeholder="e.g. 7446-70-0"
                />
              ) : (
                <p className={styles.formHint}>No CAS number for this container.</p>
              )}
            </div>

            {/* Container Size + Unit */}
            <div className={styles.formRow}>
              <div className={styles.formField} style={{ flex: 2 }}>
                <label className={styles.formLabel}>Container Size</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min="0"
                  step="any"
                  value={form.quantity}
                  onChange={set('quantity')}
                  placeholder="0"
                />
              </div>
              <div className={styles.formField} style={{ flex: 1 }}>
                <label className={styles.formLabel}>Unit</label>
                <select className={styles.formSelect} value={form.unit} onChange={set('unit')}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* Barcode */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>
                Barcode
                <button
                  type="button"
                  className={styles.toggleLink}
                  onClick={() => { setNoBarcode(v => !v); setForm(f => ({ ...f, barcode: '' })); }}
                >
                  {noBarcode ? 'add barcode' : 'no barcode?'}
                </button>
              </label>
              {!noBarcode ? (
                <input
                  className={styles.formInput}
                  value={form.barcode}
                  onChange={set('barcode')}
                  placeholder="Scan or enter barcode"
                />
              ) : (
                <p className={styles.formHint}>No barcode for this container.</p>
              )}
            </div>

            {/* Location */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Location</label>
              <select
                className={styles.formSelect}
                value={form.location_id}
                onChange={set('location_id')}
              >
                <option value="">— Select location —</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Supplier */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Supplier</label>
              <input
                className={styles.formInput}
                value={form.supplier}
                onChange={set('supplier')}
                placeholder="e.g. Sigma-Aldrich"
              />
            </div>

            {/* Estado actual */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Estado actual</label>
              <select
                className={styles.formSelect}
                value={form.estado_actual}
                onChange={set('estado_actual')}
              >
                <option value="">— Seleccionar —</option>
                {ESTADO_ACTUAL.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Grado */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Grado</label>
              <input
                className={styles.formInput}
                value={form.grado}
                onChange={set('grado')}
                placeholder="e.g. ACS, HPLC, Técnico"
              />
            </div>

            {/* Número */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Número</label>
              <input
                className={styles.formInput}
                value={form.numero}
                onChange={set('numero')}
                placeholder="Número de lote / batch"
              />
            </div>

            {/* Status en inventario */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Status en inventario</label>
              <select
                className={styles.formSelect}
                value={form.inventory_status}
                onChange={set('inventory_status')}
              >
                {INVENTORY_STATUS.map(s => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* Comments */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Comments</label>
              <textarea
                className={styles.formTextarea}
                value={form.comments}
                onChange={set('comments')}
                placeholder="Botella café tapa negra; State: líquido..."
              />
            </div>

            {/* Date Acquired */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Date Acquired</label>
              <input
                className={styles.formInput}
                type="date"
                value={form.date_acquired}
                onChange={set('date_acquired')}
              />
            </div>

            {/* Almacenamiento requerido */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Almacenamiento requerido</label>
              <input
                className={styles.formInput}
                value={form.almacenamiento_requerido}
                onChange={set('almacenamiento_requerido')}
                placeholder="e.g. higroscópico, refrigerar..."
              />
            </div>

            {/* Clase química */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Clase química</label>
              <input
                className={styles.formInput}
                value={form.clase_quimica}
                onChange={set('clase_quimica')}
                placeholder="e.g. alcohol, ácido, base..."
              />
            </div>

            {/* Disposición de residuos */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Disposición de residuos</label>
              <input
                className={styles.formInput}
                value={form.disposicion_residuos}
                onChange={set('disposicion_residuos')}
                placeholder="e.g. residuo orgánico halogenado..."
              />
            </div>

            {/* Estado físico (25 °C) */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Estado físico (25 °C)</label>
              <input
                className={styles.formInput}
                value={form.estado_fisico}
                onChange={set('estado_fisico')}
                placeholder="e.g. líquido, sólido..."
              />
            </div>

            {/* Modelación */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Modelación</label>
              <input
                className={styles.formInput}
                value={form.modelacion}
                onChange={set('modelacion')}
                placeholder="e.g. modelable-con-cosmo | modelable-con-pc-saft"
              />
            </div>

            {/* Polaridad */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Polaridad</label>
              <input
                className={styles.formInput}
                value={form.polaridad}
                onChange={set('polaridad')}
                placeholder="e.g. polar-prótico, apolar..."
              />
            </div>

            {/* Notes */}
            <div className={styles.formField}>
              <label className={styles.formLabel}>Notas internas</label>
              <textarea
                className={styles.formTextarea}
                value={form.notes}
                onChange={set('notes')}
                placeholder="Observaciones, condiciones de almacenamiento..."
              />
            </div>

            <div className={styles.formSubmitRow}>
              <button type="submit" disabled={loading} className={styles.submitBtn}>
                {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Add Container'}
              </button>
              <Link to="/app/resources" className={styles.cancelBtn}>Cancel</Link>
            </div>
          </form>
        </div>
      </div>
    </InventoryLayout>
  );
}
