import {
  createClient
} from 'npm:@supabase/supabase-js@2';
const get = k => Deno.env.get(k) || '';
Deno.serve(async req => {
  const origin = req.headers.get('origin') || '',
    allowed = get('ALLOWED_ORIGINS').split(',').map(s => s.trim());
  const cors = {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'content-type,apikey,authorization',
    'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
    Vary: 'Origin'
  };
  const reply = (v, status = 200) => Response.json(v, {
    status,
    headers: cors
  });
  if (req.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: cors
  });
  const ipn = req.method === 'GET';
  if (!ipn && !allowed.includes(origin)) return reply({
    error: 'Origin not allowed'
  }, 403);
  try {
    if (!ipn && req.method !== 'POST') return reply({
      error: 'Method not allowed'
    }, 405);
    const body = ipn ? Object.fromEntries(new URL(req.url).searchParams) : await req.json();
    const db = createClient(get('SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: {
        persistSession: false
      }
    });
    const query = db.from('service_bookings').select('*');
    const {
      data: b,
      error
    } = ipn ? await query.eq('pesapal_tracking_id', body.OrderTrackingId || '')
    .maybeSingle() : await query.eq('booking_key', body.bookingKey || '').maybeSingle();
    if (error) throw error;
    if (!b) return reply({
      error: 'Booking not found'
    }, 404);
    const host = get('PESAPAL_ENV') === 'live' ? 'https://pay.pesapal.com/v3/api' :
      'https://cybqa.pesapal.com/pesapalv3/api';
    if (!get('PESAPAL_CONSUMER_KEY') || !get('PESAPAL_CONSUMER_SECRET')) return reply({
      error: 'Mobile Money and Card checkout are awaiting activation.'
    }, 503);
    const auth = await fetch(host + '/Auth/RequestToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        consumer_key: get('PESAPAL_CONSUMER_KEY'),
        consumer_secret: get('PESAPAL_CONSUMER_SECRET')
      })
    });
    const token = await auth.json();
    if (!auth.ok || !token.token) throw new Error('Pesapal authentication failed');
    const headers = {
      Authorization: 'Bearer ' + token.token,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
    if (ipn || body.action === 'verify') {
      if (!b.pesapal_tracking_id) return reply({
        error: 'No checkout exists for this booking'
      }, 409);
      const r = await fetch(host + '/Transactions/GetTransactionStatus?orderTrackingId=' +
        encodeURIComponent(b.pesapal_tracking_id), {
          headers
        });
      const status = await r.json();
      if (!r.ok || status.error?.code) throw new Error('Verification failed');
      if (Number(status.status_code) === 1) {
        if (status.merchant_reference !== b.id || Number(status.amount) !== Number(b
            .quote_amount) || status.currency !== b.currency) throw new Error(
          'Payment mismatch');
        const {
          error: save
        } = await db.from('service_bookings').update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          pesapal_confirmation: status.confirmation_code
        }).eq('id', b.id);
        if (save) throw save;
      }
      return ipn ? reply({
        orderNotificationType: 'IPNCHANGE',
        orderTrackingId: b.pesapal_tracking_id,
        orderMerchantReference: b.id,
        status: 200
      }) : reply({
        status: Number(status.status_code) === 1 ? 'paid' : 'pending'
      });
    }
    if (body.action !== 'create') return reply({
      error: 'Invalid action'
    }, 400);
    if (b.status !== 'quoted' || !b.quote_amount) return reply({
      error: 'An approved quote is required before payment.'
    }, 409);
    if (b.payment_provider && b.payment_provider !== 'pesapal') return reply({
      error: 'PayPal checkout has already started. Complete that checkout or contact the business.'
    }, 409);
    if (b.pesapal_redirect_url) return reply({
      redirectUrl: b.pesapal_redirect_url
    });
    if (!get('PESAPAL_IPN_ID') || !get('SITE_URL')) return reply({
      error: 'Checkout is awaiting activation.'
    }, 503);
    const {
      data: lock,
      error: lockError
    } = await db.from('service_bookings').update({
      payment_provider: 'pesapal'
    }).eq('id', b.id).eq('status', 'quoted').or(
      'payment_provider.is.null,payment_provider.eq.pesapal').select('id').maybeSingle();
    if (lockError || !lock) throw new Error('Checkout lock failed');
    const r = await fetch(host + '/Transactions/SubmitOrderRequest', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: b.id,
        currency: b.currency,
        amount: Number(b.quote_amount),
        description: b.service,
        callback_url: get('SITE_URL'),
        notification_id: get('PESAPAL_IPN_ID'),
        billing_address: {
          email_address: b.email,
          phone_number: b.phone,
          first_name: b.full_name,
          country_code: 'UG'
        }
      })
    });
    const order = await r.json();
    if (!r.ok || !order.order_tracking_id || !order.redirect_url) throw new Error(
      'Order creation failed');
    const {
      error: save
    } = await db.from('service_bookings').update({
      pesapal_tracking_id: order.order_tracking_id,
      pesapal_redirect_url: order.redirect_url
    }).eq('id', b.id);
    if (save) throw save;
    return reply({
      redirectUrl: order.redirect_url
    });
  } catch (e) {
    console.error('Pesapal operation failed', e);
    return reply({
      error: 'Unable to process checkout. If you have paid, keep the provider receipt and check your booking before retrying.'
    }, 503);
  }
});
