const { scrapeTopByMarketCap, scrapeById } = require("./scripts/coinGecko");

const missingids = [ "nem", "dash", "neo", "iota", "zcash", "qtum", "lisk", "waves" ];
const scrape = async () => {
    for (const id of missingids) {
        await scrapeById(id);
    }
}
scrape()