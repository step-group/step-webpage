require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

const ADMIN = {
  name:     'Maria Luisa',
  email:    'admin@step-lab.com',
  password: 'CambiaEsto123!',
  role:     'admin',
  status:   'approved',
};

// ── Zone 1.1 — 15 containers ──────────────────────────────────────────────────
const ZONE_1_1 = [
  { name: 'Aluminum chloride',          quantity: 60,  unit: 'g',  cas: '7446-70-0',   supplier: 'Sigma-Aldrich', estado: 'Sólido',  grado: 'ACS'     },
  { name: 'Amberlita XAD-4',            quantity: 500, unit: 'mL', cas: '37380-43-1',  supplier: 'Supelco',       estado: 'Sólido',  grado: 'Técnico' },
  { name: 'Amberlita XAD-4',            quantity: 100, unit: 'g',  cas: '37380-43-1',  supplier: 'Supelco',       estado: 'Sólido',  grado: 'Técnico' },
  { name: 'Cellulose microcrystalline', quantity: 400, unit: 'g',  cas: '9004-34-6',   supplier: 'Sigma-Aldrich', estado: 'Sólido',  grado: 'ACS'     },
  { name: 'Cellulose microcrystalline', quantity: 400, unit: 'g',  cas: '9004-34-6',   supplier: 'Sigma-Aldrich', estado: 'Sólido',  grado: 'ACS'     },
  { name: 'Cellulose microcrystalline', quantity: 400, unit: 'g',  cas: '9004-34-6',   supplier: 'Sigma-Aldrich', estado: 'Sólido',  grado: 'ACS'     },
  { name: 'Cellulose microcrystalline', quantity: 400, unit: 'g',  cas: '9004-34-6',   supplier: 'Sigma-Aldrich', estado: 'Sólido',  grado: 'ACS'     },
  { name: 'Silica gel',                 quantity: 500, unit: 'g',  cas: '112926-00-8', supplier: 'Merck',         estado: 'Sólido',  grado: 'Técnico' },
  { name: 'Activated carbon',           quantity: 250, unit: 'g',  cas: '7440-44-0',   supplier: 'Fluka',         estado: 'Sólido',  grado: 'Técnico' },
  { name: 'Sodium chloride',            quantity: 500, unit: 'g',  cas: '7647-14-5',   supplier: 'Merck',         estado: 'Sólido',  grado: 'ACS'     },
  { name: 'Sodium hydroxide',           quantity: 250, unit: 'g',  cas: '1310-73-2',   supplier: 'Merck',         estado: 'Sólido',  grado: 'ACS'     },
  { name: 'Potassium permanganate',     quantity: 100, unit: 'g',  cas: '7722-64-7',   supplier: 'Sigma-Aldrich', estado: 'Sólido',  grado: 'ACS'     },
  { name: 'Ethanol',                    quantity: 1,   unit: 'L',  cas: '64-17-5',     supplier: 'Merck',         estado: 'Líquido', grado: 'HPLC'    },
  { name: 'Acetone',                    quantity: 500, unit: 'mL', cas: '67-64-1',     supplier: 'Merck',         estado: 'Líquido', grado: 'HPLC'    },
  { name: 'Hydrochloric acid',          quantity: 500, unit: 'mL', cas: '7647-01-0',   supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'ACS'     },
];

