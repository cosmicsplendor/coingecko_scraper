const cheerio = require('cheerio');
const axios = require('axios');

/**
 * Converts Unix timestamp to CoinMarketCap historical URL
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} - Formatted URL
 */
function timestampToUrl(timestamp) {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `https://coinmarketcap.com/historical/${year}${month}${day}/`;
}

/**
 * Scrapes cryptocurrency data from CoinMarketCap historical page
 * @param {number} timestamp - Unix timestamp in seconds
 * @param {number} topN - Number of top cryptocurrencies to return (default: 12)
 * @returns {Promise<Array>} - Array of cryptocurrency data objects
 */
async function scrapeCoinMarketCapHistorical(timestamp, topN = 12) {
    try {
        const url = timestampToUrl(timestamp);
        console.log(`Fetching data from: ${url}`);
        
        // Fetch the page with proper headers to avoid blocking
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 10000
        });
        
        const $ = cheerio.load(response.data);
        const cryptoData = [];
        
        // Target the table rows containing cryptocurrency data
        const tableRows = $('tbody tr.cmc-table-row').slice(0, topN);
        
        tableRows.each((index, row) => {
            try {
                const $row = $(row);
                
                // Extract rank
                const rank = parseInt($row.find('td:first-child div').text().trim()) || index + 1;
                
                // Extract name and symbol from the name column
                const nameCell = $row.find('.cmc-table__column-name');
                const name = nameCell.find('.cmc-table__column-name--name').text().trim();
                const symbol = nameCell.find('.cmc-table__column-name--symbol').text().trim();
                
                // Extract image URL
                const imageUrl = nameCell.find('img').attr('src') || '';
                
                // Extract market cap (4th column)
                const marketCapText = $row.find('td').eq(3).find('div').text().trim();
                const marketCap = parseFloat(marketCapText.replace(/[$,]/g, '')) || 0;
                
                // Extract price (5th column)
                const priceText = $row.find('td').eq(4).find('div').text().trim();
                const price = parseFloat(priceText.replace(/[$,]/g, '')) || 0;
                
                // Extract circulating supply (6th column)
                const supplyText = $row.find('td').eq(5).find('div').text().trim();
                const circulatingSupply = parseFloat(supplyText.replace(/[,\s]/g, '').split(symbol)[0]) || 0;
                
                // Extract 24h volume (7th column)
                const volumeText = $row.find('td').eq(6).text().trim();
                const volume24h = parseFloat(volumeText.replace(/[$,]/g, '')) || 0;
                
                // Extract percentage changes
                const change1h = parseFloat($row.find('td').eq(7).find('div').text().replace('%', '')) || 0;
                const change24h = parseFloat($row.find('td').eq(8).find('div').text().replace('%', '')) || 0;
                const change7d = parseFloat($row.find('td').eq(9).find('div').text().replace('%', '')) || 0;
                
                if (name && symbol) {
                    cryptoData.push({
                        rank,
                        name,
                        symbol,
                        imageUrl,
                        marketCap,
                        price,
                        circulatingSupply,
                        volume24h,
                        change1h,
                        change24h,
                        change7d,
                        marketCapFormatted: marketCapText,
                        priceFormatted: priceText,
                        timestamp,
                        date: new Date(timestamp * 1000).toISOString().split('T')[0]
                    });
                }
            } catch (error) {
                console.warn(`Error parsing row ${index + 1}:`, error.message);
            }
        });
        
        console.log(`Successfully scraped ${cryptoData.length} cryptocurrencies`);
        return cryptoData;
        
    } catch (error) {
        console.error('Error scraping CoinMarketCap:', error.message);
        throw new Error(`Failed to scrape data: ${error.message}`);
    }
}

/**
 * Alternative selectors in case the main ones fail
 */
const alternativeSelectors = {
    tableRow: 'tr[style*="display:table-row"], tbody tr',
    nameColumn: '.cmc-table__column-name, [class*="column-name"]',
    name: '.cmc-table__column-name--name, [title] a:last-child',
    symbol: '.cmc-table__column-name--symbol, [title] a:first-child',
    image: 'img[alt], img[src*="coins"]',
    marketCap: 'td:nth-child(4) div, [class*="market-cap"] div',
    price: 'td:nth-child(5) div, [class*="price"] div'
};

module.exports = {
    scrapeCoinMarketCapHistorical,
    timestampToUrl,
    alternativeSelectors
};