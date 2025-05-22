const { scrapeCoinMarketCapHistorical } = require("./scripts/coinMarketCap");
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

// Hash to track downloaded images to avoid duplicates
const downloadedImages = new Set();
const imageFolder = 'race-images';

/**
 * Converts image URL from 32x32 to 64x64
 * @param {string} imageUrl - Original image URL
 * @returns {string} - Modified URL for 64x64 image
 */
function convertImageUrl(imageUrl) {
    return imageUrl.replace('/32x32/', '/64x64/');
}

/**
 * Sanitizes filename for safe file system usage
 * @param {string} name - Original name
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9\-_]/g, '_').toLowerCase();
}

/**
 * Downloads an image if not already downloaded
 * @param {string} imageUrl - URL of the image
 * @param {string} coinName - Name of the coin for filename
 * @returns {Promise<string>} - Path to downloaded image or existing image
 */
async function downloadImage(imageUrl, coinName) {
    if (!imageUrl) return null;
    
    const imageUrl64 = convertImageUrl(imageUrl);
    const imageHash = crypto.createHash('md5').update(imageUrl64).digest('hex');
    
    // Check if already downloaded
    if (downloadedImages.has(imageHash)) {
        return path.join(imageFolder, `${sanitizeFilename(coinName)}.png`);
    }
    
    try {
        // Ensure directory exists
        await fs.mkdir(imageFolder, { recursive: true });
        
        const filename = `${sanitizeFilename(coinName)}.png`;
        const filepath = path.join(imageFolder, filename);
        
        // Check if file already exists on disk
        try {
            await fs.access(filepath);
            downloadedImages.add(imageHash);
            return filepath;
        } catch {
            // File doesn't exist, proceed with download
        }
        
        console.log(`Downloading image for ${coinName}...`);
        const response = await axios.get(imageUrl64, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        await fs.writeFile(filepath, response.data);
        downloadedImages.add(imageHash);
        
        console.log(`✓ Downloaded ${coinName} image`);
        return filepath;
        
    } catch (error) {
        console.warn(`Failed to download image for ${coinName}:`, error.message);
        return null;
    }
}

/**
 * Generates array of dates from start to end
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array<Date>} - Array of dates
 */
function generateDateRange(startDate, endDate) {
    const dates = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
}

/**
 * Converts Date to Unix timestamp
 * @param {Date} date - Date object
 * @returns {number} - Unix timestamp in seconds
 */
function dateToTimestamp(date) {
    return Math.floor(date.getTime() / 1000);
}

/**
 * Main function to extract historical cryptocurrency data
 * @returns {Promise<Array>} - Array of daily cryptocurrency data
 */
async function extractHistoricalData() {
    const startDate = new Date('2017-5-16');
    const endDate = new Date('2017-5-16');
    const dates = generateDateRange(startDate, endDate);
    
    console.log(`Processing ${dates.length} days from ${startDate.toDateString()} to ${endDate.toDateString()}`);
    
    const finalData = [];
    let processedCount = 0;
    
    // Load existing downloaded images hash if available
    try {
        const existingFiles = await fs.readdir(imageFolder);
        existingFiles.forEach(file => {
            const hash = crypto.createHash('md5').update(file).digest('hex');
            downloadedImages.add(hash);
        });
        console.log(`Found ${existingFiles.length} existing images`);
    } catch {
        console.log('No existing images folder found, will create new one');
    }
    
    for (const date of dates) {
        const timestamp = dateToTimestamp(date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // JavaScript months are 0-indexed
        const day = date.getDate();
        
        try {
            console.log(`\n[${++processedCount}/${dates.length}] Processing ${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
            
            // Scrape data for this date
            const coinData = await scrapeCoinMarketCapHistorical(timestamp, 12);
            
            // Download images for each coin
            const imageDownloadPromises = coinData.map(coin => 
                downloadImage(coin.imageUrl, coin.name)
            );
            await Promise.allSettled(imageDownloadPromises);
            
            // Create coins array with alternating name and market cap
            const coins = [];
            coinData.forEach(coin => {
                coins.push(coin.name);
                coins.push(coin.marketCap);
            });
            
            // Add to final data
            finalData.push({
                year,
                month,
                day,
                coins
            });
            
            console.log(`✓ Processed ${coinData.length} coins for ${year}-${month}-${day}`);
            
            // Add small delay to be respectful to the server
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`✗ Failed to process ${year}-${month}-${day}:`, error.message);
            
            // Add entry with MISSING data
            finalData.push({
                year,
                month,
                day,
                coins: ["MISSING"]
            });
        }
        
        // Save progress every 50 entries
        if (processedCount % 50 === 0) {
            try {
                await fs.writeFile('progress_backup.json', JSON.stringify(finalData, null, 2));
                console.log(`Progress saved (${processedCount}/${dates.length})`);
            } catch (saveError) {
                console.warn('Failed to save progress:', saveError.message);
            }
        }
    }
    
    console.log(`\n🎉 Completed processing ${dates.length} days`);
    console.log(`📊 Final data contains ${finalData.length} entries`);
    console.log(`🖼️  Downloaded images to: ${path.resolve(imageFolder)}`);
    
    return finalData;
}

/**
 * Save final data to JSON file
 * @param {Array} data - Final processed data
 * @param {string} filename - Output filename
 */
async function saveFinalData(data, filename = 'cryptocurrency_historical_data.json') {
    try {
        await fs.writeFile(filename, JSON.stringify(data, null, 2));
        console.log(`✅ Final data saved to: ${filename}`);
        console.log(`📈 Total entries: ${data.length}`);
        
        // Calculate statistics
        const successfulEntries = data.filter(entry => entry.coins[0] !== "MISSING").length;
        const failedEntries = data.length - successfulEntries;
        
        console.log(`✓ Successful entries: ${successfulEntries}`);
        console.log(`✗ Failed entries: ${failedEntries}`);
        console.log(`📊 Success rate: ${((successfulEntries / data.length) * 100).toFixed(2)}%`);
        
    } catch (error) {
        console.error('Failed to save final data:', error);
        throw error;
    }
}

// Main execution
async function main() {
    try {
        console.log('🚀 Starting historical cryptocurrency data extraction...');
        
        const historicalData = await extractHistoricalData();
        await saveFinalData(historicalData);
        
        console.log('\n🎊 All done! Check the generated files:');
        console.log('   - cryptocurrency_historical_data.json (main data)');
        console.log(`   - ${imageFolder}/ (coin images)`);
        console.log('   - progress_backup.json (backup file)');
        
    } catch (error) {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    }
}

// Export functions for potential reuse
module.exports = {
    extractHistoricalData,
    saveFinalData,
    downloadImage,
    convertImageUrl,
    main
};

// Run if this file is executed directly
if (require.main === module) {
    main();
}