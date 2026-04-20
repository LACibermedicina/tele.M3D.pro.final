import fs from 'fs';
import path from 'path';

export interface MedicationWarning {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  sideEffects?: string;
  contraindications?: string;
  adverseEffects?: string;
  interactions?: string;
  route?: string;
  pregnancyCategory?: string;
}

export interface ExamRequestData {
  patientName: string;
  date: string;
  examRequests: string;
  doctorName: string;
  doctorCRM: string;
  doctorCRMState: string;
  crmVerified?: boolean;
}

export interface MedicalCertificateData {
  patientName: string;
  patientDocument: string;
  restDays: number;
  cid10: string;
  date: string;
  doctorName: string;
  doctorCRM: string;
  doctorCRMState: string;
  crmVerified?: boolean;
}

export interface PrescriptionData {
  patientName: string;
  patientAge: number;
  patientAddress: string;
  doctorName: string;
  doctorCRM: string;
  doctorCRMState: string;
  crmVerified?: boolean;
  prescriptionText: string;
  prescriptionNumber?: string;
  date: string;
  digitalSignature?: {
    signature: string;
    certificateInfo: Record<string, unknown>;
    timestamp: string;
    qrCodeData?: string;
    documentHash?: string;
    signatureMethod?: 'rsa' | 'ecpf_a1' | 'ecpf_a3';
    professionalRegistration?: {
      country: string;
      registrationType: string;
      registrationNumber: string;
      registrationState?: string | null;
      isVerified?: boolean;
    } | null;
    ecpfCertificateInfo?: {
      subject?: string;
      issuer?: string;
      cpf?: string;
      serialNumber?: string;
      validFrom?: string;
      validTo?: string;
    } | null;
    govBr?: {
      subject?: string;
      name?: string;
      cpf?: string;
      sealLevel?: string;
      authenticatedAt?: string;
    } | null;
    signedPdfUrl?: string | null;
  };
  medications?: MedicationWarning[];
}

function maskCpf(cpf?: string | null) {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
}

export function renderUniversalSignatureBlock(
  sig: NonNullable<PrescriptionData['digitalSignature']>,
  doctor: { doctorName: string; doctorCRM: string; doctorCRMState: string; crmVerified?: boolean }
): string {
  const method = sig.signatureMethod || 'rsa';
  const reg = sig.professionalRegistration;
  const country = (reg?.country || 'BR').toUpperCase();
  const labelByMethod: Record<string, string> = {
    rsa: '✓ DOCUMENTO ASSINADO DIGITALMENTE',
    ecpf_a1: '✓ ASSINADO COM e-CPF ICP-Brasil A1',
    ecpf_a3: '✓ ASSINADO COM e-CPF ICP-Brasil A3 (Cartão/Token)',
  };
  const issuedBy = sig.ecpfCertificateInfo?.issuer || (sig.certificateInfo?.issuer as string) || 'Tele<M3D> Digital Signature Authority';
  const ts = new Date(sig.timestamp).toLocaleString('pt-BR');
  const govBrBlock = sig.govBr ? `
    <div style="margin-top:6px; padding:6px 10px; background:#eff6ff; border-left:3px solid #2563eb; font-size:9pt; color:#1e3a8a; text-align:left;">
      <strong>Confirmado via gov.br</strong> ${sig.govBr.sealLevel ? `(selo ${sig.govBr.sealLevel.toUpperCase()})` : ''}<br/>
      Titular: ${sig.govBr.name || sig.govBr.subject || '—'}${sig.govBr.cpf ? ` — CPF ${maskCpf(sig.govBr.cpf)}` : ''}<br/>
      ${sig.govBr.authenticatedAt ? `Autenticado em: ${new Date(sig.govBr.authenticatedAt).toLocaleString('pt-BR')}` : ''}
    </div>
  ` : '';
  const ecpfBlock = sig.ecpfCertificateInfo ? `
    <div style="margin-top:6px; padding:6px 10px; background:#ecfdf5; border-left:3px solid #059669; font-size:9pt; color:#064e3b; text-align:left;">
      <strong>Certificado ICP-Brasil</strong><br/>
      Titular: ${sig.ecpfCertificateInfo.subject || '—'}${sig.ecpfCertificateInfo.cpf ? ` — CPF ${maskCpf(sig.ecpfCertificateInfo.cpf)}` : ''}<br/>
      Emissor: ${sig.ecpfCertificateInfo.issuer || '—'}<br/>
      ${sig.ecpfCertificateInfo.serialNumber ? `Série: ${sig.ecpfCertificateInfo.serialNumber}<br/>` : ''}
      ${sig.ecpfCertificateInfo.validTo ? `Válido até: ${new Date(sig.ecpfCertificateInfo.validTo).toLocaleDateString('pt-BR')}` : ''}
    </div>
  ` : '';
  const registrationLine = reg
    ? `${reg.registrationType.toUpperCase()} ${reg.registrationNumber}${reg.registrationState ? `/${reg.registrationState}` : ''} — ${country}${reg.isVerified ? ' ✓ Verificado' : ''}`
    : `Nº Registro: ${doctor.doctorCRM}/${doctor.doctorCRMState}${doctor.crmVerified ? ' ✓ Registro Verificado' : ''}`;

  return `
    <div class="digital-signature">
      ${labelByMethod[method] || labelByMethod.rsa}<br/>
      Emissor: ${issuedBy}<br/>
      Timestamp: ${ts}
    </div>
    ${ecpfBlock}
    ${govBrBlock}
    <div class="signature-line"></div>
    <div class="signature-name">${doctor.doctorName}</div>
    <div class="signature-crm">${registrationLine}</div>
  `;
}

