import { db } from '../db';
import { medicalRecords, patients, users, appointments } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

interface PMDData {
  id_paciente: string;
  medico_crm: string;
  paciente: {
    nome: string;
    dt_nasc: string;
    sexo: string;
    endereco: string;
    contato: string;
    nome_mae?: string;
    dni?: string;
    vacinas?: string[];
    cpf?: string;
    rg?: string;
    sus_card?: string;
  };
  clinico: {
    anamnese: string;
    historico: string;
    exames: string;
    diagnostico: string;
    tratamento: string;
    evolucoes: Array<{
      data: string;
      medico: string;
      descricao: string;
    }>;
  };
  logs: Array<{
    timestamp: string;
    user: string;
    acao: string;
    antigo: string;
    novo: string;
  }>;
}

export type ExportLocale = 'BR' | 'ES' | 'USA';
export type ExportFormat = 'PDF' | 'JSON' | 'XML' | 'CSV';

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function sanitizeForExport(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[<>&"']/g, c => {
    const map: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
    return map[c] || c;
  });
}

function buildPMDFromRecord(record: any, patient: any, doctor: any): PMDData {
  const pmdStored = record.pmdData as PMDData | null;
  const auditLogs = (record.pmdAuditLogs || []) as PMDData['logs'];

  const evolucoes = pmdStored?.clinico?.evolucoes || [];
  if (record.observations && !evolucoes.find((e: any) => e.descricao === record.observations)) {
    evolucoes.push({
      data: formatDate(record.updatedAt || record.createdAt),
      medico: doctor?.medicalLicense || doctor?.name || 'N/A',
      descricao: record.observations
    });
  }

  return {
    id_paciente: patient?.id || record.patientId,
    medico_crm: doctor?.medicalLicense || 'N/A',
    paciente: {
      nome: pmdStored?.paciente?.nome || patient?.name || 'N/A',
      dt_nasc: pmdStored?.paciente?.dt_nasc || formatDate(patient?.dateOfBirth),
      sexo: pmdStored?.paciente?.sexo || patient?.gender || 'N/A',
      endereco: pmdStored?.paciente?.endereco || 'Não informado',
      contato: pmdStored?.paciente?.contato || patient?.phone || patient?.email || 'N/A',
      nome_mae: pmdStored?.paciente?.nome_mae,
      dni: pmdStored?.paciente?.dni,
      vacinas: pmdStored?.paciente?.vacinas,
      cpf: pmdStored?.paciente?.cpf,
      rg: pmdStored?.paciente?.rg,
      sus_card: pmdStored?.paciente?.sus_card,
    },
    clinico: {
      anamnese: pmdStored?.clinico?.anamnese || record.symptoms || '',
      historico: pmdStored?.clinico?.historico || (patient?.medicalHistory ? JSON.stringify(patient.medicalHistory) : ''),
      exames: pmdStored?.clinico?.exames || '',
      diagnostico: pmdStored?.clinico?.diagnostico || record.diagnosis || '',
      tratamento: pmdStored?.clinico?.tratamento || record.treatment || '',
      evolucoes
    },
    logs: auditLogs
  };
}

function generateBRFields(pmd: PMDData): Record<string, string> {
  return {
    'Regulamentação': 'CFM (Conselho Federal de Medicina)',
    'Nome da Mãe': pmd.paciente.nome_mae || 'Não informado',
    'CRM Médico': pmd.medico_crm,
    'CPF': pmd.paciente.cpf || 'Não informado',
    'RG': pmd.paciente.rg || 'Não informado',
    'Cartão SUS': pmd.paciente.sus_card || 'Não informado',
    'Conformidade': 'LGPD (Lei 13.709/2018)',
  };
}

function generateESFields(pmd: PMDData): Record<string, string> {
  return {
    'Regulación': 'RGPD (Reglamento General de Protección de Datos)',
    'DNI': pmd.paciente.dni || 'No informado',
    'Vacunas': (pmd.paciente.vacinas || []).join(', ') || 'No informado',
    'Médico Colegiado': pmd.medico_crm,
    'Conformidad': 'RGPD (UE 2016/679)',
  };
}

