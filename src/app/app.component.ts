import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { loadStripe, Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js';
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

type View = 'home' | 'catalog';
type ProjectFilter = 'Todos' | 'Nueva casa' | 'Equipar varias casas' | 'Renovar un espacio';
type AdminSection = 'overview' | 'catalog' | 'sales' | 'production';
type ProductionFilter = 'Todas' | 'En curso' | 'Riesgo' | 'Listas';

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
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51QJQQvGVJUCHEoSsTs6mp65TG8BQ1rmOo7YXp3TcAyC481KX0gzVZDb4nJYXNqvLFkuNKAwSkkPhCCo3l0I1B5vv00nVs3I2Yh';

@Component({
  selector: 'faraon-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('stripePaymentElement') stripePaymentElementHost?: ElementRef<HTMLElement>;
  readonly cart = inject(CartService);
  private readonly checkout = inject(CheckoutService);
  private readonly contact = inject(ContactService);
  private readonly auth = inject(AuthService);
  readonly products = CATALOG;
  readonly view = signal<View>('home');
  readonly cartOpen = signal(false);
  readonly menuOpen = signal(false);
  readonly selectedProduct = signal<Product | null>(null);
  readonly checkoutMessage = signal('');
  readonly stripeOpen = signal(false);
  readonly stripeLoading = signal(false);
  readonly stripePaying = signal(false);
  readonly stripeMessage = signal('');
  readonly stripeCardMode = signal('Esperando datos de tarjeta');
  readonly search = signal('');
  readonly activeCategory = signal<'Todas' | ProductCategory>('Todas');
  readonly activeProject = signal<ProjectFilter>('Todos');
  readonly projectFilters: ProjectFilter[] = ['Todos', 'Nueva casa', 'Equipar varias casas', 'Renovar un espacio'];
  readonly paymentMode = signal<'cash' | 'credit'>('cash');
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

  ngOnInit(): void {
    this.syncView();
    window.addEventListener('hashchange', this.syncView);
  }

  ngAfterViewInit(): void {
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
    this.motionCleanup?.();
  }

  syncView = (): void => {
    this.view.set(window.location.hash === '#catalogo' ? 'catalog' : 'home');
    this.menuOpen.set(false);
    window.scrollTo(0, 0);
    window.setTimeout(() => window.scrollTo(0, 0), 0);
  };

  goTo(view: View): void {
    window.history.replaceState(null, '', view === 'catalog' ? '#catalogo' : '#inicio');
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
    this.cartOpen.set(true);
  }

  openCart(): void {
    this.cartOpen.set(true);
    this.checkoutMessage.set('');
  }

  closeCart(): void {
    this.cartOpen.set(false);
  }

  increment(productId: string, quantity: number): void {
    this.cart.update(productId, quantity + 1);
  }

  decrement(productId: string, quantity: number): void {
    if (quantity <= 1) this.cart.remove(productId);
    else this.cart.update(productId, quantity - 1);
  }

  async checkoutCart(): Promise<void> {
    if (!this.cart.items().length) return;
    this.checkoutMessage.set('');
    this.stripeMessage.set('');
    this.stripeOpen.set(true);
    this.stripeLoading.set(true);
    window.setTimeout(() => this.initializeStripePayment(), 0);
  }

  closeStripePayment(): void {
    if (this.stripePaying()) return;
    this.stripePaymentElementInstance?.destroy();
    this.stripePaymentElementInstance = null;
    this.stripeElements = null;
    this.stripeClientSecret = '';
    this.stripeOpen.set(false);
    this.stripeLoading.set(false);
  }

  private async initializeStripePayment(): Promise<void> {
    try {
      const result = await this.checkout.createPaymentIntent(this.cart.items(), this.paymentMode());
      if (!result.clientSecret) throw new Error('Stripe no devolvió el client secret del pago.');
      this.stripeClientSecret = result.clientSecret;
      this.stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);
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
          this.stripeCardMode.set('Stripe está identificando tu tarjeta');
        } else if (details?.funding === 'credit') {
          this.stripeCardMode.set('Tarjeta de crédito · Stripe mostrará meses si aplica');
        } else if (details?.funding === 'debit') {
          this.stripeCardMode.set('Tarjeta de débito · pago en una sola exhibición');
        } else {
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

  async confirmStripePayment(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.stripe || !this.stripeElements || this.stripePaying()) return;
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
        this.stripeMessage.set('Pago recibido. Estamos preparando tu pedido.');
        this.cart.clear();
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
      if (result.token) localStorage.setItem('faraon-auth-token', result.token);
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

  private errorMessage(error: unknown): string {
    if (error instanceof ApiRequestError && error.requestId) {
      return `${error.message} Referencia: ${error.requestId}.`;
    }
    return error instanceof Error ? error.message : 'No pudimos completar la solicitud.';
  }
}
