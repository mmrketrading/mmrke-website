"use strict";
const services = [
  ["Web Development", "BUILD YOUR PRESENCE",
    "Business websites, online stores and custom web applications.",
    "<rect x='3' y='4' width='18' height='14' rx='2'/><path d='m9 8-3 3 3 3m6-6 3 3-3 3M8 22h8m-4-4v4'/>"
  ],
  ["Digital Marketing", "GROW YOUR REACH",
    "Social media strategy, content and digital growth support.",
    "<path d='M4 20V14m6 6V10m6 10V6m6 14V2M3 9l6-5 6 2 6-5'/>"
  ],
  ["Advertising & Marketing", "REACH THE RIGHT PEOPLE",
    "Campaign planning for Google, Meta and other advertising platforms.",
    "<path d='M3 10v4l15 5V5L3 10Zm15-5v14M6 15l2 7h4l-2-6m12-7v6'/>"
  ],
  ["Market Research", "MAKE INFORMED MOVES",
    "Understand your market, customers and business opportunities.",
    "<circle cx='10' cy='10' r='7'/><path d='m15 15 7 7M6 13v-3m4 3V7m4 6V5'/>"
  ],
  ["Public Opinion Polling", "LISTEN & UNDERSTAND",
    "Surveys and polling to gather meaningful public perspectives.",
    "<circle cx='12' cy='7' r='3'/><path d='M6 22v-4a6 6 0 0 1 12 0v4M2 20v-4m20 4v-4'/><circle cx='3' cy='9' r='2'/><circle cx='21' cy='9' r='2'/>"
  ],
  ["Professional & Technical Services", "GET SPECIALIST SUPPORT",
    "Practical technical assistance tailored to your project.",
    "<circle cx='12' cy='12' r='4'/><path d='M9 3h6l1 4 4 1 1 6-4 2-1 4-6 1-2-4-4-1-1-6 4-2 2-5Z'/>"
  ]
];
const $ = id => document.getElementById(id),
  cfg = window.MMRKE_CONFIG || {};
let selected = 0,
  step = 1,
  lastBooking = null,
  paypalPromise, paymentPreference = "";
const configured = Boolean(cfg.supabaseUrl && cfg.supabasePublishableKey && window.supabase);
const db = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey) :
  null;

function error(message) {
  $('booking-error').textContent = message;
  $('booking-error').hidden = !message
}

function go(n) {
  step = n;
  $('payment-picker').hidden = n !== 0;
  $('payment-preference-summary').hidden = n === 0 || n === 3;
  document.querySelector('.progress').hidden = n === 0;
  $('details-step').hidden = n !== 1;
  $('review-step').hidden = n !== 2;
  $('booking-form').hidden = n === 3 || n === 0;
  $('complete-step').hidden = n !== 3;
  $('consent').required = n === 2;
  [1, 2, 3].forEach(i => $('progress-' + i).classList.toggle('current', i <= n))
}