function generateUSAFields(pmd: PMDData): Record<string, string> {
  return {
    'Regulation': 'HIPAA (Health Insurance Portability and Accountability Act)',
    'Provider NPI': pmd.medico_crm,
    'Compliance': 'HIPAA / 45 CFR Part 164',
  };
}

function getLocaleFields(pmd: PMDData, locale: ExportLocale): Record<string, string> {
  switch (locale) {
    case 'ES': return generateESFields(pmd);
    case 'USA': return generateUSAFields(pmd);
    case 'BR':
    default: return generateBRFields(pmd);
  }
}

function getLocaleLabels(locale: ExportLocale) {
  switch (locale) {
    case 'ES':
      return {
        title: 'Prontuario Médico Digital',
        subtitle: 'PMD v1.0 — Conforme RGPD',
        patient: 'Paciente', dob: 'Fecha Nac.', gender: 'Sexo', address: 'Dirección', contact: 'Contacto',
        doctor: 'Médico', crm: 'Colegiado',
        anamnesis: 'Anamnesis', history: 'Historial', exams: 'Exámenes', diagnosis: 'Diagnóstico',
        treatment: 'Tratamiento', evolutions: 'Evoluciones', date: 'Fecha', description: 'Descripción',
        logs: 'Registro de Auditoría', action: 'Acción', old: 'Anterior', new: 'Nuevo', user: 'Usuario',
        regulation: 'Información Regulatoria', generated: 'Generado en',
      };
    case 'USA':
      return {
        title: 'Digital Medical Record',
        subtitle: 'PMD v1.0 — HIPAA Compliant',
        patient: 'Patient', dob: 'Date of Birth', gender: 'Gender', address: 'Address', contact: 'Contact',
        doctor: 'Provider', crm: 'License/NPI',
        anamnesis: 'Anamnesis', history: 'Medical History', exams: 'Exams/Labs', diagnosis: 'Diagnosis',
        treatment: 'Treatment Plan', evolutions: 'Progress Notes', date: 'Date', description: 'Description',
        logs: 'Audit Trail', action: 'Action', old: 'Previous', new: 'New', user: 'User',
        regulation: 'Regulatory Information', generated: 'Generated on',
      };
    case 'BR':
    default:
      return {
        title: 'Prontuário Médico Digital',
        subtitle: 'PMD v1.0 — Conforme CFM/LGPD/RGPD',
        patient: 'Paciente', dob: 'Data Nasc.', gender: 'Sexo', address: 'Endereço', contact: 'Contato',
        doctor: 'Médico', crm: 'CRM',
        anamnesis: 'Anamnese', history: 'Histórico', exams: 'Exames', diagnosis: 'Diagnóstico',
        treatment: 'Tratamento', evolutions: 'Evoluções', date: 'Data', description: 'Descrição',
        logs: 'Log de Auditoria', action: 'Ação', old: 'Anterior', new: 'Novo', user: 'Usuário',
        regulation: 'Informações Regulatórias', generated: 'Gerado em',
      };
  }
}

export function exportToJSON(pmd: PMDData, locale: ExportLocale, includeLogs: boolean): string {
  const output: any = {
    pmd_version: '1.0',
    locale,
    id_paciente: pmd.id_paciente,
    medico_crm: pmd.medico_crm,
    paciente: pmd.paciente,
    clinico: pmd.clinico,
    regulatorio: getLocaleFields(pmd, locale),
    exportado_em: new Date().toISOString(),
  };
  if (includeLogs) {
    output.logs = pmd.logs;
  }
  return JSON.stringify(output, null, 2);
}

