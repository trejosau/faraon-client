import { Injectable } from '@angular/core';
import { requestJson } from './api-client';
import { APP_CONFIG } from '../config/app-config';

export interface ContactPayload {
  name: string;
  email: string;
  phone: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ContactService {
  async send(payload: ContactPayload): Promise<{ ok: boolean; message: string }> {
    if (APP_CONFIG.demoMode) {
      await new Promise((resolve) => window.setTimeout(resolve, 420));
      return { ok: true, message: 'Mensaje recibido en la preview. En producción llegará al equipo de El Faraón.' };
    }
    const body = await requestJson<{ ok?: boolean; message?: string }>('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 'contact.send');
    return { ok: true, message: body.message ?? 'Mensaje enviado. Te contactaremos pronto.' };
  }
}
