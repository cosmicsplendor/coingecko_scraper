const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const apikey = "CG-k6yFVvmqbiDpesiehZnM4APt";

const dir = path.join(__dirname, "../export/coingecko");

axios.get("https://api.coingecko.com/api/v3/coins/markets", {
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
}).then(async res => {
    await fs.mkdir(dir, { recursive: true }); // Ensure directory exists
    await fs.writeFile(path.join(dir, "markets.json"), JSON.stringify(res.data, null, 2));
    console.log("Data written to /export/coingecko/markets.json");
}).catch(err => {
    console.error(err);
});