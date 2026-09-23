import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { loadStripe, Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js';
import * as L from 'leaflet';
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CATALOG } from './data/catalog.data';
import { CartItem, Product, ProductCategory } from './models/product.model';
import { AuthService } from './services/auth.service';
import { CartService } from './services/cart.service';
import { CheckoutService } from './services/checkout.service';
import { ContactPayload, ContactService } from './services/contact.service';
import { ApiRequestError } from './services/api-client';
import { DeliveryMethod, ShippingAddress, ShippingService } from './services/shipping.service';
import { APP_CONFIG } from './config/app-config';

type View = 'home' | 'catalog' | 'orders' | 'success';
type ProjectFilter = 'Todos' | 'Nueva casa' | 'Equipar varias casas' | 'Renovar un espacio';
type AdminSection = 'overview' | 'catalog' | 'sales' | 'production';
type ProductionFilter = 'Todas' | 'En curso' | 'Riesgo' | 'Listas';
type OrderStatus = 'paid' | 'preparing' | 'shipped' | 'out_for_delivery' | 'delivered';

interface StoredOrderItem {
  productId: string;
  name: string;
  image: string;
  quantity: number;
  unitAmountMxn: number;
}

interface StoredOrder {
  id: number | string;
  displayId: string;
  paymentIntentId: string;
  createdAt: string;
  status: OrderStatus;
  shippingStatus: OrderStatus;
  amountMxn: number;
  shippingAmountMxn: number;
  deliveryMethod: DeliveryMethod;
  shippingZone: string;
  address: ShippingAddress;
  items: StoredOrderItem[];
  accountEmail: string | null;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
}

interface InventoryRow {
  material: string;
  type: string;
  quantity: string;
  location: string;
  status: string;
  tone: 'ready' | 'warning' | 'process' | 'muted';
}

interface ProductionStage {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  count: string;
  tone: 'gold' | 'ink' | 'soft' | 'warm';
}

interface ProductionOrder {
  id: string;
  product: string;
  image: string;
  quantity: number;
  stageIndex: number;
  stage: string;
  progress: number;
  responsible: string;
  due: string;
  priority: 'Alta' | 'Media' | 'Baja';
  state: 'En curso' | 'Riesgo' | 'Listo';
  note: string;
}

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const LERDO_COORDINATES: L.LatLngExpression = [25.543, -103.523];
const CITY_COORDINATES: Record<string, L.LatLngExpression> = {
  lerdo: LERDO_COORDINATES,
  "ciudad lerdo": LERDO_COORDINATES,
  torreon: [25.5428, -103.4068],
  "gomez palacio": [25.561, -103.498]
};
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

