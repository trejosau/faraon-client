import { Injectable } from '@angular/core';
import { requestJson } from './api-client';
import { APP_CONFIG } from '../config/app-config';

export interface AuthResult {
  ok: boolean;
  message: string;
  token?: string;
  role?: 'admin' | 'customer';
  name?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  async login(email: string, password: string): Promise<AuthResult> {
    if (APP_CONFIG.demoMode) {
      await new Promise((resolve) => window.setTimeout(resolve, 420));
      const payload = btoa(JSON.stringify({ name: 'Cliente de preview', email, role: 'customer' }))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      return { ok: true, message: 'Acceso de preview activado.', token: `demo.${payload}.preview`, role: 'customer', name: 'Cliente de preview' };
    }
    return this.request('/api/auth/login', { email, password });
  }

  async forgotPassword(email: string): Promise<AuthResult> {
    if (APP_CONFIG.demoMode) {
      await new Promise((resolve) => window.setTimeout(resolve, 420));
      return { ok: true, message: 'En producción enviaremos el enlace de recuperación a ese correo.' };
    }
    return this.request('/api/auth/forgot-password', { email });
  }

  private async request(path: string, payload: Record<string, string>): Promise<AuthResult> {
    return requestJson<AuthResult>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, `auth${path}`);
  }
}
