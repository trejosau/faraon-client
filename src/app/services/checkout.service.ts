import { Injectable } from '@angular/core';
import { CartItem } from '../models/product.model';
import { requestJson } from './api-client';
import { DeliveryMethod, ShippingAddress } from './shipping.service';

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
  paymentIntentId?: string;
}

export interface CheckoutShippingPayload {
  method: DeliveryMethod;
  zone: string;
  amountMxn: number;
  address: ShippingAddress;
}

export interface OrderResult {
  ok: boolean;
  orderId?: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  async createPaymentIntent(items: CartItem[], paymentMode: 'cash' | 'credit', shipping: CheckoutShippingPayload, installmentMonths: 3 | 6 | null): Promise<PaymentIntentResult> {
    return requestJson<PaymentIntentResult>('/api/checkout/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMode,
        installmentMonths,
        shipping,
        items: items.map(({ product, quantity }) => ({ productId: product.id, quantity }))
      })
    }, 'checkout.create-payment-intent');
  }

  async createOrder(payload: Record<string, unknown>): Promise<OrderResult> {
    const token = localStorage.getItem('faraon-auth-token');
    return requestJson<OrderResult>('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    }, 'orders.create');
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