@Component({
  selector: 'faraon-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('stripePaymentElement') stripePaymentElementHost?: ElementRef<HTMLElement>;
  @ViewChild('locationMap') locationMapHost?: ElementRef<HTMLElement>;
  readonly cart = inject(CartService);
  private readonly checkout = inject(CheckoutService);
  private readonly contact = inject(ContactService);
  private readonly auth = inject(AuthService);
  private readonly shipping = inject(ShippingService);
  readonly products = CATALOG;
  readonly view = signal<View>('home');
  readonly cartOpen = signal(false);
  readonly checkoutExpanded = signal(false);
  readonly menuOpen = signal(false);
  readonly selectedProduct = signal<Product | null>(null);
  readonly checkoutMessage = signal('');
  readonly stripeOpen = signal(false);
  readonly stripeLoading = signal(false);
  readonly stripePaying = signal(false);
  readonly stripeMessage = signal('');
  readonly stripeCardMode = signal('Esperando datos de tarjeta');
  readonly stripeCardFunding = signal<'unknown' | 'credit' | 'debit' | 'prepaid'>('unknown');
  readonly successNotice = signal('');
  readonly lastOrder = signal<StoredOrder | null>(null);
  readonly orders = signal<StoredOrder[]>(this.readStoredOrders());
  readonly authUser = signal<{ name: string; email: string; role?: string } | null>(this.readAuthUser());
  readonly selectedOrderId = signal<number | string | null>(null);
  readonly creditMonths = signal<3 | 6 | null>(null);
  readonly search = signal('');
  readonly activeCategory = signal<'Todas' | ProductCategory>('Todas');
  readonly activeProject = signal<ProjectFilter>('Todos');
  readonly projectFilters: ProjectFilter[] = ['Todos', 'Nueva casa', 'Equipar varias casas', 'Renovar un espacio'];
  readonly paymentMode = signal<'cash' | 'credit'>('cash');
  readonly demoMode = APP_CONFIG.demoMode;
  readonly demoCard = {
    name: 'Cliente de preview',
    number: '4242 4242 4242 4242',
    expiry: '12/34',
    cvc: '123'
  };
  readonly deliveryMethod = signal<DeliveryMethod>('local');
  private readonly shippingAddressVersion = signal(0);
  readonly shippingAddress: ShippingAddress = this.createReactiveShippingAddress({ name: '', phone: '', line1: '', city: 'Torreón', state: 'Coahuila', postalCode: '' });
  readonly trackingSteps = [
    { status: 'paid' as OrderStatus, label: 'Pago confirmado', description: APP_CONFIG.demoMode ? 'Flujo de checkout completado en la preview.' : 'Stripe confirmó tu pago.' },
    { status: 'preparing' as OrderStatus, label: 'Preparando pedido', description: 'Estamos coordinando materiales y salida.' },
    { status: 'shipped' as OrderStatus, label: 'Enviado', description: 'Tu pedido salió del taller.' },
    { status: 'out_for_delivery' as OrderStatus, label: 'En reparto', description: 'Va en camino a tu dirección.' },
    { status: 'delivered' as OrderStatus, label: 'Entregado', description: 'Pedido recibido.' }
  ];
  readonly authOpen = signal(false);
  readonly authMode = signal<'login' | 'forgot'>('login');
  readonly authEmail = signal('');
  readonly authPassword = signal('');
  readonly authMessage = signal('');
  readonly authSending = signal(false);
  readonly contactSending = signal(false);
  readonly contactMessage = signal('');
  readonly adminOpen = signal(false);
  readonly adminSection = signal<AdminSection>('overview');
  readonly adminUser = signal('');
  readonly contactForm: ContactPayload = { name: '', email: '', phone: '', message: '' };
  private motionCleanup: (() => void) | undefined;
  private stripe: Stripe | null = null;
  private stripeElements: StripeElements | null = null;
  private stripePaymentElementInstance: StripePaymentElement | null = null;
  private stripeClientSecret = '';
  private locationMap: L.Map | null = null;
  private readonly trackingMaps = new Map<string, L.Map>();

  private createReactiveShippingAddress(initial: ShippingAddress): ShippingAddress {
    return new Proxy(initial, {
      set: (target, property, value) => {
        const updated = Reflect.set(target, property, value);
        this.shippingAddressVersion.update((version) => version + 1);
        return updated;
      }
    });
  }

  readonly adminNavigation: Array<{ id: AdminSection; label: string; description: string }> = [
    { id: 'overview', label: 'Resumen', description: 'Lo que está pasando hoy' },
    { id: 'catalog', label: 'Catálogo', description: 'Piezas publicadas' },
    { id: 'sales', label: 'Ventas', description: 'Pedidos y cobros' },
    { id: 'production', label: 'Producción', description: 'Materiales y workflow' }
  ];
  readonly adminSectionTitle = computed(() => this.adminNavigation.find((item) => item.id === this.adminSection())?.label ?? 'Resumen de operación');
  readonly adminStats = [
    { label: 'Ventas del mes', value: '$184,500', note: '+12% frente al mes anterior', accent: 'gold' },
    { label: 'Pedidos abiertos', value: '12', note: '4 requieren seguimiento', accent: 'ink' },
    { label: 'Piezas en catálogo', value: '24', note: '6 disponibles para entrega', accent: 'soft' },
    { label: 'Producción activa', value: '08', note: '3 modelos en taller', accent: 'dark' }
  ];
  readonly salesBars = [
    { label: 'Ene', value: 48 }, { label: 'Feb', value: 62 }, { label: 'Mar', value: 54 },
    { label: 'Abr', value: 74 }, { label: 'May', value: 68 }, { label: 'Jun', value: 86 }
  ];
  readonly recentOrders = [
    { id: 'F-1048', customer: 'Mariana Ríos', item: 'Sala modular', total: '$16,900', status: 'Pagado' },
    { id: 'F-1047', customer: 'Hotel Nido', item: 'Comedor para 6 personas', total: '$54,400', status: 'En revisión' },
    { id: 'F-1046', customer: 'Carlos Méndez', item: 'Bufetero de madera oscura', total: '$4,300', status: 'Preparando' }
  ];
  readonly inventoryRows = signal<InventoryRow[]>([
    { material: 'Madera de parota', type: 'Materia prima', quantity: '14 tablones', location: 'Almacén norte', status: 'Disponible', tone: 'ready' },
    { material: 'Tela lino arena', type: 'Insumo', quantity: '38 m', location: 'Tapicería', status: 'Bajo mínimo', tone: 'warning' },
    { material: 'Sala modular', type: 'Producto en proceso', quantity: '2 unidades', location: 'Carpintería', status: 'Armado', tone: 'process' },
    { material: 'Comedor para 6 personas', type: 'Producto terminado', quantity: '0 unidades', location: 'Catálogo', status: 'Sobre pedido', tone: 'muted' }
  ]);
  readonly productionPipeline: ProductionStage[] = [
    { id: 'inventory', eyebrow: '01 · recepción', title: 'Inventario recibido', description: 'Lote, proveedor, costo y calidad quedan registrados.', count: '14 lotes', tone: 'gold' },
    { id: 'design', eyebrow: '02 · diseño', title: 'Diseño + BOM', description: 'Cada modelo tiene planos, variantes y lista de materiales.', count: '06 diseños', tone: 'warm' },
    { id: 'validated', eyebrow: '03 · validación', title: 'Material validado', description: 'El sistema confirma qué se puede fabricar y qué falta.', count: '04 órdenes', tone: 'soft' },
    { id: 'build', eyebrow: '04 · taller', title: 'Corte + ensamble', description: 'Madera, estructura y herrajes se convierten en producto.', count: '03 activas', tone: 'ink' },
    { id: 'upholstery', eyebrow: '05 · tapicería', title: 'Espuma + tapizado', description: 'La pieza toma volumen, textura y su variante final.', count: '02 activas', tone: 'warm' },
    { id: 'quality', eyebrow: '06 · revisión', title: 'Control de calidad', description: 'Se documentan defectos, fotos y correcciones antes de publicar.', count: '01 revisión', tone: 'soft' },
    { id: 'ready', eyebrow: '07 · catálogo', title: 'Listo para publicar', description: 'Ficha, precio, stock y fotografías quedan completos.', count: '06 listas', tone: 'gold' }
  ];
  readonly productionOrders = signal<ProductionOrder[]>([
    { id: 'OP-024', product: 'Sala modular', image: 'assets/catalog-order-02.png', quantity: 2, stageIndex: 4, stage: 'Espuma + tapizado', progress: 68, responsible: 'Taller de tapicería', due: '27 sep', priority: 'Alta', state: 'En curso', note: 'Esperando confirmar tela gris carbón para la variante final.' },
    { id: 'OP-023', product: 'Comedor para 6 personas', image: 'assets/catalog-order-04.png', quantity: 4, stageIndex: 3, stage: 'Corte + ensamble', progress: 48, responsible: 'Carpintería norte', due: '30 sep', priority: 'Media', state: 'En curso', note: 'Madera y herrajes validados. Faltan fotografías de avance.' },
    { id: 'OP-022', product: 'Bufetero de madera oscura', image: 'assets/catalog-order-03.png', quantity: 3, stageIndex: 5, stage: 'Control de calidad', progress: 86, responsible: 'Calidad', due: '25 sep', priority: 'Alta', state: 'Riesgo', note: 'Revisar ajuste de puertas antes de liberar a catálogo.' },
    { id: 'OP-021', product: 'Comedor para 4 personas', image: 'assets/catalog-order-01.png', quantity: 6, stageIndex: 6, stage: 'Listo para publicar', progress: 100, responsible: 'Contenido', due: 'Hoy', priority: 'Baja', state: 'Listo', note: 'Ficha completa y fotografías principales aprobadas.' }
  ]);
  readonly productionAlerts = [
    { title: 'Tela lino arena bajo mínimo', detail: '38 m disponibles · mínimo 50 m', tone: 'warning' },
    { title: 'OP-022 requiere corrección', detail: 'Ajuste de puertas antes de liberar', tone: 'danger' },
    { title: '2 fichas esperan fotografías', detail: 'Sin imágenes por variante', tone: 'neutral' }
  ];
  readonly productionFilter = signal<ProductionFilter>('Todas');
  readonly productionFilters: ProductionFilter[] = ['Todas', 'En curso', 'Riesgo', 'Listas'];
  readonly productionStageFilter = signal('all');
  readonly productionSearch = signal('');
  readonly selectedProductionOrder = signal<ProductionOrder | null>(null);
  readonly showMaterialEntry = signal(false);
  readonly materialEntryMessage = signal('');
  materialEntry = { material: '', quantity: '', unit: 'unidades', supplier: '', lot: '' };

  readonly filteredProductionOrders = computed(() => {
    const query = this.productionSearch().trim().toLocaleLowerCase('es');
    const filter = this.productionFilter();
    const stage = this.productionStageFilter();
    return this.productionOrders().filter((order) => {
      const matchesQuery = !query || `${order.id} ${order.product} ${order.responsible}`.toLocaleLowerCase('es').includes(query);
      const matchesFilter = filter === 'Todas' || (filter === 'Listas' ? order.state === 'Listo' : order.state === filter);
      const matchesStage = stage === 'all' || this.productionPipeline[order.stageIndex]?.id === stage;
      return matchesQuery && matchesFilter && matchesStage;
    });
  });

  readonly categories = computed(() => {
    const counts = new Map<string, number>();
    this.products.forEach((product) => counts.set(product.category, (counts.get(product.category) ?? 0) + 1));
    return [
      { label: 'Todas', count: this.products.length },
      ...Array.from(counts.entries()).map(([label, count]) => ({ label, count }))
    ];
  });

  readonly filteredProducts = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('es');
    const category = this.activeCategory();
    return this.products.filter((product) => {
      const matchesQuery = !query || `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase('es').includes(query);
      const matchesCategory = category === 'Todas' || product.category === category;
      return matchesQuery && matchesCategory;
    });
  });

  readonly checkoutSubtotal = computed(() => this.cart.items().reduce((total, item) => total + this.unitPrice(item.product) * item.quantity, 0));
  readonly shippingQuote = computed(() => {
    this.shippingAddressVersion();
    return this.shipping.quote(this.shippingAddress, this.deliveryMethod(), this.checkoutSubtotal(), this.cart.items());
  });
  readonly visibleOrders = computed(() => {
    if (this.view() === 'success') return this.lastOrder() ? [this.lastOrder() as StoredOrder] : this.orders().slice(0, 1);
    return this.orders();
  });
  readonly checkoutTotal = computed(() => this.checkoutSubtotal() + this.shippingQuote().amountMxn);
  readonly canPay = computed(() => {
    if (this.stripeLoading() || this.stripePaying() || !this.cart.items().length) return false;
    if (this.paymentMode() === 'credit' && this.creditMonths() === null) return false;
    if (this.demoMode) return this.demoCard.number.replace(/\s/g, '').length === 16;
    return this.paymentMode() === 'cash' || this.stripeCardFunding() === 'credit';
  });

  ngOnInit(): void {
    this.syncView();
    window.addEventListener('hashchange', this.syncView);
  }

  ngAfterViewInit(): void {
    this.initializeLocationMap();
    this.initializeTrackingMaps();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element, index) => {
        gsap.from(element, {
          opacity: 0,
          y: 28,
          duration: 0.82,
          delay: Math.min(index * 0.035, 0.2),
          ease: 'power3.out',
          scrollTrigger: { trigger: element, start: 'top 88%', once: true }
        });
      });

      gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((frame) => {
        const image = frame.querySelector('img');
        if (!image) return;
        gsap.to(image, {
          yPercent: -5,
          ease: 'none',
          scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
        });
      });
    }, document.body);
    this.motionCleanup = () => context.revert();
  }

  ngOnDestroy(): void {
    window.removeEventListener('hashchange', this.syncView);
    this.stripePaymentElementInstance?.destroy();
    this.locationMap?.remove();
    this.trackingMaps.forEach((map) => map.remove());
    this.motionCleanup?.();
  }

  private addMapTiles(map: L.Map): void {
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
  }

  private mapIcon(kind: 'origin' | 'current' | 'destination'): L.DivIcon {
    return L.divIcon({
      className: `faraon-map-pin faraon-map-pin-${kind}`,
      html: '<span></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  }

  private initializeLocationMap(): void {
    const host = this.locationMapHost?.nativeElement;
    if (!host) return;
    if (this.locationMap?.getContainer() === host) return;
    this.locationMap?.remove();
    this.locationMap = L.map(host, { scrollWheelZoom: false, zoomControl: true }).setView(LERDO_COORDINATES, 12);
    this.addMapTiles(this.locationMap);
    L.marker(LERDO_COORDINATES, { icon: this.mapIcon('origin') })
      .addTo(this.locationMap)
      .bindPopup('<strong>El Faraón</strong><br />Ciudad Lerdo · ubicación exacta por confirmar.');
    L.circleMarker(CITY_COORDINATES['torreon'], { color: '#c9a63d', fillColor: '#c9a63d', fillOpacity: .7, radius: 6, weight: 2 })
      .addTo(this.locationMap)
      .bindTooltip('Comarca Lagunera · entregas locales');
    window.setTimeout(() => this.locationMap?.invalidateSize(), 0);
  }

  private initializeTrackingMaps(): void {
    const orders = this.visibleOrders();
    const hosts = Array.from(document.querySelectorAll<HTMLElement>('.tracking-map'));
    hosts.forEach((host, index) => {
      const order = orders[index];
      if (!order) return;
      const mapKey = String(order.id);
      const existingMap = this.trackingMaps.get(mapKey);
      if (existingMap?.getContainer() === host) return;
      existingMap?.remove();
      this.trackingMaps.delete(mapKey);
      host.classList.add('leaflet-ready');
      host.setAttribute('role', 'application');
      host.setAttribute('aria-label', `Mapa de seguimiento del pedido ${order.displayId} hacia ${order.address.city}`);
      host.innerHTML = '';
      const map = L.map(host, { scrollWheelZoom: false, zoomControl: false }).setView(LERDO_COORDINATES, 10);
      this.addMapTiles(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      const destination = this.coordinatesForCity(order.address.city);
      L.polyline([LERDO_COORDINATES, destination], { color: '#7c5d16', dashArray: '7 8', opacity: .85, weight: 3 }).addTo(map);
      L.marker(LERDO_COORDINATES, { icon: this.mapIcon('origin') }).addTo(map).bindTooltip('Taller · Ciudad Lerdo');
      L.marker(destination, { icon: this.mapIcon(order.status === 'delivered' ? 'destination' : 'current') })
        .addTo(map)
        .bindTooltip(`${order.status === 'delivered' ? 'Entrega' : 'Ruta actual'} · ${order.address.city}`);
      map.fitBounds(L.latLngBounds([LERDO_COORDINATES, destination]), { padding: [24, 24] });
      this.trackingMaps.set(mapKey, map);
      window.setTimeout(() => map.invalidateSize(), 0);
    });
  }

  private coordinatesForCity(city: string): L.LatLngExpression {
    const normalizedCity = city.trim().toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return CITY_COORDINATES[normalizedCity] ?? LERDO_COORDINATES;
  }

  syncView = (): void => {
    const hash = window.location.hash;
    this.view.set(hash === '#catalogo' ? 'catalog' : hash === '#pedidos' ? 'orders' : hash === '#pedido-exitoso' ? 'success' : 'home');
    this.menuOpen.set(false);
    if (this.view() === 'orders') this.selectedOrderId.set(this.orders()[0]?.id ?? null);
    if (this.view() === 'success') {
      const recentOrder = this.lastOrder() ?? this.orders()[0] ?? null;
      this.lastOrder.set(recentOrder);
      if (recentOrder && !this.successNotice()) this.successNotice.set('Pago confirmado. Tu pedido está en preparación.');
    }
    window.scrollTo(0, 0);
    window.setTimeout(() => window.scrollTo(0, 0), 0);
    window.setTimeout(() => {
      this.initializeLocationMap();
      this.initializeTrackingMaps();
    }, 0);
  };

  goTo(view: View): void {
    const hash = view === 'catalog' ? '#catalogo' : view === 'orders' ? '#pedidos' : view === 'success' ? '#pedido-exitoso' : '#inicio';
    window.history.replaceState(null, '', hash);
    this.syncView();
  }

  goToContact(): void {
    window.history.replaceState(null, '', '#contacto');
    this.view.set('home');
    this.menuOpen.set(false);
    window.setTimeout(() => {
      const contact = document.getElementById('contacto');
      if (contact) gsap.to(window, { duration: 0.9, scrollTo: { y: contact, offsetY: 20 }, ease: 'power3.out' });
    }, 0);
  }

  setCategory(category: string): void {
    this.activeCategory.set(category as 'Todas' | ProductCategory);
  }

  setProject(project: ProjectFilter): void {
    const projectMessages: Record<Exclude<ProjectFilter, 'Todos'>, string> = {
      'Nueva casa': 'Quiero amueblar una casa nueva y necesito orientación para elegir las piezas.',
      'Equipar varias casas': 'Quiero cotizar el equipamiento de varias casas, departamentos u hospedajes.',
      'Renovar un espacio': 'Quiero renovar un espacio y encontrar una pieza que se sienta parte de mi casa.'
    };
    this.contactForm.message = project === 'Todos' ? '' : projectMessages[project];
    this.goToContact();
  }

  openProduct(product: Product): void {
    this.selectedProduct.set(product);
  }

  closeProduct(): void {
    this.selectedProduct.set(null);
  }

  openAuth(mode: 'login' | 'forgot' = 'login'): void {
    this.authMode.set(mode);
    this.authMessage.set('');
    this.authOpen.set(true);
  }

  closeAuth(): void {
    this.authOpen.set(false);
  }

  setAdminSection(section: AdminSection): void {
    this.adminSection.set(section);
  }

  setProductionFilter(filter: ProductionFilter): void {
    this.productionFilter.set(filter);
  }

  setProductionStage(stageId: string): void {
    this.productionStageFilter.set(this.productionStageFilter() === stageId ? 'all' : stageId);
  }

  openProductionOrder(order: ProductionOrder): void {
    this.selectedProductionOrder.set(order);
  }

  closeProductionOrder(): void {
    this.selectedProductionOrder.set(null);
  }

  advanceProductionOrder(orderId: string, event?: Event): void {
    event?.stopPropagation();
    const lastStage = this.productionPipeline.length - 1;
    this.productionOrders.update((orders) => orders.map((order) => {
      if (order.id !== orderId) return order;
      const stageIndex = Math.min(order.stageIndex + 1, lastStage);
      const state: ProductionOrder['state'] = stageIndex === lastStage ? 'Listo' : order.state === 'Riesgo' ? 'Riesgo' : 'En curso';
      return {
        ...order,
        stageIndex,
        stage: this.productionPipeline[stageIndex].title,
        progress: stageIndex === lastStage ? 100 : Math.max(order.progress, Math.round(((stageIndex + 1) / this.productionPipeline.length) * 100)),
        state
      };
    }));
    this.selectedProductionOrder.set(this.productionOrders().find((order) => order.id === orderId) ?? null);
  }

  registerMaterialEntry(): void {
    if (!this.materialEntry.material.trim() || !this.materialEntry.quantity.trim()) {
      this.materialEntryMessage.set('Escribe el material y la cantidad para registrar la entrada.');
      return;
    }
    this.inventoryRows.update((rows) => [{
      material: this.materialEntry.material.trim(),
      type: 'Materia prima',
      quantity: `${this.materialEntry.quantity.trim()} ${this.materialEntry.unit}`,
      location: 'Recepción',
      status: 'Disponible',
      tone: 'ready'
    }, ...rows]);
    this.materialEntryMessage.set('Entrada registrada y disponible para validar en producción.');
    this.materialEntry = { material: '', quantity: '', unit: 'unidades', supplier: '', lot: '' };
    this.showMaterialEntry.set(false);
  }

  logoutAdmin(): void {
    this.adminOpen.set(false);
    this.adminUser.set('');
    localStorage.removeItem('faraon-auth-token');
    this.goTo('home');
  }

  addToCart(product: Product, event?: Event): void {
    event?.stopPropagation();
    this.cart.add(product);
    this.checkoutMessage.set('');
    this.checkoutExpanded.set(false);
    this.cartOpen.set(true);
  }

  openCart(): void {
    this.cartOpen.set(true);
    this.checkoutMessage.set('');
  }

  closeCart(): void {
    this.cartOpen.set(false);
    this.checkoutExpanded.set(false);
  }

  private readStoredOrders(): StoredOrder[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem('faraon-orders');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed as StoredOrder[] : [];
    } catch {
      return [];
    }
  }

  private readAuthUser(): { name: string; email: string; role?: string } | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem('faraon-auth-user');
      return raw ? JSON.parse(raw) as { name: string; email: string; role?: string } : null;
    } catch {
      return null;
    }
  }

  private persistOrders(orders: StoredOrder[]): void {
    if (typeof localStorage !== 'undefined') localStorage.setItem('faraon-orders', JSON.stringify(orders));
  }

  private linkGuestOrdersToAccount(email: string): void {
    const linked = this.orders().map((order) => order.accountEmail ? order : { ...order, accountEmail: email });
    this.orders.set(linked);
    this.persistOrders(linked);
  }

  private createLocalOrder(stripePaymentIntentId: string): StoredOrder {
    const quote = this.shippingQuote();
    const createdAt = new Date().toISOString();
    const localId = `local-${Date.now()}`;
    return {
      id: localId,
      displayId: `F-${String(Date.now()).slice(-6)}`,
      paymentIntentId: stripePaymentIntentId,
      createdAt,
      status: 'preparing',
      shippingStatus: 'preparing',
      amountMxn: this.checkoutTotal(),
      shippingAmountMxn: quote.amountMxn,
      deliveryMethod: this.deliveryMethod(),
      shippingZone: quote.zone,
      address: { ...this.shippingAddress },
      items: this.cart.items().map(({ product, quantity }) => ({ productId: product.id, name: product.name, image: product.image, quantity, unitAmountMxn: this.unitPrice(product) })),
      accountEmail: this.authUser()?.email ?? null,
      carrier: '',
      trackingNumber: '',
      trackingUrl: ''
    };
  }

  private saveOrder(order: StoredOrder): void {
    const next = [order, ...this.orders().filter((existing) => existing.id !== order.id && existing.displayId !== order.displayId)];
    this.orders.set(next);
    this.persistOrders(next);
  }

  orderStatusLabel(status: OrderStatus): string {
    return this.trackingSteps.find((step) => step.status === status)?.label ?? 'En seguimiento';
  }

  orderProgress(order: StoredOrder): number {
    return Math.max(0, this.trackingSteps.findIndex((step) => step.status === order.status));
  }

  trackingPosition(order: StoredOrder): number {
    return 18 + (this.orderProgress(order) * 20);
  }

  toggleCheckout(): void {
    this.checkoutExpanded.update((expanded) => !expanded);
    this.checkoutMessage.set('');
  }

  increment(productId: string, quantity: number): void {
    this.cart.update(productId, quantity + 1);
  }

  decrement(productId: string, quantity: number): void {
    if (quantity <= 1) this.cart.remove(productId);
    else this.cart.update(productId, quantity - 1);
  }

  setPaymentMode(mode: 'cash' | 'credit'): void {
    this.paymentMode.set(mode);
    this.creditMonths.set(null);
    this.stripeCardFunding.set('unknown');
    this.stripeCardMode.set(mode === 'credit' ? 'Selecciona 3 o 6 meses y captura tu tarjeta' : 'Pago contado · una sola exhibición');
  }

  setDeliveryMethod(method: DeliveryMethod): void {
    this.deliveryMethod.set(method);
    this.checkoutMessage.set('');
  }

  setCreditMonths(months: 3 | 6): void {
    this.creditMonths.set(this.creditMonths() === months ? null : months);
    this.checkoutMessage.set('');
  }

  async checkoutCart(): Promise<void> {
    if (!this.cart.items().length) return;
    const quote = this.shippingQuote();
    if (!quote.ready) {
      this.checkoutMessage.set(quote.detail);
      return;
    }
    if (this.paymentMode() === 'credit' && this.creditMonths() === null) {
      this.checkoutMessage.set('Elige 3 o 6 meses antes de continuar.');
      return;
    }
    this.checkoutMessage.set('');
    this.stripeMessage.set('');
    this.stripeOpen.set(true);
    this.stripeLoading.set(true);
    window.setTimeout(() => this.initializeStripePayment(), 0);
  }

  closeStripePayment(force = false): void {
    if (this.stripePaying() && !force) return;
    this.stripePaymentElementInstance?.destroy();
    this.stripePaymentElementInstance = null;
    this.stripeElements = null;
    this.stripeClientSecret = '';
    this.stripeOpen.set(false);
    this.stripeLoading.set(false);
  }

  private async initializeStripePayment(): Promise<void> {
    try {
      if (this.demoMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        if (!this.stripeOpen()) return;
        this.stripeCardFunding.set('credit');
        this.stripeCardMode.set('Tarjeta demo lista para la presentación');
        this.stripeLoading.set(false);
        return;
      }
      const quote = this.shippingQuote();
      const result = await this.checkout.createPaymentIntent(this.cart.items(), this.paymentMode(), { method: this.deliveryMethod(), zone: quote.zone, amountMxn: quote.amountMxn, address: this.shippingAddress }, this.creditMonths());
      if (!result.clientSecret) throw new Error('Stripe no devolvió el client secret del pago.');
      this.stripeClientSecret = result.clientSecret;
      this.stripe = await loadStripe(APP_CONFIG.stripePublishableKey);
      if (!this.stripe || !this.stripePaymentElementHost) throw new Error('No se pudo cargar el formulario seguro de Stripe.');
      this.stripeElements = this.stripe.elements({
        clientSecret: this.stripeClientSecret,
        locale: 'es',
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#aa8327',
            colorBackground: '#f5f1e9',
            colorText: '#171816',
            colorDanger: '#8a3f2e',
            borderRadius: '0px',
            fontFamily: 'Inter, Arial, sans-serif'
          }
        }
      });
      this.stripePaymentElementInstance = this.stripeElements.create('payment', {
        layout: { type: 'accordion', radios: 'always', spacedAccordionItems: false },
        business: { name: 'El Faraón' },
        terms: { card: 'never' }
      });
      this.stripePaymentElementInstance.on('carddetailschange', ({ loading, details }) => {
        if (loading) {
          this.stripeCardFunding.set('unknown');
          this.stripeCardMode.set('Stripe está identificando tu tarjeta');
        } else if (details?.funding === 'credit') {
          this.stripeCardFunding.set('credit');
          this.stripeCardMode.set('Tarjeta de crédito · Stripe mostrará meses si aplica');
        } else if (details?.funding === 'debit') {
          this.stripeCardFunding.set('debit');
          this.stripeCardMode.set(this.paymentMode() === 'credit' ? 'Tarjeta de débito · no puedes pagar a meses' : 'Tarjeta de débito · pago en una sola exhibición');
        } else if (details?.funding === 'prepaid') {
          this.stripeCardFunding.set('prepaid');
          this.stripeCardMode.set('Tarjeta prepagada · no elegible para crédito');
        } else {
          this.stripeCardFunding.set('unknown');
          this.stripeCardMode.set('Stripe · tarjeta de crédito o débito');
        }
      });
      this.stripePaymentElementInstance.on('loaderror', ({ error }) => {
        this.stripeMessage.set(error.message || 'Stripe no pudo cargar el formulario de pago.');
      });
      this.stripePaymentElementInstance.mount(this.stripePaymentElementHost.nativeElement);
      this.stripeCardMode.set('Stripe · tarjeta de crédito o débito');
      this.stripeLoading.set(false);
    } catch (error) {
      this.stripeLoading.set(false);
      this.stripeMessage.set(this.errorMessage(error));
    }
  }

  private async completeSuccessfulPayment(paymentIntentId: string): Promise<void> {
    const localOrder = this.createLocalOrder(paymentIntentId);
    let savedOrder = localOrder;
    if (!this.demoMode) {
      try {
        const quote = this.shippingQuote();
        const order = await this.checkout.createOrder({
          stripePaymentIntentId: paymentIntentId,
          paymentMode: this.paymentMode(),
          installmentMonths: this.creditMonths(),
          amountMxn: this.checkoutTotal(),
          shipping: { method: this.deliveryMethod(), zone: quote.zone, amountMxn: quote.amountMxn, address: this.shippingAddress },
          items: this.cart.items().map(({ product, quantity }) => ({ productId: product.id, quantity }))
        });
        if (order.orderId) savedOrder = { ...localOrder, id: order.orderId, displayId: `F-${order.orderId}` };
      } catch {
        // El pedido local conserva el comprobante si la API no está disponible.
      }
    }
    this.saveOrder(savedOrder);
    this.lastOrder.set(savedOrder);
    this.selectedOrderId.set(savedOrder.id);
    this.successNotice.set(`${this.demoMode ? 'Preview completada' : 'Pago confirmado'}. Tu pedido ${savedOrder.displayId} quedó guardado y está en preparación.`);
    this.cart.clear();
    this.closeCart();
    this.closeStripePayment(true);
    this.goTo('success');
  }

  async confirmStripePayment(event: Event): Promise<void> {
    event.preventDefault();
    if (this.demoMode) {
      if (!this.canPay()) {
        this.stripeMessage.set('Completa los datos de la tarjeta demo para continuar.');
        return;
      }
      this.stripePaying.set(true);
      this.stripeMessage.set('');
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 760));
        await this.completeSuccessfulPayment(`demo_pi_${Date.now()}`);
      } catch (error) {
        this.stripeMessage.set(this.errorMessage(error));
      } finally {
        this.stripePaying.set(false);
      }
      return;
    }
    if (!this.stripe || !this.stripeElements || this.stripePaying()) return;
    if (this.paymentMode() === 'credit' && this.creditMonths() === null) {
      this.stripeMessage.set('Elige 3 o 6 meses antes de pagar.');
      return;
    }
    if (this.paymentMode() === 'credit' && this.stripeCardFunding() !== 'credit') {
      this.stripeMessage.set('Para pagar a meses necesitas una tarjeta de crédito elegible. Las tarjetas de débito no están permitidas.');
      return;
    }
    this.stripePaying.set(true);
    this.stripeMessage.set('');
    try {
      const submitted = await this.stripeElements.submit();
      if (submitted.error) throw new Error(submitted.error.message || 'Revisa los datos de pago.');
      const result = await this.stripe.confirmPayment({
        elements: this.stripeElements,
        confirmParams: { return_url: `${window.location.origin}/?payment=complete` },
        redirect: 'if_required'
      });
      if (result.error) throw new Error(result.error.message || 'Stripe no pudo confirmar el pago.');
      if (result.paymentIntent?.status === 'succeeded' || result.paymentIntent?.status === 'processing') {
        const localOrder = this.createLocalOrder(result.paymentIntent.id);
        let savedOrder = localOrder;
        try {
          const quote = this.shippingQuote();
          const order = await this.checkout.createOrder({
            stripePaymentIntentId: result.paymentIntent.id,
            paymentMode: this.paymentMode(),
            installmentMonths: this.creditMonths(),
            amountMxn: this.checkoutTotal(),
            shipping: { method: this.deliveryMethod(), zone: quote.zone, amountMxn: quote.amountMxn, address: this.shippingAddress },
            items: this.cart.items().map(({ product, quantity }) => ({ productId: product.id, quantity }))
          });
          if (order.orderId) savedOrder = { ...localOrder, id: order.orderId, displayId: `F-${order.orderId}` };
        } catch {
          // El pedido local conserva el comprobante y el seguimiento aunque la API no esté disponible.
        }
        this.saveOrder(savedOrder);
        this.lastOrder.set(savedOrder);
        this.selectedOrderId.set(savedOrder.id);
        this.successNotice.set(`Pago confirmado. Tu pedido ${savedOrder.displayId} quedó guardado y está en preparación.`);
        this.cart.clear();
        this.closeCart();
        this.closeStripePayment(true);
        this.goTo('success');
      } else {
        this.stripeMessage.set('Stripe recibió la solicitud y está verificando el pago.');
      }
    } catch (error) {
      this.stripeMessage.set(this.errorMessage(error));
    } finally {
      this.stripePaying.set(false);
    }
  }

  unitPrice(product: Product): number {
    if (this.paymentMode() === 'cash') return product.price;
    return product.previousPrice ?? Math.round(product.price / 0.85);
  }

  lineTotal(item: CartItem): number {
    return this.unitPrice(item.product) * item.quantity;
  }

  async submitContact(event: Event): Promise<void> {
    event.preventDefault();
    this.contactSending.set(true);
    this.contactMessage.set('');
    try {
      const result = await this.contact.send(this.contactForm);
      this.contactMessage.set(result.message);
      this.contactForm.name = '';
      this.contactForm.email = '';
      this.contactForm.phone = '';
      this.contactForm.message = '';
    } catch (error) {
      this.contactMessage.set(this.errorMessage(error));
    } finally {
      this.contactSending.set(false);
    }
  }

  async submitAuth(event: Event): Promise<void> {
    event.preventDefault();
    this.authSending.set(true);
    this.authMessage.set('');
    try {
      const result = this.authMode() === 'login'
        ? await this.auth.login(this.authEmail(), this.authPassword())
        : await this.auth.forgotPassword(this.authEmail());
      this.authMessage.set(result.message);
      if (result.token) {
        localStorage.setItem('faraon-auth-token', result.token);
        const user = this.decodeAuthUser(result.token, result.role);
        if (user) {
          this.authUser.set(user);
          localStorage.setItem('faraon-auth-user', JSON.stringify(user));
          if (user.email) this.linkGuestOrdersToAccount(user.email);
        }
      }
      if (result.role === 'admin') {
        this.adminUser.set(result.name ?? 'Administrador');
        this.adminSection.set('overview');
        this.adminOpen.set(true);
        this.authOpen.set(false);
      }
    } catch (error) {
      this.authMessage.set(this.errorMessage(error));
    } finally {
      this.authSending.set(false);
    }
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);
  }

  private decodeAuthUser(token: string, role?: string): { name: string; email: string; role?: string } | null {
    try {
      const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const claims = JSON.parse(new TextDecoder().decode(bytes)) as { name?: string; email?: string; role?: string };
      if (!claims.email && claims.role !== 'admin') return null;
      return { name: claims.name ?? 'Cliente', email: claims.email ?? '', role: role ?? claims.role };
    } catch {
      return null;
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof ApiRequestError && error.requestId) {
      return `${error.message} Referencia: ${error.requestId}.`;
    }
    return error instanceof Error ? error.message : 'No pudimos completar la solicitud.';
  }
}
