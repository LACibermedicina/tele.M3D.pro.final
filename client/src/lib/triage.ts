export type TriageLevel = 'emergency' | 'very_urgent' | 'urgent' | 'standard' | 'non_urgent';

export interface TriageConfig {
  level: TriageLevel;
  label: string;
  labelShort: string;
  color: string;
  bgColor: string;
  bgColorLight: string;
  borderColor: string;
  textColor: string;
  dotColor: string;
  maxWaitTime: string;
  description: string;
  criteria: string[];
  protocol: string;
  priority: number;
}

export const TRIAGE_LEVELS: Record<TriageLevel, TriageConfig> = {
  emergency: {
    level: 'emergency',
    label: 'Emergência',
    labelShort: 'EMG',
    color: '#DC2626',
    bgColor: 'bg-red-600',
    bgColorLight: 'bg-red-50 dark:bg-red-950/40',
    borderColor: 'border-red-500',
    textColor: 'text-red-700 dark:text-red-400',
    dotColor: 'bg-red-600',
    maxWaitTime: 'Atendimento imediato (0 min)',
    description: 'Risco iminente de vida. Necessita intervenção imediata para preservação da vida.',
    criteria: [
      'Parada cardiorrespiratória',
      'Obstrução de vias aéreas',
      'Choque (hipotensão severa)',
      'Convulsão em atividade',
      'Politraumatismo grave',
      'Hemorragia incontrolável',
      'Alteração severa do nível de consciência (Glasgow ≤ 8)',
      'Dor torácica sugestiva de IAM',
      'AVC em janela terapêutica',
    ],
    protocol: 'Protocolo de Manchester / MS Brasil - Nível 1',
    priority: 1,
  },
  very_urgent: {
    level: 'very_urgent',
    label: 'Muito Urgente',
    labelShort: 'MUR',
    color: '#EA580C',
    bgColor: 'bg-orange-600',
    bgColorLight: 'bg-orange-50 dark:bg-orange-950/40',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-700 dark:text-orange-400',
    dotColor: 'bg-orange-600',
    maxWaitTime: 'Até 10 minutos',
    description: 'Condição grave que pode evoluir para risco de vida. Necessita atendimento muito rápido.',
    criteria: [
      'Dor intensa (escala ≥ 8/10)',
      'Dispneia moderada a grave',
      'Desidratação grave',
      'Hemorragia moderada',
      'Déficit neurológico agudo',
      'Dor abdominal intensa com sinais de irritação peritoneal',
      'Febre alta (>39°C) com sinais de toxemia',
      'Reação alérgica grave (angioedema)',
      'Trauma com deformidade ou perda funcional',
    ],
    protocol: 'Protocolo de Manchester / MS Brasil - Nível 2',
    priority: 2,
  },
  urgent: {
    level: 'urgent',
    label: 'Urgente',
    labelShort: 'URG',
    color: '#EAB308',
    bgColor: 'bg-yellow-500',
    bgColorLight: 'bg-yellow-50 dark:bg-yellow-950/40',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    dotColor: 'bg-yellow-500',
    maxWaitTime: 'Até 60 minutos',
    description: 'Condição que necessita avaliação médica, sem risco imediato de vida mas com potencial de agravamento.',
    criteria: [
      'Dor moderada (escala 4-7/10)',
      'Febre moderada (38-39°C)',
      'Vômitos ou diarreia persistente',
      'Infecção urinária com febre',
      'Crise hipertensiva sem sintomas graves',
      'Lesão que necessita sutura',
      'Fratura simples sem deformidade',
      'Dispneia leve',
      'Cefaleia intensa de início súbito',
    ],
    protocol: 'Protocolo de Manchester / MS Brasil - Nível 3',
    priority: 3,
  },
  standard: {
    level: 'standard',
    label: 'Pouco Urgente',
    labelShort: 'STD',
    color: '#16A34A',
    bgColor: 'bg-green-600',
    bgColorLight: 'bg-green-50 dark:bg-green-950/40',
    borderColor: 'border-green-500',
    textColor: 'text-green-700 dark:text-green-400',
    dotColor: 'bg-green-600',
    maxWaitTime: 'Até 120 minutos',
    description: 'Condição de menor gravidade que permite espera para atendimento sem risco significativo.',
    criteria: [
      'Dor leve (escala 1-3/10)',
      'Febre baixa (<38°C) sem sinais de alerta',
      'Infecção de vias aéreas superiores',
      'Contusão sem sinais de fratura',
      'Dor lombar crônica agudizada',
      'Infecção cutânea localizada',
      'Sintomas gripais sem complicações',
      'Queixas gastrointestinais leves',
    ],
    protocol: 'Protocolo de Manchester / MS Brasil - Nível 4',
    priority: 4,
  },
  non_urgent: {
    level: 'non_urgent',
    label: 'Não Urgente',
    labelShort: 'N/U',
    color: '#2563EB',
    bgColor: 'bg-blue-600',
    bgColorLight: 'bg-blue-50 dark:bg-blue-950/40',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-700 dark:text-blue-400',
    dotColor: 'bg-blue-600',
    maxWaitTime: 'Até 240 minutos',
    description: 'Queixa crônica ou condição que não necessita atendimento de urgência. Pode ser encaminhado para consulta ambulatorial.',
    criteria: [
      'Renovação de receitas',
      'Resultados de exames',
      'Queixas crônicas estáveis',
      'Consulta de rotina/acompanhamento',
      'Orientações sobre medicamentos',
      'Atestados e laudos',
      'Condições dermatológicas não agudas',
    ],
    protocol: 'Protocolo de Manchester / MS Brasil - Nível 5',
    priority: 5,
  },
};

