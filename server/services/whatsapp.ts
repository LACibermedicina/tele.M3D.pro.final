export interface WhatsAppMessage {
  from: string;
  to: string;
  text: string;
  timestamp: number;
  messageId: string;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text: {
            body: string;
          };
          type: string;
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export class WhatsAppService {
  private accessToken: string;
  private phoneNumberId: string;
  private webhookVerifyToken: string;
  private adminPhoneNumberId: string;

  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';
    this.adminPhoneNumberId = '';
  }

  setAdminSenderNumber(phoneNumberId: string) {
    this.adminPhoneNumberId = phoneNumberId;
  }

  getAdminSenderNumber(): string {
    return this.adminPhoneNumberId;
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      const phoneId = this.adminPhoneNumberId || this.phoneNumberId;
      const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          text: {
            body: message,
          },
        }),
      });

      const result = await response.json();
      console.log('WhatsApp API Response:', result);
      
      return response.ok;
    } catch (error) {
      console.error('WhatsApp send message error:', error);
      return false;
    }
  }

  async sendTemplateMessage(to: string, templateName: string, parameters: string[]): Promise<boolean> {
    try {
      const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: 'pt_BR',
            },
            components: [
              {
                type: 'body',
                parameters: parameters.map(param => ({
                  type: 'text',
                  text: param,
                })),
              },
            ],
          },
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('WhatsApp send template error:', error);
      return false;
    }
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.webhookVerifyToken) {
      console.log('WhatsApp webhook verified successfully');
      return challenge;
    }
    console.log('WhatsApp webhook verification failed');
    return null;
  }

  parseWebhookPayload(payload: WhatsAppWebhookPayload): WhatsAppMessage[] {
    const messages: WhatsAppMessage[] = [];
    
    try {
      if (payload.object === 'whatsapp_business_account') {
        payload.entry.forEach(entry => {
          entry.changes.forEach(change => {
            if (change.field === 'messages' && change.value.messages) {
              change.value.messages.forEach(message => {
                if (message.type === 'text') {
                  messages.push({
                    from: message.from,
                    to: change.value.metadata.display_phone_number,
                    text: message.text.body,
                    timestamp: parseInt(message.timestamp),
                    messageId: message.id,
                  });
                }
              });
            }
          });
        });
      }
    } catch (error) {
      console.error('Error parsing WhatsApp webhook payload:', error);
    }

    return messages;
  }

  async markMessageAsRead(messageId: string): Promise<boolean> {
    try {
      const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('WhatsApp mark as read error:', error);
      return false;
    }
  }

  async sendAppointmentConfirmation(to: string, patientName: string, date: string, time: string): Promise<boolean> {
    const message = `✅ Consulta agendada com sucesso!

📅 Data: ${date}
🕐 Horário: ${time}
👤 Paciente: ${patientName}

Sua consulta foi confirmada. Você receberá um lembrete 24 horas antes.

Para cancelar ou reagendar, responda a esta mensagem ou ligue para nossa clínica.

🏥 MedIA Pro - Sistema Médico Inteligente`;

    return await this.sendMessage(to, message);
  }

  async sendClinicalResponse(to: string, question: string, response: string): Promise<boolean> {
    const message = `💡 Resposta à sua dúvida clínica:

❓ Sua pergunta: "${question}"

📋 Resposta baseada nas diretrizes do Ministério da Saúde:
${response}

⚠️ IMPORTANTE: Esta resposta é informativa e não substitui uma consulta médica presencial. Para um diagnóstico preciso e tratamento adequado, agende uma consulta.

🏥 MedIA Pro - Sistema Médico Inteligente`;

    return await this.sendMessage(to, message);
  }
  async sendConsultationRequestNotification(
    to: string,
    patientName: string,
    specialty: string,
    urgencyLevel: string,
    symptoms: string
  ): Promise<boolean> {
    const urgencyEmoji = urgencyLevel === 'emergency' ? '🔴' : urgencyLevel === 'very_urgent' ? '🟠' : urgencyLevel === 'urgent' ? '🟡' : '🟢';
    const message = `${urgencyEmoji} Nova Solicitação de Consulta

👤 Paciente: ${patientName}
🏥 Especialidade: ${specialty}
⚡ Urgência: ${urgencyLevel}
📝 Sintomas: ${symptoms.slice(0, 200)}

Acesse a plataforma para aceitar ou encaminhar esta solicitação.

🏥 Tele<M3D> Pro`;

    return await this.sendMessage(to, message);
  }

  async sendConsultationJoinNotification(
    to: string,
    doctorName: string,
    consultationId: string,
    accessCode?: string
  ): Promise<boolean> {
    const codeInfo = accessCode ? `\n🔑 Código de acesso: ${accessCode}` : '';
    const message = `✅ Consulta Pronta

Dr(a). ${doctorName} está aguardando você na teleconsulta.${codeInfo}

Acesse a plataforma para iniciar sua consulta por vídeo.

🏥 Tele<M3D> Pro`;

    return await this.sendMessage(to, message);
  }

  async sendConsultationReminderNotification(
    to: string,
    doctorName: string,
    date: string,
    time: string
  ): Promise<boolean> {
    const message = `⏰ Lembrete de Consulta

📅 Data: ${date}
🕐 Horário: ${time}
👨‍⚕️ Médico(a): Dr(a). ${doctorName}

Sua teleconsulta está agendada. Certifique-se de estar em um local com boa conexão de internet.

🏥 Tele<M3D> Pro`;

    return await this.sendMessage(to, message);
  }

  async sendDoctorOfficeNotification(
    to: string,
    eventType: 'opened' | 'closed_manual' | 'closed_inactivity' | 'auto_logoff',
    payload: { doctorName: string; openedAt?: Date | string; closedAt?: Date | string; durationSeconds?: number; reason?: string }
  ): Promise<boolean> {
    const fmt = (d?: Date | string) => {
      if (!d) return '';
      const date = typeof d === 'string' ? new Date(d) : d;
      return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    };
    const fmtDur = (s?: number) => {
      if (!s || s < 0) return '';
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      return [h ? `${h}h` : '', m ? `${m}min` : '', `${sec}s`].filter(Boolean).join(' ');
    };
    let message = '';
    switch (eventType) {
      case 'opened':
        message = `🏥 Consultório Aberto\n\nDr(a). ${payload.doctorName}, seu consultório virtual foi aberto às ${fmt(payload.openedAt)}.\n\nVocê está disponível para atender pacientes agora.`;
        break;
      case 'closed_manual':
        message = `🏥 Consultório Fechado\n\nDr(a). ${payload.doctorName}, seu consultório foi fechado às ${fmt(payload.closedAt)}.\nTempo aberto: ${fmtDur(payload.durationSeconds)}.`;
        break;
      case 'closed_inactivity':
        message = `⚠️ Consultório Fechado por Inatividade\n\nDr(a). ${payload.doctorName}, detectamos inatividade prolongada e seu consultório foi fechado automaticamente às ${fmt(payload.closedAt)}.\nTempo aberto: ${fmtDur(payload.durationSeconds)}.\n\nReabra quando puder retomar os atendimentos.`;
        break;
      case 'auto_logoff':
        message = `🔒 Sessão Encerrada por Inatividade\n\nDr(a). ${payload.doctorName}, sua sessão foi encerrada automaticamente por inatividade${payload.reason ? ` (${payload.reason})` : ''}.\n\nFaça login novamente para continuar.`;
        break;
    }
    message += '\n\n🏥 Tele<M3D> Pro';
    return await this.sendMessage(to, message);
  }

  async sendConsultationCompletedNotification(
    to: string,
    doctorName: string,
    summary?: string
  ): Promise<boolean> {
    const summaryText = summary ? `\n📋 Resumo: ${summary.slice(0, 300)}` : '';
    const message = `✅ Consulta Finalizada

Sua teleconsulta com Dr(a). ${doctorName} foi concluída com sucesso.${summaryText}

Acesse a plataforma para ver suas prescrições, exames e orientações.

🏥 Tele<M3D> Pro`;

    return await this.sendMessage(to, message);
  }

  isConfigured(): boolean {
    return !!(this.accessToken && this.phoneNumberId);
  }
}

export const whatsAppService = new WhatsAppService();
