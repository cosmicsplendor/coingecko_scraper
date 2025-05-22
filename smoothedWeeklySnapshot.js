const { scrapeCoinMarketCapHistorical } = require("./scripts/coinMarketCap");
const fs = require('fs').promises;
const path = require('path');

// Helper function to get random delay
const getRandomDelay = () => Math.floor(Math.random() * 251); // 0-250ms

// Helper function to get random concurrency
const getRandomConcurrency = () => [1, 2, 3][Math.floor(Math.random() * 3)];

// Helper function to convert date to unix timestamp
const dateToUnix = (date) => Math.floor(date.getTime() / 1000);

// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to save progress
const saveProgress = async (data, filename) => {
  try {
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`Progress saved to ${filename}`);
  } catch (error) {
    console.error(`Error saving progress: ${error.message}`);
  }
};

// Helper function to load progress
const loadProgress = async (filename) => {
  try {
    const data = await fs.readFile(filename, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log(`No existing progress file found: ${filename}`);
    return null;
  }
};

// Helper function to process weekly data
const processWeeklyData = (dailyData, startDate) => {
  const weeklyData = [];
  const msPerDay = 24 * 60 * 60 * 1000;
  const msPerWeek = 7 * msPerDay;
  
  // Group data by weeks
  const weeks = new Map();
  
  dailyData.forEach(dayData => {
    const dayTimestamp = dayData.timestamp;
    const weekStart = Math.floor((dayTimestamp - startDate.getTime()) / msPerWeek) * msPerWeek + startDate.getTime();
    
    if (!weeks.has(weekStart)) {
      weeks.set(weekStart, []);
    }
    weeks.get(weekStart).push(dayData.coins);
  });
  
  // Process each week
  weeks.forEach((weekDays, weekStart) => {
    const coinStats = new Map();
    
    // Aggregate all coins for the week
    weekDays.forEach(dayCoins => {
      dayCoins.forEach(coin => {
        if (!coinStats.has(coin.name)) {
          coinStats.set(coin.name, { prices: [], marketCaps: [] });
        }
        coinStats.get(coin.name).prices.push(coin.price || 0);
        coinStats.get(coin.name).marketCaps.push(coin.marketCap || 0);
      });
    });
    
    // Calculate averages for each coin
    const weeklyCoins = [];
    coinStats.forEach((stats, name) => {
      const avgPrice = stats.prices.reduce((sum, price) => sum + price, 0) / stats.prices.length;
      const avgMarketCap = stats.marketCaps.reduce((sum, cap) => sum + cap, 0) / stats.marketCaps.length;
      
      weeklyCoins.push({
        name,
        price: avgPrice,
        marketCap: avgMarketCap
      });
    });
    
    // Sort by market cap and keep top 50
    weeklyCoins.sort((a, b) => b.marketCap - a.marketCap);
    const top50 = weeklyCoins.slice(0, 50);
    
    weeklyData.push({
      weekStart: new Date(weekStart),
      coins: top50
    });
  });
  
  return weeklyData.sort((a, b) => a.weekStart - b.weekStart);
};

// Helper function to apply rolling weighted average
const applyRollingAverage = (weeklyData) => {
  const weights = [0.5, 0.3, 0.2]; // Most recent to oldest
  const smoothedData = [];
  
  for (let i = 2; i < weeklyData.length; i++) {
    const currentWeek = weeklyData[i];
    const prevWeek1 = weeklyData[i - 1];
    const prevWeek2 = weeklyData[i - 2];
    
    // Get all unique coin names from the 3 weeks
    const allCoins = new Set();
    [currentWeek, prevWeek1, prevWeek2].forEach(week => {
      week.coins.forEach(coin => allCoins.add(coin.name));
    });
    
    const smoothedCoins = [];
    
    allCoins.forEach(coinName => {
      const coinData = [currentWeek, prevWeek1, prevWeek2].map(week => 
        week.coins.find(coin => coin.name === coinName) || { price: 0, marketCap: 0 }
      );
      
      // Calculate weighted averages
      const weightedPrice = coinData.reduce((sum, coin, idx) => 
        sum + (coin.price * weights[idx]), 0
      );
      
      const weightedMarketCap = coinData.reduce((sum, coin, idx) => 
        sum + (coin.marketCap * weights[idx]), 0
      );
      
      // Only include if coin has some presence in recent weeks
      if (weightedPrice > 0 || weightedMarketCap > 0) {
        smoothedCoins.push({
          name: coinName,
          price: weightedPrice,
          marketCap: weightedMarketCap
        });
      }
    });
    
    // Sort by market cap and keep top 50
    smoothedCoins.sort((a, b) => b.marketCap - a.marketCap);
    
    smoothedData.push({
      weekStart: currentWeek.weekStart,
      coins: smoothedCoins.slice(0, 50)
    });
  }
  
  return smoothedData;
};

// Main scraping function
const scrapeCoinMarketCapData = async () => {
  const startDate = new Date('2016-01-01');
  const endDate = new Date('2025-05-20');
  const progressFile = 'scraping_progress.json';
  const finalOutputFile = 'weekly_crypto_data.json';
  
  // Load existing progress
  let progress = await loadProgress(progressFile);
  let scrapedData = progress ? progress.scrapedData : [];
  let lastProcessedDate = progress ? new Date(progress.lastProcessedDate) : startDate;
  
  console.log(`Starting scraping from ${lastProcessedDate.toDateString()} to ${endDate.toDateString()}`);
  
  // Scrape daily data
  const currentDate = new Date(lastProcessedDate);
  let dayCount = progress ? progress.dayCount : 0;
  
  while (currentDate <= endDate) {
    try {
      const unixTimestamp = dateToUnix(currentDate);
      console.log(`Scraping data for ${currentDate.toDateString()} (${dayCount + 1} days processed)`);
      
      // Random concurrency and delay
      const concurrency = getRandomConcurrency();
      console.log(`Using concurrency: ${concurrency}`);
      
      // Scrape data for current day
      const rawData = await scrapeCoinMarketCapHistorical(unixTimestamp, 50);
      
      // Extract only name and marketCap fields
      const processedCoins = rawData.map(coin => ({
        name: coin.name,
        marketCap: coin.marketCap,
        price: coin.price // Also keeping price for averaging
      }));
      
      scrapedData.push({
        timestamp: currentDate.getTime(),
        date: currentDate.toISOString().split('T')[0],
        coins: processedCoins
      });
      
      dayCount++;
      
      // Save progress every 100 days
      if (dayCount % 100 === 0) {
        const progressData = {
          scrapedData,
          lastProcessedDate: currentDate.toISOString(),
          dayCount
        };
        await saveProgress(progressData, progressFile);
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      
      // Random delay to avoid detection
      const delay = getRandomDelay();
      console.log(`Waiting ${delay}ms before next request...`);
      await sleep(delay);
      
    } catch (error) {
      console.error(`Error scraping data for ${currentDate.toDateString()}: ${error.message}`);
      // Save progress on error
      const progressData = {
        scrapedData,
        lastProcessedDate: currentDate.toISOString(),
        dayCount
      };
      await saveProgress(progressData, progressFile);
      throw error;
    }
  }
  
  console.log(`Completed scraping ${dayCount} days of data`);
  
  // Process data into weekly format
  console.log('Processing daily data into weekly format...');
  const weeklyData = processWeeklyData(scrapedData, startDate);
  
  // Apply rolling weighted average
  console.log('Applying rolling weighted average...');
  const smoothedWeeklyData = applyRollingAverage(weeklyData);
  
  // Save final processed data
  await saveProgress({
    metadata: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalDays: dayCount,
      totalWeeks: smoothedWeeklyData.length,
      processingDate: new Date().toISOString()
    },
    data: smoothedWeeklyData
  }, finalOutputFile);
  
  console.log(`Final weekly data saved to ${finalOutputFile}`);
  console.log(`Processed ${smoothedWeeklyData.length} weeks of data`);
  
  // Clean up progress file
  try {
    await fs.unlink(progressFile);
    console.log('Cleaning up progress file');
  } catch (error) {
    // Ignore if file doesn't exist
  }
  
  return smoothedWeeklyData;
};

// Execute the scraping
scrapeCoinMarketCapData()
  .then(data => {
    console.log('Scraping completed successfully!');
    console.log(`Final dataset contains ${data.length} weeks`);
  })
  .catch(error => {
    console.error('Scraping failed:', error);
    process.exit(1);
  });