function renderServices() {
  $('services-list').innerHTML = services.map(([name, tag, desc, path], i) =>
    `<button type="button" class="service ${i===selected?'active':''}" aria-pressed="${i===selected}" data-service="${i}"><div class="card-top"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg><span class="selection">${i===selected?'✓':''}</span></div><small>${tag}</small><h3>${name}</h3><p>${desc}</p></button>`
  ).join('');
  $('selected-service').textContent = services[selected][0];
  if (typeof enhanceSelection === 'function') enhanceSelection();
}
$('services-list').addEventListener('click', e => {
  const button = e.target.closest('[data-service]');
  if (!button) return;
  selected = Number(button.dataset.service);
  paymentPreference = '';
  go(0);
  error('');
  renderServices();
  $('booking').scrollIntoView({
    behavior: motion.matches ? 'auto' : 'smooth',
    block: 'start'
  });
  $('payment-picker').querySelector('button').focus({
    preventScroll: true
  })
});
$('year').textContent = new Date().getFullYear();
$('booking-form').elements.date.min = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
$('menu').onclick = () => {
  const open = $('navigation').classList.toggle('open');
  $('menu').setAttribute('aria-expanded', open)
};
document.querySelectorAll('.faq-item button').forEach(b => b.onclick = () => {
  const open = b.getAttribute('aria-expanded') !== 'true';
  b.setAttribute('aria-expanded', open);
  b.nextElementSibling.hidden = !open;
  b.querySelector('span').textContent = open ? '−' : '+'
});
$('edit-details').onclick = () => {
  go(1);
  error('')
};
$('new-booking').onclick = () => {
  go(1);
  $('booking-form').reset();
  lastBooking = null;
  error('')
};
$('booking-form').addEventListener('submit', async e => {
  e.preventDefault();
  error('');
  const form = e.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  if (step === 1) {
    $('review-fields').replaceChildren();
    [
      ['Client', data.name],
      ['Email', data.email],
      ['Phone', data.phone],
      ['Preferred date', data.date],
      ['Payment method', paymentPreference]
    ].forEach(([title, value]) => {
      const dt = document.createElement('dt'),
        dd = document.createElement('dd');
      dt.textContent = title;
      dd.textContent = value;
      $('review-fields').append(dt, dd)
    });
    $('project-description').textContent = data.details;
    go(2);
    return;
  }
  if (!db) {
    error(
      'Online booking is awaiting activation. Please try again after the business connects its booking system.'
    );
    return;
  }
  const button = $('submit-booking');
  button.disabled = true;
  button.textContent = 'Saving your request…';
  try {
    const {
      data: result,
      error: err
    } = await db.rpc('submit_service_booking', {
      p_name: data.name.trim(),
      p_email: data.email.trim(),
      p_phone: data.phone.trim(),
      p_service: services[selected][0],
      p_date: data.date,
      p_details: data.details.trim(),
      p_payment_method: paymentPreference
    });
    if (err) throw err;
    if (!result?.booking_key) throw new Error('No receipt received');
    lastBooking = {
      ...data,
      paymentMethod: paymentPreference,
      service: services[selected][0],
      key: result.booking_key
    };
    $('booking-key').textContent = result.booking_key;
    $('receipt-service').textContent = lastBooking.service;
    $('receipt-date').textContent = 'Preferred date: ' + data.date;
    go(3)
  } catch (err) {
    console.error('Booking failed', err);
    error('We could not save your booking. Your details are still here; please try again.')
  } finally {
    button.disabled = false;
    button.textContent = 'Submit booking request';
  }
});
$('download-receipt').onclick = () => {
  if (!lastBooking) return;
  const b = lastBooking;
  const content =
    `MMRKE TRADING GLOBAL SOLUTIONS\nBooking request\n\nPrivate booking key: ${b.key}\nService: ${b.service}\nClient: ${b.name}\nPreferred date: ${b.date}\nStatus: Awaiting quote\nPayment: Not paid\n\nKeep your key private. Return to the website to view your quote and pay.\n`;
  const url = URL.createObjectURL(new Blob([content], {
    type: 'text/plain'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'MMRKE-booking-receipt.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000)
};
async function paymentApi(action, key, orderId) {
  if (!db) throw new Error('Booking and payments are awaiting activation.');
  const r = await fetch(cfg.supabaseUrl + '/functions/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.supabasePublishableKey
    },
    body: JSON.stringify({
      action,
      bookingKey: key,
      orderId
    })
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || 'Payment service unavailable.');
  return result;
}

function loadPayPal() {
  if (window.paypal) return Promise.resolve();
  if (paypalPromise) return paypalPromise;
  paypalPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(cfg
      .paypalClientId) + '&currency=USD&intent=capture';
    s.onload = resolve;
    s.onerror = () => {
      paypalPromise = null;
      s.remove();
      reject(new Error('Unable to load PayPal. Please try again.'))
    };
    document.head.append(s)
  });
  return paypalPromise;
}
let verifiedQuote = null;
$('lookup-booking').onclick = async () => {
  verifiedQuote = null;
  const button = $('lookup-booking'),
    key = $('lookup-key').value.trim();
  $('quote-result').textContent = '';
  $('paypal-buttons').replaceChildren();
  if (!/^[0-9a-f-]{36}$/i.test(key)) {
    $('quote-result').textContent = 'Enter the full private key from your receipt.';
    return
  }
  button.disabled = true;
  try {
    if (cfg.pesapalEnabled) {
      const r = await fetch(cfg.supabaseUrl + '/functions/v1/pesapal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.supabasePublishableKey
        },
        body: JSON.stringify({
          action: 'verify',
          bookingKey: key
        })
      });
      if (!r.ok && r.status !== 409) console.warn('Payment verification unavailable');
    }
    const b = await paymentApi('status', key);
    verifiedQuote = {
      ...b,
      key
    };
    $('quote-result').textContent = b.status === 'paid' ?
      `Payment received for ${b.service}. Thank you.` : b.status === 'quoted' ?
      `${b.service} — Approved quote: USD ${b.amount}. Review the amount before continuing.` :
      `${b.service} — Awaiting quote. No payment is due yet.`;
    if (b.status === 'quoted') {
      $('payment-feedback').textContent = 'Choose your preferred payment method below.';
    }
  } catch (e) {
    $('quote-result').textContent = e.message
  } finally {
    button.disabled = false
  }
};


