async function example() {
    try {
        // January 5, 2014 timestamp
        const timestamp = 1388880000;
        const data = await scrapeCoinMarketCapHistorical(timestamp, 12);
        
        console.log('Top cryptocurrencies on', new Date(timestamp * 1000).toDateString());
        data.forEach(coin => {
            console.log(`${coin.rank}. ${coin.name} (${coin.symbol}) - $${coin.marketCapFormatted}`);
        });
        
        return data;
    } catch (error) {
        console.error('Example failed:', error);
    }
}