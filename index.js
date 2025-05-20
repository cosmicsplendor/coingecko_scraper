const fs = require("fs").promises;
const path = require("path");
const { scrapeByRange } = require("./scripts/coinGecko");
const dir = path.join(__dirname, "../export/");

// Helper function to convert date string to Unix timestamp (in seconds)
const dateToUnix = (dateStr) => {
  return Math.floor(new Date(dateStr).getTime() / 1000);
};

// Main function to process all crypto assets
const processAllAssets = async () => {
  try {
    // Read and parse the markets.json file
    const marketsPath = path.join(__dirname, "./export/coingecko/markets.json");
    const marketsData = JSON.parse(await fs.readFile(marketsPath, "utf8"));
    
    // Target end date (2025-05-19)
    const endDate = dateToUnix("2025-05-19");
    
    // 52 weeks in seconds (52 * 7 * 24 * 60 * 60)
    const maxInterval = 52 * 7 * 24 * 60 * 60;
    
    // Process each asset
    for (const asset of marketsData) {
      console.log(`Processing ${asset.name} (${asset.id})...`);
      
      // Convert start date to Unix timestamp
      let currentFrom = dateToUnix(asset.start_date);
      
      // Array to store all market cap data
      let allMarketCaps = [];
      
      // Fetch data in batches until reaching the end date
      while (currentFrom < endDate) {
        // Calculate the "to" timestamp for this batch (not exceeding endDate)
        const currentTo = Math.min(currentFrom + maxInterval, endDate);
        
        console.log(`  Fetching data from ${new Date(currentFrom * 1000).toISOString()} to ${new Date(currentTo * 1000).toISOString()}`);
        
        try {
          // Fetch data for the current batch
          const data = await scrapeByRange(asset.id, currentFrom, currentTo);
          
          // Extract and store market cap data
          if (data && data.market_caps && data.market_caps.length > 0) {
            allMarketCaps = allMarketCaps.concat(data.market_caps);
            console.log(`  Fetched ${data.market_caps.length} data points`);
          }
          
          // Set up for the next batch
          currentFrom = currentTo;
          
          // Small delay to avoid hitting rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`  Error fetching data for ${asset.id}:`, error.message);
          
          // If it's not a rate limit error, we'll wait a bit and then continue with the next batch
          if (!error.response || error.response.status !== 429) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            currentFrom = currentTo; // Move to the next batch
          }
        }
      }
      
      // Save the aggregated data to a file
      const outputPath = path.join(dir, `${asset.id}.json`);
      await fs.writeFile(outputPath, JSON.stringify(allMarketCaps, null, 2));
      console.log(`  Saved ${allMarketCaps.length} data points for ${asset.id} to ${outputPath}`);
    }
    
    console.log("All assets processed successfully!");
  } catch (error) {
    console.error("Error processing assets:", error);
  }
};

// Create the export directory if it doesn't exist
const ensureExportDir = async () => {
  try {
    await fs.mkdir(dir, { recursive: true });
    console.log(`Created export directory at ${dir}`);
  } catch (error) {
    console.error(`Error creating export directory: ${error.message}`);
  }
};

// Run the script
(async () => {
  await ensureExportDir();
  await processAllAssets();
})();