const projectOptions = [
  ['Business website', 'Online store', 'Online booking', 'Customer accounts',
    'Mobile-friendly design', 'Website management'
  ],
  ['Content strategy', 'Social media management', 'Search visibility', 'Email campaigns',
    'Campaign reporting'
  ],
  ['Google Ads', 'Meta campaigns', 'TikTok campaigns', 'Creative production',
    'Audience targeting'
  ],
  ['Customer insights', 'Competitor analysis', 'Market opportunities', 'Research report'],
  ['Survey design', 'Public opinion survey', 'Data analysis', 'Results report'],
  ['Technical consultation', 'System setup', 'Troubleshooting', 'Ongoing support']
];
const insights = [
  ['A website built around your business', ['Make your services easy to discover',
    'Give customers a clear way to book', 'Keep the experience smooth on mobile'
  ]],
  ['Turn attention into lasting interest', ['Plan content around your audience',
    'Build a consistent online presence', 'Measure what matters to your business'
  ]],
  ['Bring your message to the right audience', ['Define your campaign goals',
    'Choose platforms that fit your customers', 'Track performance against your brief'
  ]],
  ['A clearer view of your market', ['Explore customer needs',
    'Understand your competitive landscape', 'Use findings to guide your next step'
  ]],
  ['Make room for informed perspectives', ['Define the questions worth asking',
    'Choose a suitable survey approach', 'Turn responses into useful findings'
  ]],
  ['Practical support for the work ahead', ['Clarify your technical challenge',
    'Identify the right approach', 'Plan implementation and ongoing support'
  ]]
];

function enhanceSelection() {
  $('insight-title').textContent = insights[selected][0];
  $('insight-list').replaceChildren();
  insights[selected][1].forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    $('insight-list').append(li)
  });
  $('brief-options').replaceChildren();
  projectOptions[selected].forEach(text => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.setAttribute('aria-pressed', 'false');
    b.onclick = () => {
      const active = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(active));
      b.classList.toggle('picked', active)
    };
    $('brief-options').append(b)
  });
  $('brief-feedback').textContent = '';
  $('mobile-service').textContent = services[selected][0];
  $('picker-service').textContent = services[selected][0];
}
$('apply-brief').onclick = () => {
  const choices = [...$('brief-options').querySelectorAll('[aria-pressed="true"]')].map(b => b
    .textContent);
  if (!choices.length) {
    $('brief-feedback').textContent = 'Choose at least one project requirement.';
    return
  }
  const field = $('booking-form').elements.details,
    line = 'Project requirements: ' + choices.join(', ') + '.';
  if (field.value.includes(line)) {
    $('brief-feedback').textContent = 'These selections are already in your brief.';
    return
  }
  const next = field.value.trim() + (field.value.trim() ? '\n\n' : '') + line;
  if (next.length > 3000) {
    $('brief-feedback').textContent =
      'Your brief is full. Shorten it before adding requirements.';
    return
  }
  field.value = next;
  field.dispatchEvent(new Event('input', {
    bubbles: true
  }));
  $('brief-feedback').textContent = 'Added to your brief. You can edit the text below.';
  field.focus();
};
$('booking-form').elements.details.addEventListener('input', e => {
  $('character-count').textContent = e.target.value.length + ' / 3000'
});
$('new-booking').addEventListener('click', () => {
  $('character-count').textContent = '0 / 3000';
  enhanceSelection()
});
$('copy-key').onclick = async () => {
  if (!lastBooking) return;
  try {
    await navigator.clipboard.writeText(lastBooking.key);
    $('copy-feedback').textContent = 'Booking key copied.'
  } catch {
    $('copy-feedback').textContent = 'Select and copy the key above, or download your receipt.'
  }
};
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const revealElements = document.querySelectorAll(
  '.how-item,.faq-item,.service-insight,.faq>div:first-child');
