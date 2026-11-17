const MERCHANT_DOMAINS = [
  { store: "Amazon", domains: ["amazon.in"] },
  { store: "Flipkart", domains: ["flipkart.com"] },
  { store: "Croma", domains: ["croma.com"] },
  { store: "Reliance Digital", domains: ["reliancedigital.in"] },
  { store: "Vijay Sales", domains: ["vijaysales.com"] },
  { store: "Tata CLiQ", domains: ["tatacliq.com"] },
  { store: "JioMart", domains: ["jiomart.com"] },
  { store: "Pepperfry", domains: ["pepperfry.com"] },
  { store: "Urban Ladder", domains: ["urbanladder.com"] },
  { store: "IKEA", domains: ["ikea.com"] },
  { store: "Wakefit", domains: ["wakefit.co"] },
  { store: "Myntra", domains: ["myntra.com"] },
  { store: "AJIO", domains: ["ajio.com"] },
  { store: "Nykaa", domains: ["nykaa.com"] },
  { store: "Decathlon", domains: ["decathlon.in"] },
  { store: "Samsung", domains: ["samsung.com"] },
  { store: "Apple", domains: ["apple.com"] },
  { store: "OnePlus", domains: ["oneplus.in", "oneplus.com"] },
  { store: "Xiaomi", domains: ["mi.com"] },
  { store: "Vivo", domains: ["vivo.com"] },
  { store: "OPPO", domains: ["oppo.com"] },
  { store: "Sony", domains: ["sony.co.in", "sony.com"] },
  { store: "LG", domains: ["lg.com"] },
  { store: "HP", domains: ["hp.com"] },
  { store: "Dell", domains: ["dell.com"] },
  { store: "Lenovo", domains: ["lenovo.com"] },
  { store: "ASUS", domains: ["asus.com"] },
  { store: "Acer", domains: ["acer.com"] },
  { store: "Motorola", domains: ["motorola.in", "motorola.com"] },
  { store: "Nothing", domains: ["nothing.tech"] }
];

function trustedStoreFromUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    const merchant = MERCHANT_DOMAINS.find(({ domains }) =>
      domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
    );
    return merchant?.store || null;
  } catch {
    return null;
  }
}

function trustedMerchantUrl(value) {
  if (!trustedStoreFromUrl(value)) return null;
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

module.exports = { trustedStoreFromUrl, trustedMerchantUrl };
