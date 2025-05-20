const { scrapeTopByMarketCap, scrapeById, scrapeByRange } = require("./scripts/coinGecko");
const max_safe_ts = new Date("2025-05-19").valueOf() / 1000;
console.log(max_safe_ts);
// scrapeByRange()