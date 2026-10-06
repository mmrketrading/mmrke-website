// Public frontend settings only. NEVER put a Supabase service-role key or payment secret here.
window.MMRKE_CONFIG = {
  supabaseUrl: "",
  supabasePublishableKey: "",
  paypalClientId: "", // Public PayPal client ID; use sandbox first.
  pesapalEnabled: false, // Set true after deploying the Pesapal function and configuring secrets.
  paypalCurrency: "USD"
};

// Add your business contact details. Phone must include country code, digits only.
window.MMRKE_SOCIALS = {
  whatsappNumber: "256777228557",
  instagram: "",
  facebook: "",
  tiktok: "",
  linkedin: ""
};
