export type ProductCategory = 'Sala' | 'Comedor' | 'Recámara' | 'Decoración';
export type StockStatus = 'Disponible' | 'Últimas piezas' | 'Sobre pedido';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  image: string;
  price: number;
  previousPrice?: number;
  stock: number;
  stockStatus: StockStatus;
  delivery: string;
  dimensions: string;
  featured?: boolean;
  projectTags: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}
