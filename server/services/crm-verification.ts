import { db } from '../db';
import { users, systemSettings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface CRMVerificationResult {
  status: 'verified' | 'failed' | 'pending' | 'unverified' | 'invalid' | 'expired';
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

interface CountryConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  provider: string;
  httpMethod?: 'GET' | 'POST';
  responseMapping?: {
    nameField?: string;
    registrationField?: string;
    stateField?: string;
    specialtyField?: string;
    situationField?: string;
    dateField?: string;
    activeValues?: string[];
    expiredValues?: string[];
    invalidValues?: string[];
  };
}

interface CRMConfig {
  enabled: boolean;
  countries: {
    BR: CountryConfig;
    PT: CountryConfig;
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
      httpMethod: 'GET',
      responseMapping: {
        nameField: 'item.0.nome',
        registrationField: 'item.0.numero',
        stateField: 'item.0.uf',
        specialtyField: 'item.0.especialidade',
        situationField: 'item.0.situacao',
        dateField: 'item.0.data_inscricao',
        activeValues: ['Regular', 'Ativo'],
        expiredValues: ['Cancelado', 'Cassado'],
        invalidValues: ['Não encontrado', 'Inválido'],
      },
    },
    PT: {
      enabled: false,
      apiUrl: '',
      apiKey: '',
      provider: 'Ordem dos Médicos',
      httpMethod: 'GET',
      responseMapping: {
        nameField: 'nome',
        registrationField: 'numero',
        situationField: 'situacao',
        specialtyField: 'especialidade',
        activeValues: ['Activo', 'Ativo'],
        expiredValues: ['Suspenso', 'Cancelado'],
        invalidValues: ['Não encontrado'],
      },
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
    const cleaned = license.replace(/^CRM\/?/i, '');
    const match = cleaned.match(/([A-Z]{2})/);
    return match ? match[1] : '';
  }

  private resolveField(data: any, path: string): string {
    const parts = path.split('.');
    let current = data;
    for (const part of parts) {
      if (current == null) return '';
      if (Array.isArray(current) && /^\d+$/.test(part)) {
        current = current[parseInt(part, 10)];
      } else {
        current = current[part];
      }
    }
    return typeof current === 'string' ? current : (current != null ? String(current) : '');
  }

  private classifyStatus(
    situation: string,
    mapping: NonNullable<CountryConfig['responseMapping']>,
  ): CRMVerificationResult['status'] {
    const sitLower = situation.toLowerCase();
    const activeValues = (mapping.activeValues || ['Regular', 'Ativo']).map(v => v.toLowerCase());
    const expiredValues = (mapping.expiredValues || ['Cancelado', 'Cassado']).map(v => v.toLowerCase());
    const invalidValues = (mapping.invalidValues || ['Não encontrado', 'Inválido']).map(v => v.toLowerCase());

    if (activeValues.includes(sitLower)) return 'verified';
    if (expiredValues.includes(sitLower)) return 'expired';
    if (invalidValues.includes(sitLower)) return 'invalid';
    return 'failed';
  }

  private extractMappedData(data: any, mapping: NonNullable<CountryConfig['responseMapping']>, apiSource: string): CRMVerificationResult['data'] {
    return {
      name: this.resolveField(data, mapping.nameField || 'nome') || undefined,
      registrationNumber: this.resolveField(data, mapping.registrationField || 'numero') || undefined,
      state: this.resolveField(data, mapping.stateField || 'uf') || undefined,
      specialty: this.resolveField(data, mapping.specialtyField || 'especialidade') || undefined,
      situation: this.resolveField(data, mapping.situationField || 'situacao') || undefined,
      registrationDate: this.resolveField(data, mapping.dateField || 'data_inscricao') || undefined,
      apiSource,
    };
  }

  private async fetchApi(url: string, countryConfig: CountryConfig, body?: Record<string, string>): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const method = countryConfig.httpMethod || 'GET';
    const options: RequestInit = { signal: controller.signal, method };

    if (method === 'POST') {
      options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      options.body = new URLSearchParams(body || {}).toString();
    }

    try {
      const response = await fetch(method === 'GET' ? url : countryConfig.apiUrl, options);
      clearTimeout(timeout);
      return response;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  private async verifyCRMBrazil(crmNumber: string, state: string, config: CRMConfig): Promise<CRMVerificationResult> {
    const brConfig = config.countries.BR;
    
    if (!brConfig.enabled) {
      return { status: 'failed', error: 'Verificação Brasil (CFM) desabilitada' };
    }

    const mapping = brConfig.responseMapping || DEFAULT_CRM_CONFIG.countries.BR.responseMapping!;

    try {
      const params: Record<string, string> = {
        tipo: 'crm',
        q: crmNumber,
        chave: brConfig.apiKey || '',
        destino: 'json',
      };
      if (state) params.uf = state;

      const queryString = new URLSearchParams(params).toString();
      const url = `${brConfig.apiUrl}?${queryString}`;

      let response: Response;
      try {
        response = await this.fetchApi(url, brConfig, params);
      } catch (fetchError: any) {
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
      const situationPath = mapping.situationField || 'item.0.situacao';
      const situation = this.resolveField(data, situationPath);

      if (situation || this.resolveField(data, mapping.nameField || 'item.0.nome')) {
        return {
          status: this.classifyStatus(situation, mapping),
          data: this.extractMappedData(data, mapping, 'CFM'),
        };
      }

      return {
        status: 'invalid',
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

    const mapping = ptConfig.responseMapping || DEFAULT_CRM_CONFIG.countries.PT.responseMapping!;

    try {
      const params: Record<string, string> = {
        numero: crmNumber,
        key: ptConfig.apiKey,
      };
      const queryString = new URLSearchParams(params).toString();
      const url = `${ptConfig.apiUrl}?${queryString}`;

      const response = await this.fetchApi(url, ptConfig, params);

      if (!response.ok) {
        return { status: 'failed', error: `API Ordem dos Médicos retornou status ${response.status}` };
      }

      const data = await response.json();
      const situationPath = mapping.situationField || 'situacao';
      const situation = this.resolveField(data, situationPath);

      return {
        status: this.classifyStatus(situation, mapping),
        data: this.extractMappedData(data, mapping, 'ordem_medicos_pt'),
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
