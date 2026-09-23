import { Injectable } from '@angular/core';
import { requestJson } from './api-client';

export interface ContactPayload {
  name: string;
  email: string;
  phone: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ContactService {
  async send(payload: ContactPayload): Promise<{ ok: boolean; message: string }> {
    const body = await requestJson<{ ok?: boolean; message?: string }>('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 'contact.send');
    return { ok: true, message: body.message ?? 'Mensaje enviado. Te contactaremos pronto.' };
  }
}
