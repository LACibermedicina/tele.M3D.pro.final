interface ExternalMedication {
  externalId: string;
  source: string;
  name: string;
  genericName: string;
  activeIngredient: string;
  dosageForm: string;
  strength: string;
  route: string;
  category: string;
  manufacturer: string;
  registrationNumber: string;
  requiresPrescription: boolean;
}

async function searchRxNorm(term: string, limit = 20): Promise<ExternalMedication[]> {
  try {
    const suggestUrl = `https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json?name=${encodeURIComponent(term)}`;
    const suggestRes = await fetch(suggestUrl);
    const suggestData = await suggestRes.json();
    const suggestions = suggestData?.suggestionGroup?.suggestionList?.suggestion || [];
    const searchTerm = suggestions.length > 0 ? suggestions[0] : term;

    const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(searchTerm)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();

    const results: ExternalMedication[] = [];
    const seen = new Set<string>();
    const groups = data?.drugGroup?.conceptGroup || [];

    for (const group of groups) {
      if (!group.conceptProperties) continue;
      for (const drug of group.conceptProperties) {
        if (results.length >= limit) break;
        const key = drug.name?.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const parsed = parseRxNormName(drug.name || '', drug.tty || '');
        results.push({
          externalId: `rxnorm-${drug.rxcui}`,
          source: 'RxNorm (NLM/NIH)',
          name: parsed.brandName || drug.name || '',
          genericName: parsed.genericName || searchTerm,
          activeIngredient: parsed.activeIngredient || searchTerm,
          dosageForm: parsed.dosageForm || '',
          strength: parsed.strength || '',
          route: parsed.route || 'oral',
          category: '',
          manufacturer: '',
          registrationNumber: drug.rxcui || '',
          requiresPrescription: true,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('[MED-SEARCH] RxNorm error:', error);
    return [];
  }
}

function parseRxNormName(fullName: string, tty: string): {
  brandName: string;
  genericName: string;
  activeIngredient: string;
  dosageForm: string;
  strength: string;
  route: string;
} {
  const brandMatch = fullName.match(/\[(.+?)\]/);
  const brandName = brandMatch ? brandMatch[1] : '';
  const cleanName = fullName.replace(/\[.+?\]/, '').trim();

  let strength = '';
  const strengthMatch = cleanName.match(/(\d+\.?\d*\s*(MG|MCG|ML|MG\/ML|MCG\/ML|UNIT|IU|%|G))/i);
  if (strengthMatch) strength = strengthMatch[0];

  let dosageForm = '';
  const formPatterns = [
    'Extended Release Oral Tablet', 'Oral Tablet', 'Oral Capsule', 'Oral Solution',
    'Oral Suspension', 'Injectable Solution', 'Topical Cream', 'Topical Ointment',
    'Nasal Spray', 'Ophthalmic Solution', 'Rectal Suppository', 'Sublingual Tablet',
    'Chewable Tablet', 'Oral Powder', 'Inhalation Solution', 'Transdermal Patch',
    'Tablet', 'Capsule', 'Solution', 'Suspension', 'Cream', 'Ointment', 'Spray',
    'Injection', 'Patch', 'Drops', 'Syrup', 'Gel', 'Inhaler'
  ];
  for (const form of formPatterns) {
    if (cleanName.toLowerCase().includes(form.toLowerCase())) {
      dosageForm = form;
      break;
    }
  }

  let route = 'oral';
  if (cleanName.toLowerCase().includes('topical')) route = 'topical';
  else if (cleanName.toLowerCase().includes('injectable') || cleanName.toLowerCase().includes('injection')) route = 'injectable';
  else if (cleanName.toLowerCase().includes('nasal')) route = 'nasal';
  else if (cleanName.toLowerCase().includes('ophthalmic')) route = 'ophthalmic';
  else if (cleanName.toLowerCase().includes('rectal')) route = 'rectal';
  else if (cleanName.toLowerCase().includes('inhalation')) route = 'inhalation';
  else if (cleanName.toLowerCase().includes('transdermal')) route = 'transdermal';

  const genericPart = cleanName
    .replace(/\d+\.?\d*\s*(MG|MCG|ML|MG\/ML|MCG\/ML|UNIT|IU|%|G)\s*/gi, '')
    .replace(new RegExp(formPatterns.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi'), '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s/]+|[\s/]+$/g, '')
    .trim();

  return {
    brandName,
    genericName: genericPart || cleanName,
    activeIngredient: genericPart || cleanName,
    dosageForm,
    strength,
    route,
  };
}

async function searchOpenFDA(term: string, limit = 20): Promise<ExternalMedication[]> {
  try {
    const url = `https://api.fda.gov/drug/drugsfda.json?search=openfda.brand_name:${encodeURIComponent(term)}+openfda.generic_name:${encodeURIComponent(term)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();

    const results: ExternalMedication[] = [];
    const seen = new Set<string>();

    for (const result of data.results || []) {
      for (const product of result.products || []) {
        if (results.length >= limit) break;
        const key = `${product.brand_name}-${product.active_ingredients?.map((i: any) => i.name).join(',')}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const ingredients = product.active_ingredients || [];
        results.push({
          externalId: `fda-${result.application_number}-${product.product_number}`,
          source: 'OpenFDA (USA)',
          name: product.brand_name || '',
          genericName: ingredients.map((i: any) => i.name).join(' + ') || '',
          activeIngredient: ingredients.map((i: any) => `${i.name} ${i.strength || ''}`).join(', ') || '',
          dosageForm: product.dosage_form || '',
          strength: ingredients.map((i: any) => i.strength || '').filter(Boolean).join(', ') || '',
          route: product.route || '',
          category: product.te_code || '',
          manufacturer: result.sponsor_name || '',
          registrationNumber: result.application_number || '',
          requiresPrescription: true,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('[MED-SEARCH] OpenFDA error:', error);
    return [];
  }
}

async function searchANVISA(term: string, limit = 20): Promise<ExternalMedication[]> {
  try {
    const commonBrazilianMeds: Record<string, ExternalMedication[]> = {};
    const termLower = term.toLowerCase();
    
    const renameList = [
      { name: 'Amoxicilina', generic: 'Amoxicilina', active: 'Amoxicilina tri-hidratada', form: 'Comprimido/Cápsula', strength: '500mg', route: 'oral', category: 'Antibiótico', reg: 'RENAME' },
      { name: 'Amoxicilina + Clavulanato', generic: 'Amoxicilina + Ácido Clavulânico', active: 'Amoxicilina + Ácido Clavulânico', form: 'Comprimido', strength: '500mg + 125mg', route: 'oral', category: 'Antibiótico', reg: 'RENAME' },
      { name: 'Azitromicina', generic: 'Azitromicina', active: 'Azitromicina di-hidratada', form: 'Comprimido', strength: '500mg', route: 'oral', category: 'Antibiótico', reg: 'RENAME' },
      { name: 'Metformina', generic: 'Metformina', active: 'Cloridrato de Metformina', form: 'Comprimido', strength: '500mg/850mg', route: 'oral', category: 'Antidiabético', reg: 'RENAME' },
      { name: 'Losartana', generic: 'Losartana', active: 'Losartana Potássica', form: 'Comprimido', strength: '50mg', route: 'oral', category: 'Anti-hipertensivo', reg: 'RENAME' },
      { name: 'Enalapril', generic: 'Enalapril', active: 'Maleato de Enalapril', form: 'Comprimido', strength: '10mg/20mg', route: 'oral', category: 'Anti-hipertensivo', reg: 'RENAME' },
      { name: 'Anlodipino', generic: 'Anlodipino', active: 'Besilato de Anlodipino', form: 'Comprimido', strength: '5mg/10mg', route: 'oral', category: 'Anti-hipertensivo', reg: 'RENAME' },
      { name: 'Sinvastatina', generic: 'Sinvastatina', active: 'Sinvastatina', form: 'Comprimido', strength: '20mg/40mg', route: 'oral', category: 'Hipolipemiante', reg: 'RENAME' },
      { name: 'Atorvastatina', generic: 'Atorvastatina', active: 'Atorvastatina Cálcica', form: 'Comprimido', strength: '10mg/20mg/40mg', route: 'oral', category: 'Hipolipemiante', reg: 'RENAME' },
      { name: 'Omeprazol', generic: 'Omeprazol', active: 'Omeprazol', form: 'Cápsula', strength: '20mg', route: 'oral', category: 'Antiulceroso', reg: 'RENAME' },
      { name: 'Pantoprazol', generic: 'Pantoprazol', active: 'Pantoprazol Sódico', form: 'Comprimido', strength: '20mg/40mg', route: 'oral', category: 'Antiulceroso', reg: 'RENAME' },
      { name: 'Dipirona', generic: 'Dipirona', active: 'Dipirona Sódica', form: 'Comprimido/Solução Oral', strength: '500mg', route: 'oral', category: 'Analgésico', reg: 'RENAME' },
      { name: 'Paracetamol', generic: 'Paracetamol', active: 'Paracetamol (Acetaminofeno)', form: 'Comprimido/Solução Oral', strength: '500mg/750mg', route: 'oral', category: 'Analgésico', reg: 'RENAME' },
      { name: 'Ibuprofeno', generic: 'Ibuprofeno', active: 'Ibuprofeno', form: 'Comprimido/Cápsula', strength: '200mg/400mg/600mg', route: 'oral', category: 'Anti-inflamatório', reg: 'RENAME' },
      { name: 'Diclofenaco', generic: 'Diclofenaco', active: 'Diclofenaco Sódico/Potássico', form: 'Comprimido', strength: '50mg', route: 'oral', category: 'Anti-inflamatório', reg: 'RENAME' },
      { name: 'Prednisona', generic: 'Prednisona', active: 'Prednisona', form: 'Comprimido', strength: '5mg/20mg', route: 'oral', category: 'Corticosteroide', reg: 'RENAME' },
      { name: 'Dexametasona', generic: 'Dexametasona', active: 'Dexametasona', form: 'Comprimido/Elixir', strength: '4mg', route: 'oral', category: 'Corticosteroide', reg: 'RENAME' },
      { name: 'Hidroclorotiazida', generic: 'Hidroclorotiazida', active: 'Hidroclorotiazida', form: 'Comprimido', strength: '25mg', route: 'oral', category: 'Diurético', reg: 'RENAME' },
      { name: 'Furosemida', generic: 'Furosemida', active: 'Furosemida', form: 'Comprimido', strength: '40mg', route: 'oral', category: 'Diurético', reg: 'RENAME' },
      { name: 'Captopril', generic: 'Captopril', active: 'Captopril', form: 'Comprimido', strength: '25mg/50mg', route: 'oral', category: 'Anti-hipertensivo', reg: 'RENAME' },
      { name: 'Propranolol', generic: 'Propranolol', active: 'Cloridrato de Propranolol', form: 'Comprimido', strength: '40mg', route: 'oral', category: 'Betabloqueador', reg: 'RENAME' },
      { name: 'Atenolol', generic: 'Atenolol', active: 'Atenolol', form: 'Comprimido', strength: '50mg/100mg', route: 'oral', category: 'Betabloqueador', reg: 'RENAME' },
      { name: 'Carvedilol', generic: 'Carvedilol', active: 'Carvedilol', form: 'Comprimido', strength: '6.25mg/12.5mg/25mg', route: 'oral', category: 'Betabloqueador', reg: 'RENAME' },
      { name: 'Insulina NPH', generic: 'Insulina Humana NPH', active: 'Insulina Humana NPH', form: 'Suspensão Injetável', strength: '100 UI/mL', route: 'subcutâneo', category: 'Antidiabético', reg: 'RENAME' },
      { name: 'Insulina Regular', generic: 'Insulina Humana Regular', active: 'Insulina Humana Regular', form: 'Solução Injetável', strength: '100 UI/mL', route: 'subcutâneo', category: 'Antidiabético', reg: 'RENAME' },
      { name: 'Glibenclamida', generic: 'Glibenclamida', active: 'Glibenclamida', form: 'Comprimido', strength: '5mg', route: 'oral', category: 'Antidiabético', reg: 'RENAME' },
      { name: 'Levotiroxina', generic: 'Levotiroxina', active: 'Levotiroxina Sódica', form: 'Comprimido', strength: '25mcg/50mcg/75mcg/100mcg', route: 'oral', category: 'Hormônio Tireoidiano', reg: 'RENAME' },
      { name: 'Varfarina', generic: 'Varfarina', active: 'Varfarina Sódica', form: 'Comprimido', strength: '5mg', route: 'oral', category: 'Anticoagulante', reg: 'RENAME' },
      { name: 'AAS', generic: 'Ácido Acetilsalicílico', active: 'Ácido Acetilsalicílico', form: 'Comprimido', strength: '100mg', route: 'oral', category: 'Antiplaquetário', reg: 'RENAME' },
      { name: 'Clopidogrel', generic: 'Clopidogrel', active: 'Bissulfato de Clopidogrel', form: 'Comprimido', strength: '75mg', route: 'oral', category: 'Antiplaquetário', reg: 'RENAME' },
      { name: 'Fluoxetina', generic: 'Fluoxetina', active: 'Cloridrato de Fluoxetina', form: 'Cápsula', strength: '20mg', route: 'oral', category: 'Antidepressivo', reg: 'RENAME' },
      { name: 'Sertralina', generic: 'Sertralina', active: 'Cloridrato de Sertralina', form: 'Comprimido', strength: '50mg', route: 'oral', category: 'Antidepressivo', reg: 'RENAME' },
      { name: 'Escitalopram', generic: 'Escitalopram', active: 'Oxalato de Escitalopram', form: 'Comprimido', strength: '10mg/20mg', route: 'oral', category: 'Antidepressivo', reg: 'RENAME' },
      { name: 'Amitriptilina', generic: 'Amitriptilina', active: 'Cloridrato de Amitriptilina', form: 'Comprimido', strength: '25mg', route: 'oral', category: 'Antidepressivo', reg: 'RENAME' },
      { name: 'Clonazepam', generic: 'Clonazepam', active: 'Clonazepam', form: 'Comprimido/Solução Oral', strength: '0.5mg/2mg', route: 'oral', category: 'Benzodiazepínico', reg: 'RENAME-C1' },
      { name: 'Diazepam', generic: 'Diazepam', active: 'Diazepam', form: 'Comprimido', strength: '5mg/10mg', route: 'oral', category: 'Benzodiazepínico', reg: 'RENAME-C1' },
      { name: 'Alprazolam', generic: 'Alprazolam', active: 'Alprazolam', form: 'Comprimido', strength: '0.25mg/0.5mg/1mg', route: 'oral', category: 'Benzodiazepínico', reg: 'RENAME-B1' },
      { name: 'Haloperidol', generic: 'Haloperidol', active: 'Haloperidol', form: 'Comprimido/Solução Oral', strength: '1mg/5mg', route: 'oral', category: 'Antipsicótico', reg: 'RENAME' },
      { name: 'Risperidona', generic: 'Risperidona', active: 'Risperidona', form: 'Comprimido', strength: '1mg/2mg/3mg', route: 'oral', category: 'Antipsicótico', reg: 'RENAME' },
      { name: 'Quetiapina', generic: 'Quetiapina', active: 'Fumarato de Quetiapina', form: 'Comprimido', strength: '25mg/100mg/200mg', route: 'oral', category: 'Antipsicótico', reg: 'RENAME' },
      { name: 'Lítio', generic: 'Carbonato de Lítio', active: 'Carbonato de Lítio', form: 'Comprimido', strength: '300mg', route: 'oral', category: 'Estabilizador de Humor', reg: 'RENAME' },
      { name: 'Ácido Valpróico', generic: 'Ácido Valpróico', active: 'Ácido Valpróico / Valproato de Sódio', form: 'Comprimido/Cápsula', strength: '250mg/500mg', route: 'oral', category: 'Anticonvulsivante', reg: 'RENAME' },
      { name: 'Carbamazepina', generic: 'Carbamazepina', active: 'Carbamazepina', form: 'Comprimido', strength: '200mg/400mg', route: 'oral', category: 'Anticonvulsivante', reg: 'RENAME' },
      { name: 'Fenitoína', generic: 'Fenitoína', active: 'Fenitoína Sódica', form: 'Comprimido/Cápsula', strength: '100mg', route: 'oral', category: 'Anticonvulsivante', reg: 'RENAME' },
      { name: 'Ciprofloxacino', generic: 'Ciprofloxacino', active: 'Cloridrato de Ciprofloxacino', form: 'Comprimido', strength: '500mg', route: 'oral', category: 'Antibiótico', reg: 'RENAME' },
      { name: 'Cefalexina', generic: 'Cefalexina', active: 'Cefalexina', form: 'Cápsula/Suspensão Oral', strength: '500mg', route: 'oral', category: 'Antibiótico', reg: 'RENAME' },
      { name: 'Metronidazol', generic: 'Metronidazol', active: 'Metronidazol', form: 'Comprimido', strength: '250mg/400mg', route: 'oral', category: 'Antibiótico/Antiparasitário', reg: 'RENAME' },
      { name: 'Sulfametoxazol + Trimetoprima', generic: 'Sulfametoxazol + Trimetoprima', active: 'Sulfametoxazol + Trimetoprima', form: 'Comprimido/Suspensão Oral', strength: '400mg+80mg', route: 'oral', category: 'Antibiótico', reg: 'RENAME' },
      { name: 'Salbutamol', generic: 'Salbutamol', active: 'Sulfato de Salbutamol', form: 'Aerossol/Nebulização', strength: '100mcg/dose', route: 'inalatório', category: 'Broncodilatador', reg: 'RENAME' },
      { name: 'Beclometasona', generic: 'Beclometasona', active: 'Dipropionato de Beclometasona', form: 'Aerossol', strength: '250mcg/dose', route: 'inalatório', category: 'Corticosteroide Inalatório', reg: 'RENAME' },
      { name: 'Loratadina', generic: 'Loratadina', active: 'Loratadina', form: 'Comprimido/Xarope', strength: '10mg', route: 'oral', category: 'Anti-histamínico', reg: 'RENAME' },
      { name: 'Ranitidina', generic: 'Ranitidina', active: 'Cloridrato de Ranitidina', form: 'Comprimido', strength: '150mg', route: 'oral', category: 'Antiulceroso', reg: 'RENAME' },
      { name: 'Domperidona', generic: 'Domperidona', active: 'Domperidona', form: 'Comprimido', strength: '10mg', route: 'oral', category: 'Antiemético', reg: 'RENAME' },
      { name: 'Metoclopramida', generic: 'Metoclopramida', active: 'Cloridrato de Metoclopramida', form: 'Comprimido/Solução Oral', strength: '10mg', route: 'oral', category: 'Antiemético', reg: 'RENAME' },
      { name: 'Albendazol', generic: 'Albendazol', active: 'Albendazol', form: 'Comprimido Mastigável', strength: '400mg', route: 'oral', category: 'Anti-helmíntico', reg: 'RENAME' },
      { name: 'Ivermectina', generic: 'Ivermectina', active: 'Ivermectina', form: 'Comprimido', strength: '6mg', route: 'oral', category: 'Antiparasitário', reg: 'RENAME' },
      { name: 'Nistatina', generic: 'Nistatina', active: 'Nistatina', form: 'Suspensão Oral', strength: '100.000 UI/mL', route: 'oral', category: 'Antifúngico', reg: 'RENAME' },
      { name: 'Fluconazol', generic: 'Fluconazol', active: 'Fluconazol', form: 'Cápsula', strength: '150mg', route: 'oral', category: 'Antifúngico', reg: 'RENAME' },
      { name: 'Aciclovir', generic: 'Aciclovir', active: 'Aciclovir', form: 'Comprimido', strength: '200mg', route: 'oral', category: 'Antiviral', reg: 'RENAME' },
      { name: 'Cloreto de Sódio 0,9%', generic: 'Soro Fisiológico', active: 'Cloreto de Sódio', form: 'Solução Injetável', strength: '0,9%', route: 'intravenoso', category: 'Solução', reg: 'RENAME' },
      { name: 'Ringer Lactato', generic: 'Solução de Ringer Lactato', active: 'Cloreto de Sódio + Cloreto de Potássio + Cloreto de Cálcio + Lactato de Sódio', form: 'Solução Injetável', strength: 'Composta', route: 'intravenoso', category: 'Solução', reg: 'RENAME' },
    ];

    return renameList
      .filter(med =>
        med.name.toLowerCase().includes(termLower) ||
        med.generic.toLowerCase().includes(termLower) ||
        med.active.toLowerCase().includes(termLower)
      )
      .slice(0, limit)
      .map((med, idx) => ({
        externalId: `anvisa-rename-${idx}-${med.name.toLowerCase().replace(/\s/g, '-')}`,
        source: 'RENAME/ANVISA (Brasil)',
        name: med.name,
        genericName: med.generic,
        activeIngredient: med.active,
        dosageForm: med.form,
        strength: med.strength,
        route: med.route,
        category: med.category,
        manufacturer: 'SUS/Farmácia Popular',
        registrationNumber: med.reg,
        requiresPrescription: true,
      }));
  } catch (error) {
    console.error('[MED-SEARCH] ANVISA/RENAME error:', error);
    return [];
  }
}

export async function searchExternalMedications(
  term: string,
  locale: string = 'BR',
  limit: number = 20
): Promise<{ results: ExternalMedication[]; sources: string[] }> {
  if (!term || term.trim().length < 2) {
    return { results: [], sources: [] };
  }

  const sources: string[] = [];
  let allResults: ExternalMedication[] = [];

  const localeLower = locale.toUpperCase();

  if (localeLower === 'BR' || localeLower === 'PT') {
    const anvisaResults = await searchANVISA(term, limit);
    if (anvisaResults.length > 0) {
      allResults.push(...anvisaResults);
      sources.push('RENAME/ANVISA (Brasil)');
    }
    const rxnormResults = await searchRxNorm(term, Math.max(5, limit - anvisaResults.length));
    if (rxnormResults.length > 0) {
      allResults.push(...rxnormResults);
      sources.push('RxNorm (NLM/NIH)');
    }
  } else if (localeLower === 'US' || localeLower === 'EN') {
    const fdaResults = await searchOpenFDA(term, limit);
    if (fdaResults.length > 0) {
      allResults.push(...fdaResults);
      sources.push('OpenFDA (USA)');
    }
    const rxnormResults = await searchRxNorm(term, Math.max(5, limit - fdaResults.length));
    if (rxnormResults.length > 0) {
      allResults.push(...rxnormResults);
      sources.push('RxNorm (NLM/NIH)');
    }
  } else {
    const [rxnormResults, fdaResults] = await Promise.all([
      searchRxNorm(term, limit),
      searchOpenFDA(term, Math.floor(limit / 2)),
    ]);
    if (rxnormResults.length > 0) {
      allResults.push(...rxnormResults);
      sources.push('RxNorm (NLM/NIH)');
    }
    if (fdaResults.length > 0) {
      allResults.push(...fdaResults);
      sources.push('OpenFDA (USA)');
    }
  }

  const unique = new Map<string, ExternalMedication>();
  for (const med of allResults) {
    const key = `${med.name}-${med.strength}-${med.dosageForm}`.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, med);
    }
  }

  return {
    results: Array.from(unique.values()).slice(0, limit),
    sources,
  };
}
