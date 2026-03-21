import { db } from '../db';
import { users, systemSettings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface CRMVerificationResult {
  status: 'verified' | 'failed' | 'pending' | 'unverified';
  data?: {
    name?: string;
    registrationNumber?: string;
    state?: string;
    specialty?: string;
    situation?: string;
    registrationDate?: string;
    apiSource?: string;
  };
  error?: string;
}

interface CRMConfig {
  enabled: boolean;
  countries: {
    BR: {
      enabled: boolean;
      apiUrl: string;
      apiKey: string;
      provider: string;
    };
    PT: {
      enabled: boolean;
      apiUrl: string;
      apiKey: string;
      provider: string;
    };
  };
}

const DEFAULT_CRM_CONFIG: CRMConfig = {
  enabled: true,
  countries: {
    BR: {
      enabled: true,
      apiUrl: 'https://www.consultacrm.com.br/api/index.php',
      apiKey: '',
      provider: 'CFM',
    },
    PT: {
      enabled: false,
      apiUrl: '',
      apiKey: '',
      provider: 'Ordem dos Médicos',
    },
  },
};

export class CRMVerificationService {
  async getConfig(): Promise<CRMConfig> {
    try {
      const setting = await db.select().from(systemSettings)
        .where(eq(systemSettings.settingKey, 'crm_verification_config'))
        .limit(1);

      if (setting.length > 0 && setting[0].settingValue) {
        const parsed = JSON.parse(setting[0].settingValue);
        return { ...DEFAULT_CRM_CONFIG, ...parsed };
      }
    } catch (e) {
      console.error('Error loading CRM config:', e);
    }
    return DEFAULT_CRM_CONFIG;
  }

  async saveConfig(config: CRMConfig, updatedBy?: string): Promise<void> {
    const existing = await db.select().from(systemSettings)
      .where(eq(systemSettings.settingKey, 'crm_verification_config'))
      .limit(1);

    if (existing.length > 0) {
      await db.update(systemSettings)
        .set({
          settingValue: JSON.stringify(config),
          updatedBy: updatedBy || null,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.settingKey, 'crm_verification_config'));
    } else {
      await db.insert(systemSettings).values({
        settingKey: 'crm_verification_config',
        settingValue: JSON.stringify(config),
        settingType: 'json',
        description: 'Configuração de verificação de registro profissional (CRM)',
        category: 'crm_verification',
        isEditable: true,
        updatedBy: updatedBy || null,
      });
    }
  }

  async verifyDoctor(userId: string): Promise<CRMVerificationResult> {
    const config = await this.getConfig();
    
    if (!config.enabled) {
      return { status: 'unverified', error: 'Verificação CRM desabilitada' };
    }

    const [doctor] = await db.select().from(users).where(eq(users.id, userId));
    if (!doctor) {
      return { status: 'failed', error: 'Médico não encontrado' };
    }

    if (doctor.role !== 'doctor') {
      return { status: 'failed', error: 'Usuário não é médico' };
    }

    if (!doctor.medicalLicense) {
      return { status: 'failed', error: 'CRM não informado no perfil' };
    }

    await db.update(users)
      .set({ crmVerificationStatus: 'pending' })
      .where(eq(users.id, userId));

    const crmNumber = this.extractCRMNumber(doctor.medicalLicense);
    const crmState = doctor.medicalLicenseState || this.extractCRMState(doctor.medicalLicense);
    const country = (doctor.documentCountry || 'BR').toUpperCase();

    try {
      let result: CRMVerificationResult;
      if (country === 'PT' && config.countries.PT.enabled) {
        result = await this.verifyCRMPortugal(crmNumber, config);
      } else {
        result = await this.verifyCRMBrazil(crmNumber, crmState, config);
      }

      await db.update(users)
        .set({
          crmVerificationStatus: result.status,
          crmVerifiedAt: result.status === 'verified' ? new Date() : null,
          crmVerificationData: result.data || null,
          medicalLicenseState: crmState || doctor.medicalLicenseState,
        })
        .where(eq(users.id, userId));

      return result;
    } catch (error: any) {
      const failResult: CRMVerificationResult = {
        status: 'failed',
        error: error.message || 'Erro na verificação',
      };

      await db.update(users)
        .set({
          crmVerificationStatus: 'failed',
          crmVerificationData: { error: failResult.error, timestamp: new Date().toISOString() },
        })
        .where(eq(users.id, userId));

      return failResult;
    }
  }

  async getVerificationStatus(userId: string): Promise<CRMVerificationResult> {
    const [doctor] = await db.select().from(users).where(eq(users.id, userId));
    if (!doctor) {
      return { status: 'unverified', error: 'Usuário não encontrado' };
    }

    return {
      status: (doctor.crmVerificationStatus || 'unverified') as CRMVerificationResult['status'],
      data: doctor.crmVerificationData as CRMVerificationResult['data'],
    };
  }

  private extractCRMNumber(license: string): string {
    const match = license.replace(/[^\d]/g, '');
    return match || license;
  }

  private extractCRMState(license: string): string {
    const match = license.match(/[A-Z]{2}/);
    return match ? match[0] : '';
  }

  private async verifyCRMBrazil(crmNumber: string, state: string, config: CRMConfig): Promise<CRMVerificationResult> {
    const brConfig = config.countries.BR;
    
    if (!brConfig.enabled) {
      return { status: 'failed', error: 'Verificação Brasil (CFM) desabilitada' };
    }

    try {
      const params = new URLSearchParams({
        tipo: 'crm',
        q: crmNumber,
        chave: brConfig.apiKey || '',
        destino: 'json',
      });
      if (state) {
        params.set('uf', state);
      }

      const url = `${brConfig.apiUrl}?${params.toString()}`;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
      } catch (fetchError: any) {
        clearTimeout(timeout);
        if (brConfig.apiKey) {
          return { status: 'failed', error: 'API CFM indisponível. Verifique a chave de API e tente novamente.' };
        }
        return this.simulateVerification(crmNumber, state);
      }

      if (!response.ok) {
        if (brConfig.apiKey) {
          return { status: 'failed', error: `API CFM retornou status ${response.status}` };
        }
        return this.simulateVerification(crmNumber, state);
      }

      const data = await response.json();
      
      if (data.item && data.item.length > 0) {
        const item = data.item[0];
        return {
          status: item.situacao?.toLowerCase() === 'regular' ? 'verified' : 'failed',
          data: {
            name: item.nome,
            registrationNumber: item.numero,
            state: item.uf,
            specialty: item.especialidade,
            situation: item.situacao,
            registrationDate: item.data_inscricao,
            apiSource: 'CFM',
          },
        };
      }

      return {
        status: 'failed',
        error: 'CRM não encontrado na base do CFM',
        data: { apiSource: 'CFM' },
      };
    } catch (error: any) {
      if (!brConfig.apiKey) {
        return this.simulateVerification(crmNumber, state);
      }
      return { status: 'failed', error: `Erro ao consultar CFM: ${error.message}` };
    }
  }

  private async verifyCRMPortugal(crmNumber: string, config: CRMConfig): Promise<CRMVerificationResult> {
    const ptConfig = config.countries.PT;
    
    if (!ptConfig.enabled) {
      return { status: 'unverified', error: 'Verificação Portugal (Ordem dos Médicos) desabilitada' };
    }

    if (!ptConfig.apiUrl || !ptConfig.apiKey) {
      return {
        status: 'unverified',
        error: 'API da Ordem dos Médicos não configurada. Configure URL e chave nas configurações admin.',
        data: { registrationNumber: crmNumber, apiSource: 'ordem_medicos_pt' },
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${ptConfig.apiUrl}?numero=${encodeURIComponent(crmNumber)}&key=${encodeURIComponent(ptConfig.apiKey)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return { status: 'failed', error: `API Ordem dos Médicos retornou status ${response.status}` };
      }

      const data = await response.json();
      return {
        status: data.situacao?.toLowerCase() === 'activo' ? 'verified' : 'failed',
        data: {
          name: data.nome,
          registrationNumber: data.numero,
          situation: data.situacao,
          specialty: data.especialidade,
          apiSource: 'ordem_medicos_pt',
        },
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      return { status: 'failed', error: `Erro ao consultar Ordem dos Médicos: ${errMsg}` };
    }
  }

  private simulateVerification(crmNumber: string, state: string): CRMVerificationResult {
    if (!crmNumber || crmNumber.length < 3) {
      return {
        status: 'failed',
        error: 'Número CRM inválido (mínimo 3 dígitos)',
        data: { apiSource: 'local_validation' },
      };
    }

    return {
      status: 'unverified',
      error: 'API CFM indisponível. Configure a chave de API nas configurações do admin para verificação oficial.',
      data: {
        registrationNumber: crmNumber,
        state: state || 'N/A',
        situation: 'Formato válido (verificação oficial pendente)',
        apiSource: 'local_validation',
      },
    };
  }

  parseCRM(medicalLicense: string | null | undefined): { number: string; state: string } {
    if (!medicalLicense) return { number: '', state: '' };
    
    const cleaned = medicalLicense.trim();
    
    const match1 = cleaned.match(/^CRM[\/\-\s]*([A-Z]{2})[\/\-\s]*(\d+)/i);
    if (match1) return { number: match1[2], state: match1[1].toUpperCase() };

    const match2 = cleaned.match(/(\d+)[\/\-\s]*([A-Z]{2})/i);
    if (match2) return { number: match2[1], state: match2[2].toUpperCase() };

    const match3 = cleaned.match(/^([A-Z]{2})[\/\-\s]*(\d+)/i);
    if (match3) return { number: match3[2], state: match3[1].toUpperCase() };

    const numberOnly = cleaned.replace(/\D/g, '');
    return { number: numberOnly || cleaned, state: '' };
  }
}

export const crmVerificationService = new CRMVerificationService();
