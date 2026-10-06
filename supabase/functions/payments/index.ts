import {
  createClient
} from 'npm:@supabase/supabase-js@2';
const get = (key) => Deno.env.get(key) || '';
Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const allowed = get('ALLOWED_ORIGINS').split(',').map(x => x.trim()).filter(Boolean);
  const cors = {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
  const respond = (value, status = 200) => Response.json(value, {
    status,
    headers: cors
  });
  if (!allowed.includes(origin)) return respond({
    error: 'This website is not enabled for payments.'
  }, 403);
  if (req.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: cors
  });
  if (req.method !== 'POST') return respond({
    error: 'Method not allowed'
  }, 405);
  try {
    const {
      action,
      bookingKey,
      orderId
    } = await req.json();
    if (typeof bookingKey !== 'string' || !
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingKey))
      return respond({
        error: 'Invalid booking key.'
      }, 400);
    const db = createClient(get('SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: {
        persistSession: false
      }
    });
    const {
      data: b,
      error
    } = await db.from('service_bookings').select('*').eq('booking_key', bookingKey)
      .maybeSingle();
    if (error) throw error;
    if (!b) return respond({
      error: 'Booking not found.'
    }, 404);
    if (action === 'status') return respond({
      service: b.service,
      status: b.status,
      amount: b.quote_amount ? Number(b.quote_amount).toFixed(2) : null,
      currency: b.currency
    });
    if (b.status === 'paid') return action === 'capture' ? respond({
      status: 'paid'
    }) : respond({
      error: 'This booking is already paid.'
    }, 409);
    if (b.status !== 'quoted' || !b.quote_amount) return respond({
      error: 'A quote must be approved before payment.'
    }, 409);
    if (!['create', 'capture'].includes(action)) return respond({
      error: 'Invalid action.'
    }, 400);
    const host = get('PAYPAL_ENV') === 'live' ? 'https://api-m.paypal.com' :
      'https://api-m.sandbox.paypal.com';
    if (!get('PAYPAL_CLIENT_ID') || !get('PAYPAL_CLIENT_SECRET')) return respond({
      error: 'Online checkout is awaiting activation.'
    }, 503);
    const tokenResponse = await fetch(host + '/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(get('PAYPAL_CLIENT_ID') + ':' + get(
          'PAYPAL_CLIENT_SECRET')),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error('PayPal authentication failed');
    const headers = {
      Authorization: 'Bearer ' + token.access_token,
      'Content-Type': 'application/json'
    };
    async function paypal(path, method = 'GET', body = undefined, id = undefined) {
      const r = await fetch(host + path, {
        method,
        headers: {
          ...headers,
          ...(id ? {
            'PayPal-Request-Id': id
          } : {})
        },
        ...(body ? {
          body: JSON.stringify(body)
        } : {})
      });
      const data = await r.json();
      if (!r.ok) throw new Error('PayPal request failed');
      return data;
    }
    if (action === 'create') {
      if (b.payment_provider && b.payment_provider !== 'paypal') return respond({
        error: 'Pesapal checkout has already started. Complete that checkout or contact the business.'
      }, 409);
      const {
        data: lock,
        error: lockError
      } = await db.from('service_bookings').update({
        payment_provider: 'paypal'
      }).eq('id', b.id).eq('status', 'quoted').or(
        'payment_provider.is.null,payment_provider.eq.paypal').select('id').maybeSingle();
      if (lockError || !lock) throw new Error('Checkout lock failed');
      if (b.paypal_order_id) return respond({
        orderId: b.paypal_order_id
      });
      const order = await paypal('/v2/checkout/orders', 'POST', {
        intent: 'CAPTURE',
        purchase_units: [{
          custom_id: b.id,
          description: b.service,
          amount: {
            currency_code: 'USD',
            value: Number(b.quote_amount).toFixed(2)
          }
        }]
      }, b.id);
      const {
        error: save
      } = await db.from('service_bookings').update({
        paypal_order_id: order.id
      }).eq('id', b.id).is('paypal_order_id', null);
      if (save) throw save;
      return respond({
        orderId: order.id
      });
    }
    if (typeof orderId !== 'string' || orderId !== b.paypal_order_id) return respond({
      error: 'Order does not match this booking.'
    }, 400);
    let order = await paypal('/v2/checkout/orders/' + encodeURIComponent(orderId));
    if (order.status !== 'COMPLETED') order = await paypal('/v2/checkout/orders/' +
      encodeURIComponent(orderId) + '/capture', 'POST', {}, 'capture-' + b.id);
    const unit = order.purchase_units?.[0],
      capture = unit?.payments?.captures?.[0];
    if (order.status !== 'COMPLETED' || capture?.status !== 'COMPLETED' || unit.custom_id !==
      b.id || capture.amount?.currency_code !== 'USD' || Number(capture.amount?.value) !==
      Number(b.quote_amount)) throw new Error('Payment not verified');
    const {
      error: save
    } = await db.from('service_bookings').update({
      status: 'paid',
      paypal_capture_id: capture.id,
      paid_at: new Date().toISOString()
    }).eq('id', b.id).eq('paypal_order_id', orderId);
    if (save) throw save;
    return respond({
      status: 'paid'
    });
  } catch (e) {
    console.error('Payment operation failed', e);
    return respond({
      error: 'Unable to complete this payment operation. Please try again or contact the business.'
    }, 503);
  }
});
