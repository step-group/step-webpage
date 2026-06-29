function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generates a ThermoML XML string (IUPAC/NIST standard) from a dataset object.
 * dataset shape: { title, equipment, calibration_notes, compounds: [...], points: [...] }
 */
export function generateThermoML(dataset) {
  const { title, equipment, compounds, points } = dataset;

  const comp1 = compounds.find(c => c.compound_index === 1);
  const comp2 = compounds.find(c => c.compound_index === 2);
  const isMixture = Boolean(comp2);

  // Decide whether pressure is a constraint (fixed) or a variable
  const pressureValues = [...new Set(points.map(p => Number(p.pressure_kpa)))];
  const isConstantPressure = pressureValues.length <= 1;
  const constPressure = pressureValues[0] ?? 101.325;

  // Assign variable numbers
  let nextVar = 1;
  const VAR_T  = nextVar++;
  const VAR_X1 = isMixture ? nextVar++ : null;
  const VAR_P  = !isConstantPressure ? nextVar++ : null;
  const PROP_RHO = 1;

  const L = []; // lines
  const ln  = s => L.push(s);
  const ind = (n, s) => L.push(' '.repeat(n) + s);

  ln(`<?xml version="1.0" encoding="UTF-8"?>`);
  ln(`<DataReport`);
  ln(`  xmlns="http://www.iupac.org/namespaces/ThermoML"`);
  ln(`  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`);
  ln(`  xsi:schemaLocation="http://www.iupac.org/namespaces/ThermoML https://trc.nist.gov/ThermoML.xsd">`);
  ln(``);

  // ── Citation ────────────────────────────────────────────────────────────────
  ln(`  <Citation>`);
  ind(4, `<eType>journal</eType>`);
  ind(4, `<eLanguage>en</eLanguage>`);
  ind(4, `<sTitle>${esc(title)}</sTitle>`);
  if (equipment) ind(4, `<sKeyword>${esc(equipment)}</sKeyword>`);
  ln(`  </Citation>`);
  ln(``);

  // ── Compounds ───────────────────────────────────────────────────────────────
  for (const c of [comp1, ...(isMixture ? [comp2] : [])].filter(Boolean)) {
    ln(`  <Compound>`);
    ind(4, `<RegNum>`);
    ind(6, `<nOrgNum>${c.compound_index}</nOrgNum>`);
    if (c.cas_number) ind(6, `<nCASRN>${esc(c.cas_number)}</nCASRN>`);
    ind(4, `</RegNum>`);
    ind(4, `<sCommonName>${esc(c.name)}</sCommonName>`);
    if (c.cas_number) ind(4, `<nCASRN>${esc(c.cas_number)}</nCASRN>`);

    const hasSample = c.supplier || c.purity != null || c.grade;
    if (hasSample) {
      ind(4, `<Sample>`);
      ind(6, `<nSampleNm>${c.compound_index}</nSampleNm>`);
      if (c.supplier) {
        ind(6, `<eSource>Commercial source</eSource>`);
        ind(6, `<sSupplier>${esc(c.supplier)}</sSupplier>`);
      }
      if (c.purity != null) {
        ind(6, `<purity>`);
        ind(8, `<nStep>1</nStep>`);
        ind(8, `<nPurityMol>${c.purity}</nPurityMol>`);
        if (c.purity_unit) ind(8, `<ePurityUnit>${esc(c.purity_unit)}</ePurityUnit>`);
        ind(6, `</purity>`);
      } else if (c.grade) {
        ind(6, `<purity>`);
        ind(8, `<nStep>1</nStep>`);
        ind(8, `<ePurityGrade>${esc(c.grade)}</ePurityGrade>`);
        ind(6, `</purity>`);
      }
      ind(4, `</Sample>`);
    }
    ln(`  </Compound>`);
    ln(``);
  }

  // ── PureOrMixtureData ───────────────────────────────────────────────────────
  ln(`  <PureOrMixtureData>`);
  ln(``);

  // Component references
  for (const c of [comp1, ...(isMixture ? [comp2] : [])].filter(Boolean)) {
    ind(4, `<Component>`);
    ind(6, `<RegNum><nOrgNum>${c.compound_index}</nOrgNum></RegNum>`);
    ind(6, `<nSampleNm>${c.compound_index}</nSampleNm>`);
    ind(4, `</Component>`);
  }
  ln(``);

  // Property — mass density
  ind(4, `<Property>`);
  ind(6, `<nPropNumber>${PROP_RHO}</nPropNumber>`);
  ind(6, `<Property-MethodID>`);
  ind(8, `<PropertyGroup>`);
  ind(10, `<VolumetricProp>`);
  ind(12, `<ePropName>Mass density, kg/m3</ePropName>`);
  ind(12, `<eMethodName>Vibrating tube method</eMethodName>`);
  ind(10, `</VolumetricProp>`);
  ind(8, `</PropertyGroup>`);
  ind(6, `</Property-MethodID>`);
  ind(6, `<PropPhaseID>`);
  ind(8, `<ePropPhase>Liquid</ePropPhase>`);
  ind(6, `</PropPhaseID>`);
  ind(6, `<nPropNumber>${PROP_RHO}</nPropNumber>`);
  ind(4, `</Property>`);
  ln(``);

  // Constraint — pressure (if constant)
  if (isConstantPressure) {
    ind(4, `<Constraint>`);
    ind(6, `<nConstraintNumber>1</nConstraintNumber>`);
    ind(6, `<ConstraintID>`);
    ind(8, `<ConstraintPhaseID>`);
    ind(10, `<eConstraintPhase>Liquid</eConstraintPhase>`);
    ind(8, `</ConstraintPhaseID>`);
    ind(8, `<nConstraintNumber>1</nConstraintNumber>`);
    ind(8, `<Constraint-MethodID>`);
    ind(10, `<ConstraintType>`);
    ind(12, `<ePressure>Pressure, kPa</ePressure>`);
    ind(10, `</ConstraintType>`);
    ind(8, `</Constraint-MethodID>`);
    ind(6, `</ConstraintID>`);
    ind(6, `<nConstraintValue>${constPressure}</nConstraintValue>`);
    ind(4, `</Constraint>`);
    ln(``);
  }

  // Variable — temperature
  ind(4, `<Variable>`);
  ind(6, `<nVarNumber>${VAR_T}</nVarNumber>`);
  ind(6, `<VariableID>`);
  ind(8, `<VariablePhaseID>`);
  ind(10, `<eVariablePhase>Liquid</eVariablePhase>`);
  ind(8, `</VariablePhaseID>`);
  ind(8, `<nVarNumber>${VAR_T}</nVarNumber>`);
  ind(8, `<VarType>`);
  ind(10, `<eTemperature>Temperature, K</eTemperature>`);
  ind(8, `</VarType>`);
  ind(6, `</VariableID>`);
  ind(4, `</Variable>`);
  ln(``);

  // Variable — mole fraction (binary mixture)
  if (isMixture) {
    ind(4, `<Variable>`);
    ind(6, `<nVarNumber>${VAR_X1}</nVarNumber>`);
    ind(6, `<VariableID>`);
    ind(8, `<VariablePhaseID>`);
    ind(10, `<eVariablePhase>Liquid</eVariablePhase>`);
    ind(8, `</VariablePhaseID>`);
    ind(8, `<nVarNumber>${VAR_X1}</nVarNumber>`);
    ind(8, `<VarType>`);
    ind(10, `<eCompositionMole>Mole fraction</eCompositionMole>`);
    ind(8, `</VarType>`);
    ind(6, `</VariableID>`);
    ind(6, `<nVarComponent>${comp1.compound_index}</nVarComponent>`);
    ind(4, `</Variable>`);
    ln(``);
  }

  // Variable — pressure (if varying)
  if (!isConstantPressure) {
    ind(4, `<Variable>`);
    ind(6, `<nVarNumber>${VAR_P}</nVarNumber>`);
    ind(6, `<VariableID>`);
    ind(8, `<VariablePhaseID>`);
    ind(10, `<eVariablePhase>Liquid</eVariablePhase>`);
    ind(8, `</VariablePhaseID>`);
    ind(8, `<nVarNumber>${VAR_P}</nVarNumber>`);
    ind(8, `<VarType>`);
    ind(10, `<ePressure>Pressure, kPa</ePressure>`);
    ind(8, `</VarType>`);
    ind(6, `</VariableID>`);
    ind(4, `</Variable>`);
    ln(``);
  }

  // NumValues — one block per data point
  for (const p of points) {
    ind(4, `<NumValues>`);

    ind(6, `<VariableValue>`);
    ind(8, `<nVarNumber>${VAR_T}</nVarNumber>`);
    ind(8, `<nVarValue>${p.temperature_k}</nVarValue>`);
    if (p.u_temperature != null) ind(8, `<nVarUncertainty>${p.u_temperature}</nVarUncertainty>`);
    ind(6, `</VariableValue>`);

    if (isMixture && p.mole_fraction_1 != null) {
      ind(6, `<VariableValue>`);
      ind(8, `<nVarNumber>${VAR_X1}</nVarNumber>`);
      ind(8, `<nVarValue>${p.mole_fraction_1}</nVarValue>`);
      ind(6, `</VariableValue>`);
    }

    if (!isConstantPressure) {
      ind(6, `<VariableValue>`);
      ind(8, `<nVarNumber>${VAR_P}</nVarNumber>`);
      ind(8, `<nVarValue>${p.pressure_kpa}</nVarValue>`);
      if (p.u_pressure != null) ind(8, `<nVarUncertainty>${p.u_pressure}</nVarUncertainty>`);
      ind(6, `</VariableValue>`);
    }

    ind(6, `<PropertyValue>`);
    ind(8, `<nPropNumber>${PROP_RHO}</nPropNumber>`);
    ind(8, `<nPropValue>${p.density_kg_m3}</nPropValue>`);
    if (p.u_density != null) {
      ind(8, `<CombinedUncertainty>`);
      ind(10, `<nCombUncertAssessNum>1</nCombUncertAssessNum>`);
      ind(10, `<nCombExpandUncertValue>${p.u_density}</nCombExpandUncertValue>`);
      ind(8, `</CombinedUncertainty>`);
    }
    ind(6, `</PropertyValue>`);

    ind(4, `</NumValues>`);
  }

  ln(``);
  ln(`  </PureOrMixtureData>`);
  ln(``);
  ln(`</DataReport>`);

  return L.join('\n');
}

export function downloadThermoML(dataset) {
  const xml  = generateThermoML(dataset);
  const blob = new Blob([xml], { type: 'application/xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${dataset.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
