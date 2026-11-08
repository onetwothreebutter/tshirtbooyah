// PostHog checkout pixel for Shopify.
//
// The theme can't run code on the checkout pages, so this sends the checkout
// steps to PostHog instead. To install: Shopify admin > Settings > Customer
// events > Add custom pixel, name it "PostHog", paste this whole file, put the
// same project API key as the theme setting below, Save, then Connect.
//
// It reads the PostHog cookie the theme set, so checkout events land on the
// same visitor (and session replay) as their earlier page views.

const POSTHOG_KEY = 'phc_w2yYFCdYwkndgWQkwSyXeo2W39d8VkJMTCDsetkbwMXQ';
const POSTHOG_HOST = 'https://us.i.posthog.com'; // or https://eu.i.posthog.com

async function posthogIds(event) {
  try {
    const raw = await browser.cookie.get('ph_' + POSTHOG_KEY + '_posthog');
    if (raw) {
      const data = JSON.parse(decodeURIComponent(raw));
      return {
        distinctId: data.distinct_id || event.clientId,
        sessionId: Array.isArray(data.$sesid) ? data.$sesid[1] : undefined,
      };
    }
  } catch (e) {
    // Fall through to Shopify's own visitor id.
  }
  return { distinctId: event.clientId, sessionId: undefined };
}

function checkoutProps(checkout) {
  if (!checkout) return {};
  return {
    cart_total: checkout.totalPrice ? Number(checkout.totalPrice.amount) : undefined,
    currency: checkout.currencyCode,
    item_count: (checkout.lineItems || []).reduce((n, item) => n + item.quantity, 0),
    products: (checkout.lineItems || []).map((item) => item.title),
  };
}

async function send(name, event, extra) {
  const ids = await posthogIds(event);
  const properties = Object.assign(
    {
      $current_url: event.context && event.context.document ? event.context.document.location.href : undefined,
      $process_person_profile: false,
      source: 'shopify_checkout_pixel',
    },
    checkoutProps(event.data && event.data.checkout),
    extra || {}
  );
  if (ids.sessionId) properties.$session_id = ids.sessionId;

  fetch(POSTHOG_HOST + '/i/v0/e/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      api_key: POSTHOG_KEY,
      event: name,
      distinct_id: ids.distinctId,
      timestamp: event.timestamp,
      properties,
    }),
  });
}

analytics.subscribe('checkout_started', (event) => send('checkout_started', event));
analytics.subscribe('checkout_contact_info_submitted', (event) => send('checkout_contact_info_submitted', event));
analytics.subscribe('checkout_shipping_info_submitted', (event) => send('checkout_shipping_info_submitted', event));
analytics.subscribe('payment_info_submitted', (event) => send('payment_info_submitted', event));
analytics.subscribe('checkout_completed', (event) => {
  const checkout = event.data.checkout;
  send('checkout_completed', event, {
    order_id: checkout.order ? checkout.order.id : undefined,
    revenue: checkout.totalPrice ? Number(checkout.totalPrice.amount) : undefined,
  });
});