// ── Zone 1.2 — 31 containers ──────────────────────────────────────────────────
const ZONE_1_2 = [
  { name: '1-Butanol',                  quantity: 800, unit: 'mL', cas: '71-36-3',     supplier: 'Merck',         estado: 'Líquido', grado: 'ACS'     },
  { name: '1-Butanol (anhydrous)',       quantity: 100, unit: 'mL', cas: '71-36-3',     supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'ACS'     },
  { name: '1-Decanol',                  quantity: 250, unit: 'g',  cas: '112-30-1',    supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'Técnico' },
  { name: '1-Octanol for synthesis',    quantity: 1,   unit: 'L',  cas: '111-87-5',    supplier: 'Merck',         estado: 'Líquido', grado: 'Técnico' },
  { name: '1,2-Butanediol',             quantity: 125, unit: 'g',  cas: '584-03-2',    supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'ACS'     },
  { name: '1,2-Propanediol',            quantity: 200, unit: 'mL', cas: '57-55-6',     supplier: 'Merck',         estado: 'Líquido', grado: 'ACS'     },
  { name: '1,2-Propanediol',            quantity: 200, unit: 'mL', cas: '57-55-6',     supplier: 'Merck',         estado: 'Líquido', grado: 'ACS'     },
  { name: '1,3-Butanediol',             quantity: 100, unit: 'mL', cas: '107-88-0',    supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'ACS'     },
  { name: '1,3-Propanediol',            quantity: 250, unit: 'mL', cas: '504-63-2',    supplier: 'Merck',         estado: 'Líquido', grado: 'Técnico' },
  { name: '1,4-Butanediol',             quantity: 500, unit: 'mL', cas: '110-63-4',    supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'ACS'     },
  { name: '1-Heptanol',                 quantity: 100, unit: 'mL', cas: '111-70-6',    supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'Técnico' },
  { name: '1-Hexanol',                  quantity: 100, unit: 'mL', cas: '111-27-3',    supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'ACS'     },
  { name: '1-Pentanol',                 quantity: 250, unit: 'mL', cas: '71-41-0',     supplier: 'Merck',         estado: 'Líquido', grado: 'Técnico' },
  { name: '1-Propanol',                 quantity: 500, unit: 'mL', cas: '71-23-8',     supplier: 'Merck',         estado: 'Líquido', grado: 'ACS'     },
  { name: '2-Butanol',                  quantity: 500, unit: 'mL', cas: '78-92-2',     supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'ACS'     },
  { name: '2-Ethyl-1-hexanol',          quantity: 250, unit: 'mL', cas: '104-76-7',    supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'Técnico' },
  { name: '2-Methyl-1-propanol',        quantity: 100, unit: 'mL', cas: '78-83-1',     supplier: 'Merck',         estado: 'Líquido', grado: 'ACS'     },
  { name: '2-Octanol',                  quantity: 100, unit: 'mL', cas: '123-96-6',    supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'Técnico' },
  { name: '2-Propanol',                 quantity: 1,   unit: 'L',  cas: '67-63-0',     supplier: 'Merck',         estado: 'Líquido', grado: 'HPLC'    },
  { name: '3-Methyl-1-butanol',         quantity: 250, unit: 'mL', cas: '123-51-3',    supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'Técnico' },
  { name: 'Benzyl alcohol',             quantity: 500, unit: 'mL', cas: '100-51-6',    supplier: 'Merck',         estado: 'Líquido', grado: 'ACS'     },
  { name: 'Cyclohexanol',               quantity: 250, unit: 'mL', cas: '108-93-0',    supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'ACS'     },
  { name: 'Diethylene glycol',          quantity: 500, unit: 'mL', cas: '111-46-6',    supplier: 'Merck',         estado: 'Líquido', grado: 'Técnico' },
  { name: 'Ethylene glycol',            quantity: 500, unit: 'mL', cas: '107-21-1',    supplier: 'Merck',         estado: 'Líquido', grado: 'ACS'     },
  { name: 'Furfuryl alcohol',           quantity: 100, unit: 'mL', cas: '98-00-0',     supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'Técnico' },
  { name: 'Glycerol',                   quantity: 500, unit: 'mL', cas: '56-81-5',     supplier: 'Merck',         estado: 'Líquido', grado: 'ACS'     },
  { name: 'n-Amyl alcohol',             quantity: 250, unit: 'mL', cas: '71-41-0',     supplier: 'Fluka',         estado: 'Líquido', grado: 'Técnico' },
  { name: 'Neopentyl glycol',           quantity: 100, unit: 'g',  cas: '126-30-7',    supplier: 'Sigma-Aldrich', estado: 'Sólido',  grado: 'ACS'     },
  { name: 'Tetraethylene glycol',       quantity: 100, unit: 'mL', cas: '112-60-7',    supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'Técnico' },
  { name: 'Triethylene glycol',         quantity: 250, unit: 'mL', cas: '112-27-6',    supplier: 'Merck',         estado: 'Líquido', grado: 'Técnico' },
  { name: 'Trifluoroethanol',           quantity: 100, unit: 'mL', cas: '75-89-8',     supplier: 'Sigma-Aldrich', estado: 'Líquido', grado: 'ACS'     },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveZone(zoneName) {
  const { rows } = await pool.query(`
    SELECT l.id FROM locations l
    JOIN locations parent ON parent.id = l.parent_id
    WHERE l.name = $1 AND parent.name = 'Lab STEP'
    LIMIT 1
  `, [zoneName]);
  return rows[0]?.id ?? null;
}

async function seedZone(zoneId, zoneName, containers, adminId) {
  const { rows: [{ n }] } = await pool.query(
    'SELECT COUNT(*) AS n FROM resources WHERE location_id = $1',
    [zoneId]
  );

  if (Number(n) >= containers.length) {
    console.log(`  ${zoneName}: already seeded, skipping.`);
    return;
  }

  await pool.query(
    "DELETE FROM resources WHERE location_id = $1 AND state = 'normal'",
    [zoneId]
  );

  for (const c of containers) {
    await pool.query(`
      INSERT INTO resources
        (name, quantity, unit, cas_number, supplier, estado_actual, grado,
         inventory_status, location_id, created_by,
         barcode, numero, notes, location, min_quantity)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'','','','',NULL)
    `, [
      c.name, c.quantity, c.unit, c.cas, c.supplier,
      c.estado, c.grado, 'available', zoneId, adminId,
    ]);
  }

  console.log(`  ${zoneName}: ${containers.length} containers seeded.`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  const hash = await bcrypt.hash(ADMIN.password, 12);
  const { rows: [admin] } = await pool.query(`
    INSERT INTO users (name, email, password_hash, role, status)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, [ADMIN.name, ADMIN.email, hash, ADMIN.role, ADMIN.status]);

  console.log(`Admin: ${ADMIN.email} / ${ADMIN.password}`);

  const zone11 = await resolveZone('Zone 1.1');
  const zone12 = await resolveZone('Zone 1.2');

  if (!zone11 || !zone12) {
    console.warn('Zones not found — run migrations first (005_inventory_upgrade.sql)');
    await pool.end();
    return;
  }

  console.log('Seeding containers...');
  await seedZone(zone11, 'Zone 1.1', ZONE_1_1, admin.id);
  await seedZone(zone12, 'Zone 1.2', ZONE_1_2, admin.id);

  await seedTemplates(admin.id);

  await pool.end();
}

async function seedTemplates(adminId) {
  const DENSIMETER_TEMPLATE = {
    title: 'Medición de densidad con densímetro',
    body:
      'Protocolo para medir la densidad de mezclas líquidas usando un densímetro de tubo vibrante (ej. Anton Paar DMA).\n\n' +
      'Antes de iniciar, vincular al experimento los compuestos del inventario que se van a usar. ' +
      'El modelo del densímetro y las notas de calibración se registran al crear el dataset.',
    tags: ['densidad', 'densímetro', 'mezclas'],
    steps: [
      { ordering: 1,  body: 'Registrar modelo y número de serie del densímetro (se ingresa al crear el dataset)' },
      { ordering: 2,  body: 'Calibrar con agua Milli-Q y aire seco a la temperatura de trabajo — verificar que ρ(H₂O, 298.15 K) = 997.045 kg·m⁻³ ± 0.005 kg·m⁻³' },
      { ordering: 3,  body: 'Preparar las mezclas gravimétricamente con balanza analítica (u(m) ≤ 0.1 mg) para las fracciones molares objetivo' },
      { ordering: 4,  body: 'Desgasificar las muestras en baño de ultrasonido (15 min) para eliminar burbujas disueltas' },
      { ordering: 5,  body: 'Limpiar la celda de medición con el solvente más volátil de la mezcla y secar con flujo de N₂ seco' },
      { ordering: 6,  body: 'Cargar la primera muestra en la celda y esperar estabilización de temperatura (ΔT < 0.005 K durante 10 min)' },
      { ordering: 7,  body: 'Registrar densidad, temperatura y presión para cada punto de concentración en el dataset' },
      { ordering: 8,  body: 'Limpiar y secar la celda entre cada medición (repetir paso 5)' },
      { ordering: 9,  body: 'Verificar reproducibilidad midiendo un componente puro conocido al finalizar la sesión' },
      { ordering: 10, body: 'Calcular incertidumbres expandidas U(ρ) con factor de cobertura k = 2 y registrarlas en cada punto del dataset' },
    ],
  };

  const existing = await pool.query(
    'SELECT id FROM experiment_templates WHERE title = $1 LIMIT 1',
    [DENSIMETER_TEMPLATE.title]
  );

  if (existing.rows.length > 0) {
    console.log('  Templates: already seeded, skipping.');
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [tmpl] } = await client.query(
      `INSERT INTO experiment_templates (title, body, tags, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [DENSIMETER_TEMPLATE.title, DENSIMETER_TEMPLATE.body, DENSIMETER_TEMPLATE.tags, adminId]
    );

    for (const s of DENSIMETER_TEMPLATE.steps) {
      await client.query(
        'INSERT INTO template_steps (template_id, body, ordering) VALUES ($1, $2, $3)',
        [tmpl.id, s.body, s.ordering]
      );
    }

    await client.query(
      'INSERT INTO template_datasets (template_id, title, equipment, ordering) VALUES ($1, $2, $3, $4)',
      [tmpl.id, 'Dataset de densidad', 'Anton Paar DMA 5000 M', 0]
    );

    await client.query('COMMIT');
    console.log(`  Templates: "${DENSIMETER_TEMPLATE.title}" seeded (${DENSIMETER_TEMPLATE.steps.length} pasos).`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
