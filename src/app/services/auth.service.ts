import { Injectable } from '@angular/core';
import { requestJson } from './api-client';

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
    return this.request('/api/auth/login', { email, password });
  }

  async forgotPassword(email: string): Promise<AuthResult> {
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
