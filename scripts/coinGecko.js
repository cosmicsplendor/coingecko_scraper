const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const apikey = "CG-k6yFVvmqbiDpesiehZnM4APt";

const dir = path.join(__dirname, "../export/coingecko");

axios.get("https://api.coingecko.com/api/v3/coins/list", {
    headers: {
        "x-cg-demo-api-key": apikey
    }
}).then(async res => {
    await fs.mkdir(dir, { recursive: true }); // Ensure directory exists
    await fs.writeFile(path.join(dir, "list.json"), JSON.stringify(res.data, null, 2));
    console.log("Data written to /export/coingecko/list.json");
}).catch(err => {
    console.error(err);
});