export class PDFGeneratorService {
  
  async generatePrescriptionPDF(data: PrescriptionData): Promise<string> {
    // Generate HTML content for the prescription
    const htmlContent = this.generatePrescriptionHTML(data);
    
    // Return the HTML content (can be converted to PDF by frontend)
    return htmlContent;
  }

  private generatePrescriptionHTML(data: PrescriptionData): string {
    const logoPath = '/assets/telemed-logo.png'; // Logo path for the clinic
    
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receita Médica - ${data.patientName}</title>
        <style>
          @page {
            size: A4;
            margin: 2cm;
          }
          
          body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.4;
            color: #000;
            background: white;
            margin: 0;
            padding: 0;
          }
          
          .prescription-header {
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
            text-align: center;
          }
          
          .clinic-logo {
            max-height: 60px;
            margin-bottom: 10px;
          }
          
          .clinic-name {
            font-size: 18pt;
            font-weight: bold;
            color: #2563eb;
            margin: 10px 0;
          }
          
          .clinic-info {
            font-size: 10pt;
            color: #666;
            margin-bottom: 5px;
          }
          
          .doctor-info {
            text-align: center;
            margin-bottom: 30px;
            padding: 15px;
            background-color: #f8f9ff;
            border-radius: 8px;
          }
          
          .doctor-name {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .doctor-crm {
            font-size: 11pt;
            color: #666;
          }
          
          .patient-info {
            margin-bottom: 30px;
            border: 1px solid #ddd;
            padding: 15px;
            border-radius: 8px;
          }
          
          .patient-label {
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
            font-size: 13pt;
          }
          
          .patient-details {
            line-height: 1.6;
          }
          
          .prescription-content {
            min-height: 300px;
            margin-bottom: 40px;
            padding: 20px;
            border: 2px dashed #ccc;
            border-radius: 8px;
          }
          
          .prescription-label {
            font-weight: bold;
            font-size: 14pt;
            color: #2563eb;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .prescription-text {
            font-size: 12pt;
            line-height: 1.8;
            white-space: pre-wrap;
          }
          
          .signature-section {
            margin-top: 60px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          
          .signature-box {
            text-align: center;
            width: 300px;
          }
          
          .signature-line {
            border-top: 1px solid #000;
            margin-bottom: 8px;
            height: 50px;
            position: relative;
          }
          
          .digital-signature {
            background-color: #e8f4fd;
            border: 1px solid #2563eb;
            padding: 10px;
            border-radius: 4px;
            font-size: 9pt;
            color: #2563eb;
            margin-bottom: 10px;
          }
          
          .signature-name {
            font-weight: bold;
            font-size: 11pt;
          }
          
          .signature-crm {
            font-size: 10pt;
            color: #666;
          }
          
          .date-location {
            text-align: right;
            margin-bottom: 20px;
            font-size: 11pt;
          }
          
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 9pt;
            color: #666;
            border-top: 1px solid #eee;
            padding-top: 15px;
          }
          
          .qr-code-section {
            position: absolute;
            top: 20px;
            right: 20px;
            text-align: center;
          }
          
          .qr-placeholder {
            width: 80px;
            height: 80px;
            border: 2px dashed #ccc;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8pt;
            color: #666;
          }
          
          @media print {
            body {
              -webkit-print-color-adjust: exact;
            }
            
            .prescription-content {
              border-style: solid;
            }
          }
        </style>
      </head>
      <body>
        <div class="qr-code-section">
          ${data.digitalSignature?.qrCodeData ? `
            <img src="${data.digitalSignature.qrCodeData}" alt="QR Code Verificação" style="width: 100px; height: 100px;" />
            <div style="font-size: 7pt; color: #666; margin-top: 4px;">Escaneie para verificar</div>
          ` : `
            <div class="qr-placeholder">QR Code<br/>Verificação</div>
          `}
        </div>
        
        <div class="prescription-header">
          <div class="clinic-name">TELE&lt;M3D&gt; - Sistema de Telemedicina</div>
          <div class="clinic-info">Plataforma Digital de Saúde | Atendimento Médico Especializado</div>
          <div class="clinic-info">www.telemed.com.br | contato@telemed.com.br</div>
        </div>
        
        <div class="doctor-info">
          <div class="doctor-name">${data.doctorName}</div>
          <div class="doctor-crm">Nº Registro: ${data.doctorCRM}/${data.doctorCRMState}${data.crmVerified ? ' ✓ Registro Verificado' : ''}</div>
        </div>
        
        <div class="patient-info">
          <div class="patient-label">DADOS DO PACIENTE</div>
          <div class="patient-details">
            <strong>Nome:</strong> ${data.patientName}<br/>
            <strong>Idade:</strong> ${data.patientAge} anos<br/>
            <strong>Endereço:</strong> ${data.patientAddress}
          </div>
        </div>
        
        <div class="date-location">
          São Paulo, ${data.date}
        </div>
        
        <div class="prescription-content">
          <div class="prescription-label">RECEITUÁRIO MÉDICO</div>
          ${data.prescriptionNumber ? `<div style="font-size: 10pt; color: #666; margin-bottom: 10px;">Nº ${data.prescriptionNumber}</div>` : ''}
          <div class="prescription-text">${data.prescriptionText}</div>
        </div>

        ${data.medications && data.medications.length > 0 ? `
        <div style="margin-bottom: 30px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fefce8;">
          <div style="font-weight: bold; font-size: 12pt; color: #92400e; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
            ⚠ ADVERTÊNCIAS E INFORMAÇÕES FARMACÊUTICAS
          </div>
          ${data.medications.map((med, i) => `
            <div style="margin-bottom: 12px; padding: 10px; background: white; border-radius: 6px; border-left: 3px solid #f59e0b;">
              <div style="font-weight: bold; font-size: 11pt; margin-bottom: 5px;">${i + 1}. ${med.name}</div>
              <div style="font-size: 10pt; line-height: 1.5;">
                <strong>Posologia:</strong> ${med.dosage} - ${med.frequency} por ${med.duration}<br/>
                ${med.route ? `<strong>Via:</strong> ${med.route}<br/>` : ''}
                <strong>Instruções:</strong> ${med.instructions}
                ${med.sideEffects ? `<br/><strong>Efeitos Colaterais:</strong> <span style="color: #b45309;">${med.sideEffects}</span>` : ''}
                ${med.contraindications ? `<br/><strong>Contraindicações:</strong> <span style="color: #dc2626;">${med.contraindications}</span>` : ''}
                ${med.adverseEffects ? `<br/><strong>Efeitos Adversos:</strong> <span style="color: #dc2626;">${med.adverseEffects}</span>` : ''}
                ${med.interactions ? `<br/><strong>Interações:</strong> <span style="color: #9333ea;">${med.interactions}</span>` : ''}
                ${med.pregnancyCategory ? `<br/><strong>Categoria na Gravidez:</strong> ${med.pregnancyCategory}` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div style="margin-bottom: 30px; padding: 15px; border: 2px dashed #94a3b8; border-radius: 8px; background: #f8fafc;">
          <div style="font-weight: bold; font-size: 12pt; color: #475569; margin-bottom: 10px; text-transform: uppercase;">
            SEÇÃO DA FARMÁCIA (Preenchimento pelo Farmacêutico)
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 10pt;">
            <div><strong>Farmacêutico(a):</strong> ___________________________</div>
            <div><strong>CRF:</strong> ___________________________</div>
            <div><strong>Data da Dispensação:</strong> ____/____/________</div>
            <div><strong>Lote:</strong> ___________________________</div>
            <div><strong>Fabricante:</strong> ___________________________</div>
            <div><strong>Validade:</strong> ____/____/________</div>
          </div>
          <div style="margin-top: 10px; font-size: 10pt;">
            <strong>Observações:</strong> _______________________________________________
          </div>
          <div style="margin-top: 15px; text-align: center;">
            <div style="border-top: 1px solid #94a3b8; width: 250px; margin: 0 auto; padding-top: 5px; font-size: 10pt;">
              Assinatura e Carimbo do Farmacêutico
            </div>
          </div>
        </div>
        
        <div class="signature-section">
          <div style="flex: 1;"></div>
          <div class="signature-box">
            ${data.digitalSignature ? renderUniversalSignatureBlock(data.digitalSignature, { doctorName: data.doctorName, doctorCRM: data.doctorCRM, doctorCRMState: data.doctorCRMState, crmVerified: data.crmVerified }) : `
              <div class="signature-line"></div>
              <div class="signature-name">${data.doctorName}</div>
              <div class="signature-crm">Nº Registro: ${data.doctorCRM}/${data.doctorCRMState}${data.crmVerified ? ' ✓ Registro Verificado' : ''}</div>
            `}
          </div>
        </div>
        
        <div class="footer">
          <div>Esta receita foi gerada digitalmente pelo sistema TELEMED</div>
          ${data.digitalSignature ? `
            <div>Receita assinada digitalmente conforme MP 2.200-2/2001 e Lei 14.063/2020</div>
            <div style="font-size: 8pt; margin-top: 5px;">
              Hash do documento: ${data.digitalSignature.signature.substring(0, 32)}...
            </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
  }

  async generateExamRequestPDF(examData: ExamRequestData): Promise<string> {
    // Similar structure for exam requests
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Solicitação de Exame - ${examData.patientName}</title>
        <style>
          /* Similar styling as prescription */
          body { font-family: 'Times New Roman', serif; font-size: 12pt; }
          .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
          .exam-content { min-height: 200px; padding: 20px; border: 2px solid #ccc; margin: 30px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>SOLICITAÇÃO DE EXAME</h2>
          <p>TELE&lt;M3D&gt; - Sistema de Telemedicina</p>
        </div>
        
        <div class="patient-info">
          <p><strong>Paciente:</strong> ${examData.patientName}</p>
          <p><strong>Data:</strong> ${examData.date}</p>
        </div>
        
        <div class="exam-content">
          <h3>EXAMES SOLICITADOS:</h3>
          <div>${examData.examRequests}</div>
        </div>
        
        <div class="signature">
          <p>Médico: ${examData.doctorName}</p>
          <p>Nº Registro: ${examData.doctorCRM}/${examData.doctorCRMState}${examData.crmVerified ? ' ✓ Registro Verificado' : ''}</p>
        </div>
      </body>
      </html>
    `;
  }

  async generateMedicalCertificatePDF(certificateData: MedicalCertificateData): Promise<string> {
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Atestado Médico - ${certificateData.patientName}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; text-align: justify; }
          .header { text-align: center; margin-bottom: 40px; }
          .content { margin: 40px 0; line-height: 1.8; }
          .signature { margin-top: 80px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>ATESTADO MÉDICO</h2>
          <p>TELE&lt;M3D&gt; - Sistema de Telemedicina</p>
        </div>
        
        <div class="content">
          <p>Atesto que o(a) Sr(a). <strong>${certificateData.patientName}</strong>, 
          portador(a) do documento de identidade nº ${certificateData.patientDocument}, 
          foi por mim examinado(a) nesta data, apresentando quadro clínico que o(a) 
          impossibilita de exercer suas atividades habituais por um período de 
          <strong>${certificateData.restDays} dias</strong>.</p>
          
          <p>CID-10: ${certificateData.cid10 || 'Não especificado'}</p>
          
          <p>Por ser verdade, firmo o presente atestado.</p>
        </div>
        
        <div class="signature">
          <p>São Paulo, ${certificateData.date}</p>
          <br/><br/>
          <p>_________________________________</p>
          <p><strong>${certificateData.doctorName}</strong></p>
          <p>Nº Registro: ${certificateData.doctorCRM}/${certificateData.doctorCRMState}${certificateData.crmVerified ? ' ✓ Registro Verificado' : ''}</p>
        </div>
      </body>
      </html>
    `;
  }
}

export const pdfGeneratorService = new PDFGeneratorService();