export function exportToXML(pmd: PMDData, locale: ExportLocale, includeLogs: boolean): string {
  const s = sanitizeForExport;
  const localeFields = getLocaleFields(pmd, locale);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ProntuarioMedicoDigital version="1.0" locale="${locale}">\n`;
  xml += `  <IdPaciente>${s(pmd.id_paciente)}</IdPaciente>\n`;
  xml += `  <MedicoCRM>${s(pmd.medico_crm)}</MedicoCRM>\n`;
  xml += `  <Paciente>\n`;
  xml += `    <Nome>${s(pmd.paciente.nome)}</Nome>\n`;
  xml += `    <DataNascimento>${s(pmd.paciente.dt_nasc)}</DataNascimento>\n`;
  xml += `    <Sexo>${s(pmd.paciente.sexo)}</Sexo>\n`;
  xml += `    <Endereco>${s(pmd.paciente.endereco)}</Endereco>\n`;
  xml += `    <Contato>${s(pmd.paciente.contato)}</Contato>\n`;
  if (pmd.paciente.nome_mae) xml += `    <NomeMae>${s(pmd.paciente.nome_mae)}</NomeMae>\n`;
  if (pmd.paciente.cpf) xml += `    <CPF>${s(pmd.paciente.cpf)}</CPF>\n`;
  if (pmd.paciente.dni) xml += `    <DNI>${s(pmd.paciente.dni)}</DNI>\n`;
  if (pmd.paciente.vacinas?.length) {
    xml += `    <Vacinas>\n`;
    pmd.paciente.vacinas.forEach(v => { xml += `      <Vacina>${s(v)}</Vacina>\n`; });
    xml += `    </Vacinas>\n`;
  }
  xml += `  </Paciente>\n`;
  xml += `  <Clinico>\n`;
  xml += `    <Anamnese>${s(pmd.clinico.anamnese)}</Anamnese>\n`;
  xml += `    <Historico>${s(pmd.clinico.historico)}</Historico>\n`;
  xml += `    <Exames>${s(pmd.clinico.exames)}</Exames>\n`;
  xml += `    <Diagnostico>${s(pmd.clinico.diagnostico)}</Diagnostico>\n`;
  xml += `    <Tratamento>${s(pmd.clinico.tratamento)}</Tratamento>\n`;
  xml += `    <Evolucoes>\n`;
  pmd.clinico.evolucoes.forEach(ev => {
    xml += `      <Evolucao>\n`;
    xml += `        <Data>${s(ev.data)}</Data>\n`;
    xml += `        <Medico>${s(ev.medico)}</Medico>\n`;
    xml += `        <Descricao>${s(ev.descricao)}</Descricao>\n`;
    xml += `      </Evolucao>\n`;
  });
  xml += `    </Evolucoes>\n`;
  xml += `  </Clinico>\n`;
  xml += `  <Regulatorio>\n`;
  Object.entries(localeFields).forEach(([k, v]) => {
    xml += `    <${k.replace(/\s/g, '_')}>${s(v)}</${k.replace(/\s/g, '_')}>\n`;
  });
  xml += `  </Regulatorio>\n`;
  if (includeLogs && pmd.logs.length > 0) {
    xml += `  <Logs>\n`;
    pmd.logs.forEach(log => {
      xml += `    <Log>\n`;
      xml += `      <Timestamp>${s(log.timestamp)}</Timestamp>\n`;
      xml += `      <User>${s(log.user)}</User>\n`;
      xml += `      <Acao>${s(log.acao)}</Acao>\n`;
      xml += `      <Antigo>${s(log.antigo)}</Antigo>\n`;
      xml += `      <Novo>${s(log.novo)}</Novo>\n`;
      xml += `    </Log>\n`;
    });
    xml += `  </Logs>\n`;
  }
  xml += `  <ExportadoEm>${new Date().toISOString()}</ExportadoEm>\n`;
  xml += `</ProntuarioMedicoDigital>`;
  return xml;
}

export function exportToCSV(pmd: PMDData, locale: ExportLocale, includeLogs: boolean): string {
  const localeFields = getLocaleFields(pmd, locale);
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  let csv = '';

  csv += 'Seção,Campo,Valor\n';
  csv += `Identificação,ID Paciente,${escape(pmd.id_paciente)}\n`;
  csv += `Identificação,CRM Médico,${escape(pmd.medico_crm)}\n`;
  csv += `Paciente,Nome,${escape(pmd.paciente.nome)}\n`;
  csv += `Paciente,Data Nascimento,${escape(pmd.paciente.dt_nasc)}\n`;
  csv += `Paciente,Sexo,${escape(pmd.paciente.sexo)}\n`;
  csv += `Paciente,Endereço,${escape(pmd.paciente.endereco)}\n`;
  csv += `Paciente,Contato,${escape(pmd.paciente.contato)}\n`;
  if (pmd.paciente.nome_mae) csv += `Paciente,Nome da Mãe,${escape(pmd.paciente.nome_mae)}\n`;
  if (pmd.paciente.cpf) csv += `Paciente,CPF,${escape(pmd.paciente.cpf)}\n`;
  if (pmd.paciente.dni) csv += `Paciente,DNI,${escape(pmd.paciente.dni)}\n`;
  csv += `Clínico,Anamnese,${escape(pmd.clinico.anamnese)}\n`;
  csv += `Clínico,Histórico,${escape(pmd.clinico.historico)}\n`;
  csv += `Clínico,Exames,${escape(pmd.clinico.exames)}\n`;
  csv += `Clínico,Diagnóstico,${escape(pmd.clinico.diagnostico)}\n`;
  csv += `Clínico,Tratamento,${escape(pmd.clinico.tratamento)}\n`;

  if (pmd.clinico.evolucoes.length > 0) {
    csv += '\nEvoluções\nData,Médico,Descrição\n';
    pmd.clinico.evolucoes.forEach(ev => {
      csv += `${escape(ev.data)},${escape(ev.medico)},${escape(ev.descricao)}\n`;
    });
  }

  csv += '\nInformações Regulatórias\nCampo,Valor\n';
  Object.entries(localeFields).forEach(([k, v]) => {
    csv += `${escape(k)},${escape(v)}\n`;
  });

  if (includeLogs && pmd.logs.length > 0) {
    csv += '\nLog de Auditoria\nTimestamp,Usuário,Ação,Anterior,Novo\n';
    pmd.logs.forEach(log => {
      csv += `${escape(log.timestamp)},${escape(log.user)},${escape(log.acao)},${escape(log.antigo)},${escape(log.novo)}\n`;
    });
  }

  return csv;
}

export function exportToPDFHtml(pmd: PMDData, locale: ExportLocale, includeLogs: boolean): string {
  const labels = getLocaleLabels(locale);
  const localeFields = getLocaleFields(pmd, locale);

  let html = `<!DOCTYPE html>
<html lang="${locale === 'ES' ? 'es' : locale === 'USA' ? 'en' : 'pt-BR'}">
<head>
<meta charset="UTF-8">
<title>${labels.title} — ${pmd.paciente.nome}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; border-bottom: 3px solid #1e3a5f; padding-bottom: 15px; margin-bottom: 20px; }
  .header h1 { margin: 0; font-size: 20pt; color: #1e3a5f; }
  .header p { margin: 4px 0; color: #555; font-size: 9pt; }
  .section { margin-bottom: 18px; }
  .section h2 { font-size: 13pt; color: #1e3a5f; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10pt; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  th { background-color: #f0f4f8; color: #1e3a5f; font-weight: 600; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 8pt; font-weight: bold; }
  .badge-cfm { background: #e3f2fd; color: #0d47a1; }
  .badge-lgpd { background: #e8f5e9; color: #1b5e20; }
  .badge-rgpd { background: #fff3e0; color: #e65100; }
  .badge-hipaa { background: #fce4ec; color: #880e4f; }
  .footer { text-align: center; font-size: 8pt; color: #999; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 30px; }
  .clinical-field { margin-bottom: 8px; }
  .clinical-field label { font-weight: 600; color: #1e3a5f; display: block; margin-bottom: 2px; }
  .clinical-field .value { background: #fafafa; border: 1px solid #eee; padding: 6px 10px; border-radius: 4px; min-height: 20px; white-space: pre-wrap; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>
<div class="header">
  <h1>${labels.title}</h1>
  <p>${labels.subtitle}</p>
  <p>ID: ${pmd.id_paciente} | ${labels.crm}: ${pmd.medico_crm}</p>
</div>

<div class="section">
  <h2>${labels.patient}</h2>
  <table>
    <tr><th>${labels.patient}</th><td>${sanitizeForExport(pmd.paciente.nome)}</td></tr>
    <tr><th>${labels.dob}</th><td>${sanitizeForExport(pmd.paciente.dt_nasc)}</td></tr>
    <tr><th>${labels.gender}</th><td>${sanitizeForExport(pmd.paciente.sexo)}</td></tr>
    <tr><th>${labels.address}</th><td>${sanitizeForExport(pmd.paciente.endereco)}</td></tr>
    <tr><th>${labels.contact}</th><td>${sanitizeForExport(pmd.paciente.contato)}</td></tr>`;

  Object.entries(localeFields).forEach(([k, v]) => {
    html += `\n    <tr><th>${sanitizeForExport(k)}</th><td>${sanitizeForExport(v)}</td></tr>`;
  });

  html += `
  </table>
</div>

<div class="section">
  <h2>${labels.anamnesis} / ${labels.diagnosis}</h2>
  <div class="clinical-field"><label>${labels.anamnesis}</label><div class="value">${sanitizeForExport(pmd.clinico.anamnese) || '—'}</div></div>
  <div class="clinical-field"><label>${labels.history}</label><div class="value">${sanitizeForExport(pmd.clinico.historico) || '—'}</div></div>
  <div class="clinical-field"><label>${labels.exams}</label><div class="value">${sanitizeForExport(pmd.clinico.exames) || '—'}</div></div>
  <div class="clinical-field"><label>${labels.diagnosis}</label><div class="value">${sanitizeForExport(pmd.clinico.diagnostico) || '—'}</div></div>
  <div class="clinical-field"><label>${labels.treatment}</label><div class="value">${sanitizeForExport(pmd.clinico.tratamento) || '—'}</div></div>
</div>`;

  if (pmd.clinico.evolucoes.length > 0) {
    html += `
<div class="section">
  <h2>${labels.evolutions}</h2>
  <table>
    <thead><tr><th>${labels.date}</th><th>${labels.doctor}</th><th>${labels.description}</th></tr></thead>
    <tbody>`;
    pmd.clinico.evolucoes.forEach(ev => {
      html += `\n      <tr><td>${sanitizeForExport(ev.data)}</td><td>${sanitizeForExport(ev.medico)}</td><td>${sanitizeForExport(ev.descricao)}</td></tr>`;
    });
    html += `
    </tbody>
  </table>
</div>`;
  }

  if (includeLogs && pmd.logs.length > 0) {
    html += `
<div class="section">
  <h2>${labels.logs}</h2>
  <table>
    <thead><tr><th>Timestamp</th><th>${labels.user}</th><th>${labels.action}</th><th>${labels.old}</th><th>${labels.new}</th></tr></thead>
    <tbody>`;
    pmd.logs.forEach(log => {
      html += `\n      <tr><td>${sanitizeForExport(log.timestamp)}</td><td>${sanitizeForExport(log.user)}</td><td>${sanitizeForExport(log.acao)}</td><td>${sanitizeForExport(log.antigo)}</td><td>${sanitizeForExport(log.novo)}</td></tr>`;
    });
    html += `
    </tbody>
  </table>
</div>`;
  }

  html += `
<div class="footer">
  <p>${labels.generated}: ${new Date().toISOString()} | PMD v1.0 | Tele&lt;M3D&gt; Pro</p>
</div>
</body>
</html>`;

  return html;
}

export const pmdExportService = {
  buildPMDFromRecord,
  exportToJSON,
  exportToXML,
  exportToCSV,
  exportToPDFHtml,
  getLocaleFields,
  getLocaleLabels,
};
