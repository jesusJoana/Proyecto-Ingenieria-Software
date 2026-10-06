// Alternativa ya usada en el manual: solo afecta al proceso instalador Playwright.
// No desactiva TLS ni modifica la red de Windows.
const dns = require("node:dns");
const lookup = dns.promises.lookup.bind(dns.promises);
dns.promises.lookup = (host, options) => {
  if (options?.family === 6)
    return Promise.reject(
      Object.assign(new Error("IPv4-only download"), { code: "ENOTFOUND" }),
    );
  return lookup(host, options);
};
