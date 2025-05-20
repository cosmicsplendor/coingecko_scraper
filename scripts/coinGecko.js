const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const apikey = "CG-k6yFVvmqbiDpesiehZnM4APt";

const dir = path.join(__dirname, "../export/coingecko");

const scrapeTopByMarketCap = async () => {
    const res = await axios.get("https://api.coingecko.com/api/v3/coins/markets", {
        headers: {
            "x-cg-demo-api-key": apikey
        },
        params: {
            vs_currency: "usd",
            order: "market_cap_desc",
            per_page: 120,
            page: 1,
            sparkline: false
        }
    })
    await fs.mkdir(dir, { recursive: true }); // Ensure directory exists
    await fs.writeFile(path.join(dir, "markets.json"), JSON.stringify(res.data, null, 2));
    console.log("Data written to /export/coingecko/markets.json");
}
const scrapeById = async (id) => {
    const res = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}`, {
        headers: {
            "x-cg-demo-api-key": apikey
        }
    })
    await fs.mkdir(dir, { recursive: true }); // Ensure directory exists
    await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify(res.data, null, 2));
    console.log(`Data written to /export/coingecko/${id}.json`);
}
// Function to fetch market chart data from CoinGecko
const scrapeByRange = async (id, from, to, vs_currency = "usd") => {
  try {
    const res = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}/market_chart/range`, {
      headers: {
        "x-cg-demo-api-key": apikey
      },
      params: {
        vs_currency,
        from,
        to
      },
      timeout: 0 // Infinite timeout
    });
    return res.data;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.log(`Rate limit hit for ${id}. Waiting 60 seconds before retrying...`);
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait for 60 seconds
      return scrapeByRange(id, from, to, vs_currency); // Retry the request
    }
    throw error;
  }
};
module.exports = {
    scrapeTopByMarketCap,
    scrapeById,
    scrapeByRange
}