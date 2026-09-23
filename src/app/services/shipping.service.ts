import { Injectable } from '@angular/core';
import { CartItem } from '../models/product.model';

export type DeliveryMethod = 'local' | 'national';

export interface ShippingAddress {
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface ShippingQuote {
  method: DeliveryMethod;
  zone: 'Comarca Lagunera' | 'Nacional';
  amountMxn: number;
  label: string;
  detail: string;
  ready: boolean;
}

@Injectable({ providedIn: 'root' })
export class ShippingService {
  readonly localRateMxn = 450;
  readonly localFreeFromMxn = 15000;

  quote(address: ShippingAddress, method: DeliveryMethod, subtotal: number, items: CartItem[]): ShippingQuote {
    const postalCode = address.postalCode.replace(/\D/g, '');
    const hasAddress = Boolean(address.name.trim() && address.phone.trim() && address.line1.trim() && address.city.trim() && address.state.trim() && postalCode.length === 5);
    if (!hasAddress) {
      return { method, zone: method === 'local' ? 'Comarca Lagunera' : 'Nacional', amountMxn: 0, label: 'Falta completar la dirección', detail: 'Agrega nombre, teléfono, dirección, ciudad, estado y código postal.', ready: false };
    }
    const isLocal = /^(270|271|272|273|274|350|351|352|353|354|355|356|357|358|359)/.test(postalCode);
    if (method === 'local' && !isLocal) {
      return { method, zone: 'Nacional', amountMxn: 0, label: 'Código postal fuera de la Comarca', detail: 'Cambia a envío nacional para continuar.', ready: false };
    }
    if (method === 'local') {
      const free = subtotal >= this.localFreeFromMxn;
      return { method, zone: 'Comarca Lagunera', amountMxn: free ? 0 : this.localRateMxn, label: free ? 'Entrega local sin costo' : 'Entrega local', detail: free ? 'Envío gratuito por compra mayor a $15,000 MXN.' : 'Tarifa local estimada para la Comarca Lagunera.', ready: true };
    }
    const weight = items.reduce((total, item) => total + (item.product.weightKg ?? 18) * item.quantity, 0);
    const volume = items.reduce((total, item) => total + (item.product.volumeM3 ?? 0.18) * item.quantity, 0);
    const amountMxn = Math.max(850, Math.round(650 + weight * 14 + volume * 900));
    return { method, zone: 'Nacional', amountMxn, label: 'Envío nacional estimado', detail: `${weight.toFixed(0)} kg · ${volume.toFixed(2)} m³ · tarifa provisional por zona.`, ready: true };
  }
}
