/**
 * Configuración pública del cliente.
 *
 * El cliente usa Stripe en modo test. La clave secreta de Stripe, Resend y
 * las credenciales de Supabase viven únicamente en la API.
 */
export const APP_CONFIG = {
  demoMode: false,
  apiBaseUrl: 'https://faraon-api.vercel.app',
  stripePublishableKey: 'pk_test_51QJQQvGVJUCHEoSsTs6mp65TG8BQ1rmOo7YXp3TcAyC481KX0gzVZDb4nJYXNqvLFkuNKAwSkkPhCCo3l0I1B5vv00nVs3I2Yh'
} as const;
