import { Injectable, computed, signal } from '@angular/core';
import { CartItem, Product } from '../models/product.model';

const STORAGE_KEY = 'faraon-cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly cartItems = signal<CartItem[]>(this.load());
  readonly items = this.cartItems.asReadonly();
  readonly count = computed(() => this.cartItems().reduce((total, item) => total + item.quantity, 0));
  readonly subtotal = computed(() => this.cartItems().reduce((total, item) => total + item.product.price * item.quantity, 0));

  add(product: Product): void {
    const next = this.cartItems().map((item) => ({ ...item }));
    const existing = next.find((item) => item.product.id === product.id);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + 1, Math.max(product.stock, 1));
    } else {
      next.push({ product, quantity: 1 });
    }
    this.save(next);
  }

  remove(productId: string): void {
    this.save(this.cartItems().filter((item) => item.product.id !== productId));
  }

  update(productId: string, quantity: number): void {
    const next = this.cartItems().map((item) => {
      if (item.product.id !== productId) return item;
      return { ...item, quantity: Math.max(1, Math.min(quantity, Math.max(item.product.stock, 1))) };
    });
    this.save(next);
  }

  clear(): void {
    this.save([]);
  }

  private save(items: CartItem[]): void {
    this.cartItems.set(items);
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  private load(): CartItem[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CartItem[];
    } catch {
      return [];
    }
  }
}