if (!motion.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target)
      }
    })
  }, {
    threshold: 0.1
  });
  revealElements.forEach(el => {
    el.classList.add('reveal');
    observer.observe(el)
  });
  motion.addEventListener('change', e => {
    if (e.matches) {
      revealElements.forEach(el => el.classList.add('visible'));
      observer.disconnect()
    }
  });
}
let framePending = false;

function updateScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  $('reading-progress').style.transform = 'scaleX(' + (max > 0 ? Math.min(1, Math.max(0, scrollY /
    max)) : 0) + ')';
  document.body.classList.toggle('scrolled', scrollY > 250);
  framePending = false
}
window.addEventListener('scroll', () => {
  if (!framePending) {
    framePending = true;
    requestAnimationFrame(updateScroll)
  }
}, {
  passive: true
});
window.addEventListener('resize', updateScroll);
updateScroll();
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => {
    entries.forEach(e => document.body.classList.toggle('booking-visible', e.isIntersecting))
  }, {
    threshold: 0.05
  }).observe($('booking'))
}
$('navigation').querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  $('navigation').classList.remove('open');
  $('menu').setAttribute('aria-expanded', 'false')
}));
renderServices();
go(0);

$('payment-options').querySelectorAll('[data-payment]').forEach(button => button.onclick =
  async () => {
    const feedback = $('payment-feedback');
    if (!verifiedQuote || verifiedQuote.key !== $('lookup-key').value.trim() || verifiedQuote
      .status !== 'quoted') {
      feedback.textContent = 'Enter your booking key and view an approved quote first.';
      $('lookup-key').focus();
      return
    }
    const key = verifiedQuote.key;
    button.disabled = true;
    $('paypal-buttons').replaceChildren();
    try {
      if (button.dataset.payment !== 'paypal') {
        if (!cfg.pesapalEnabled) {
          feedback.textContent =
            'Mobile Money and Card checkout are awaiting activation. No payment has been collected.';
          return
        }
        feedback.textContent = 'Opening secure Pesapal checkout…';
        const r = await fetch(cfg.supabaseUrl + '/functions/v1/pesapal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: cfg.supabasePublishableKey
          },
          body: JSON.stringify({
            bookingKey: key,
            action: 'create'
          })
        });
        const result = await r.json();
        if (!r.ok) throw new Error(result.error || 'Checkout unavailable.');
        const url = new URL(result.redirectUrl);
        if (url.protocol !== 'https:' || !['pay.pesapal.com', 'cybqa.pesapal.com'].includes(url
            .hostname)) throw new Error('Invalid checkout address.');
        location.assign(url.href);
        return;
      }
      if (!cfg.paypalClientId) {
        feedback.textContent =
          'PayPal checkout is awaiting activation. No payment has been collected.';
        return
      }
      feedback.textContent = 'Continue with PayPal below.';
      await loadPayPal();
      await window.paypal.Buttons({
        createOrder: async () => {
          const r = await paymentApi('create', key);
          return r.orderId
        },
        onApprove: async data => {
          try {
            await paymentApi('capture', key, data.orderID);
            verifiedQuote.status = 'paid';
            feedback.textContent = 'Payment confirmed. Thank you!';
            $('paypal-buttons').replaceChildren()
          } catch (e) {
            feedback.textContent = e.message +
              ' If charged, keep your provider receipt before retrying.'
          }
        },
        onCancel: () => {
          feedback.textContent = 'Checkout cancelled.'
        },
        onError: () => {
          feedback.textContent = 'Checkout could not be completed. Please try again.'
        }
      }).render('#paypal-buttons');
    } catch (e) {
      feedback.textContent = e.message
    } finally {
      button.disabled = false
    }
  });