export const TRIAGE_LEVELS_ARRAY = Object.values(TRIAGE_LEVELS).sort((a, b) => a.priority - b.priority);

export function mapLegacyTriageLevel(level: string): TriageLevel {
  const mapping: Record<string, TriageLevel> = {
    'emergency': 'emergency',
    'emergencia': 'emergency',
    'immediate': 'emergency',
    'very_urgent': 'very_urgent',
    'muito_urgente': 'very_urgent',
    'urgent': 'urgent',
    'urgente': 'urgent',
    'routine': 'standard',
    'standard': 'standard',
    'pouco_urgente': 'standard',
    'low': 'non_urgent',
    'non_urgent': 'non_urgent',
    'nao_urgente': 'non_urgent',
    'not_urgent': 'non_urgent',
  };
  return mapping[level?.toLowerCase()] || 'standard';
}

export function getTriageConfig(level: string): TriageConfig {
  const mapped = mapLegacyTriageLevel(level);
  return TRIAGE_LEVELS[mapped];
}

export const TRIAGE_PROTOCOL_INFO = {
  name: 'Protocolo de Manchester',
  fullName: 'Sistema de Triagem de Manchester (MTS)',
  description: 'O Protocolo de Manchester é um sistema de classificação de risco amplamente utilizado no Brasil e adotado pelo Ministério da Saúde. Classifica os pacientes em cinco níveis de prioridade baseados em cores, determinando o tempo máximo de espera para atendimento.',
  adoption: 'Adotado pelo Ministério da Saúde do Brasil (Portaria nº 2.048/GM/MS), pela maioria dos hospitais e UPAs brasileiros, e em mais de 30 países.',
  fallback: 'Na ausência de identificação do país de atuação, são utilizadas as diretrizes de triagem da Organização Mundial da Saúde (OMS/WHO).',
  references: [
    'Protocolo de Manchester - Grupo Brasileiro de Classificação de Risco (GBCR)',
    'Ministério da Saúde - Portaria nº 2.048/GM/MS',
    'OMS - Emergency Triage Assessment and Treatment (ETAT)',
    'WHO - Integrated Management of Childhood Illness (IMCI)',
  ],
};
