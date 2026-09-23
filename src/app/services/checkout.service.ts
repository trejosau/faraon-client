import { Injectable } from '@angular/core';
import { CartItem } from '../models/product.model';
import { requestJson } from './api-client';

export interface CheckoutResult {
  ok: boolean;
  sessionId: string;
  message: string;
  url?: string;
  clientSecret?: string;
}

export interface PaymentIntentResult {
  ok: boolean;
  clientSecret: string;
  amount: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  async createPaymentIntent(items: CartItem[], paymentMode: 'cash' | 'credit'): Promise<PaymentIntentResult> {
    return requestJson<PaymentIntentResult>('/api/checkout/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMode,
        items: items.map(({ product, quantity }) => ({ productId: product.id, quantity }))
      })
    }, 'checkout.create-payment-intent');
  }

  async createCheckoutSession(items: CartItem[], paymentMode: 'cash' | 'credit'): Promise<CheckoutResult> {
    return requestJson<CheckoutResult>('/api/checkout/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMode,
        items: items.map(({ product, quantity }) => ({
          productId: product.id,
          quantity
        }))
      })
    }, 'checkout.create-session');
  }
}