$('payment-picker').querySelectorAll('[data-preference]').forEach(b => b.onclick = () => {
  paymentPreference = b.dataset.preference;
  $('preference-label').textContent = paymentPreference;
  go(1);
  $('booking').scrollIntoView({
    behavior: motion.matches ? 'auto' : 'smooth',
    block: 'start'
  })
});
$('change-preference').onclick = () => go(0);
$('new-booking').addEventListener('click', () => {
  paymentPreference = '';
  go(0)
});
// After Pesapal returns, verify on the server without exposing the private key in a URL.
const callback = new URLSearchParams(location.search);
if (callback.has('OrderTrackingId')) {
  const box = document.querySelector('.return-booking');
  box.open = true;
  $('quote-result').textContent =
    'Payment processing finished. Enter your private booking key to verify the result.';
  history.replaceState(null, '', location.pathname + location.hash);
}

// Keep floating controls clear of phone keyboards.
if (window.visualViewport) {
  const syncKeyboard = () => document.body.classList.toggle('keyboard-open', window.visualViewport
    .height < window.innerHeight * 0.75 && /INPUT|TEXTAREA/.test(document.activeElement
      ?.tagName || ''));
  window.visualViewport.addEventListener('resize', syncKeyboard);
  document.addEventListener('focusin', syncKeyboard);
  document.addEventListener('focusout', () => requestAnimationFrame(syncKeyboard));
}

// Business social links. Unconfigured buttons never lead to unrelated profiles.
const socialSettings = window.MMRKE_SOCIALS || {};
const socialItems = [
  ["WhatsApp", "whatsappNumber", "WA"],
  ["Instagram", "instagram", "IG"],
  ["Facebook", "facebook", "f"],
  ["TikTok", "tiktok", "TK"],
  ["LinkedIn", "linkedin", "in"]
];

function socialUrl(key) {
  const value = (socialSettings[key] || "").trim();
  if (key === "whatsappNumber") {
    return /^\d{8,15}$/.test(value) ? "https://wa.me/" + value + "?text=" + encodeURIComponent("Hello MMRKE, I would like to discuss a project.") : "";
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function unavailableSocial() {
  $("social-feedback").textContent = "This contact link is not available yet.";
  $("social-title").scrollIntoView({
    behavior: motion.matches ? "auto" : "smooth",
    block: "center"
  });
}
socialItems.forEach(([label, key, mark]) => {
  const url = socialUrl(key);
  const control = document.createElement(url ? "a" : "button");
  if (url) {
    control.href = url;
    control.target = "_blank";
    control.rel = "noopener noreferrer";
  } else {
    control.type = "button";
    control.onclick = unavailableSocial;
  }
  const icon = document.createElement("span");
  icon.className = "social-mark";
  const image = document.createElement("img");
  const slug = label.toLowerCase();
  image.src = "assets/social/" + slug + ".svg";
  image.alt = "";
  image.width = 22;
  image.height = 22;
  icon.append(image);
  icon.setAttribute("aria-hidden", "true");
  control.append(icon, document.createTextNode(label));
  $("social-links").append(control);
});
$("whatsapp-contact").onclick = () => {
  const url = socialUrl("whatsappNumber");
  if (url) window.open(url, "_blank", "noopener,noreferrer");
  else unavailableSocial();
};
