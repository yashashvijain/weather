const API_KEY = "d43ed1c8de2bb76c94db96ef49261914"; // Uses an openweather demo key / proxy if possible, user should replace with their own.
const BASE_URL = "https://api.openweathermap.org/data/2.5/";

const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const weatherCard = document.getElementById("weatherCard");
const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");

const cityNameDisplay = document.getElementById("cityName");
const tempDisplay = document.getElementById("temperature");
const weatherDescDisplay = document.getElementById("weatherDesc");
const humidityDisplay = document.getElementById("humidity");
const windDisplay = document.getElementById("windSpeed");
const pressureDisplay = document.getElementById("pressure");
const visibilityDisplay = document.getElementById("visibility");
const dewPointDisplay = document.getElementById("dewPoint");
const aqiDisplay = document.getElementById("aqi");
const uvDisplay = document.getElementById("uvIndex");

const sunriseDisplay = document.getElementById("sunriseTime");
const sunsetDisplay = document.getElementById("sunsetTime");

const currentIcon = document.getElementById("currentIcon");
const forecastContainer = document.getElementById("forecastContainer");

// Icon mapping logic
// Map weather IDs or main condition to the hand-drawn cat icons
function getCatClass(weatherCondition, isNight) {
    const condition = weatherCondition.toLowerCase();
    
    // For night time
    if (isNight && condition.includes("clear")) return 'cat-overcast'; // Uses the sleepy/night looking cat
    
    if (condition.includes("clear") || condition.includes("sun")) return 'cat-sunny';
    if (condition.includes("cloud")) {
        if (condition.includes("few") || condition.includes("scattered")) return 'cat-partly';
        return 'cat-cloudy';
    }
    if (condition.includes("rain") || condition.includes("drizzle")) return 'cat-rainy';
    if (condition.includes("snow")) return 'cat-snowy';
    if (condition.includes("thunderstorm") || condition.includes("storm")) return 'cat-thunder';
    if (condition.includes("wind") || condition.includes("breeze") || condition.includes("squall")) return 'cat-windy';

    return 'cat-sunny'; // Fallback
}

function updateBackground(weatherCondition, isNight) {
    const condition = weatherCondition.toLowerCase();
    
    document.body.className = ''; // reset classes

    if (isNight) {
        document.body.classList.add('weather-night');
        return;
    }

    if (condition.includes("clear") || condition.includes("sun")) document.body.classList.add('weather-sunny');
    else if (condition.includes("cloud")) document.body.classList.add('weather-cloudy');
    else if (condition.includes("rain") || condition.includes("drizzle")) document.body.classList.add('weather-rainy');
    else if (condition.includes("snow")) document.body.classList.add('weather-snowy');
    else if (condition.includes("thunderstorm")) document.body.classList.add('weather-thunder');
    else document.body.classList.add('weather-sunny');
}

async function fetchWeatherData(city) {
    try {
        hideAllCards();
        loadingState.classList.add('active');

        // Fetch Current Weather
        const weatherRes = await fetch(`${BASE_URL}weather?q=${city}&appid=${API_KEY}&units=metric`);
        if (!weatherRes.ok) throw new Error("City not found");
        const weatherData = await weatherRes.json();

        // Fetch 5-Day Forecast
        const forecastRes = await fetch(`${BASE_URL}forecast?q=${city}&appid=${API_KEY}&units=metric`);
        const forecastData = await forecastRes.json();

        // Fetch Air Pollution (AQI) and basic UV
        let additionalStats = { aqi: null, uvi: null };
        try {
            const lat = weatherData.coord.lat;
            const lon = weatherData.coord.lon;
            const [aqiRes, uvRes] = await Promise.all([
                fetch(`${BASE_URL}air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
                fetch(`${BASE_URL}uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
            ]);
            
            if (aqiRes.ok) {
                const aData = await aqiRes.json();
                additionalStats.aqi = aData.list[0].main.aqi;
            }
            if (uvRes.ok) {
                const uData = await uvRes.json();
                additionalStats.uvi = uData.value;
            }
        } catch (e) {
            console.error("Failed fetching additional metrics", e);
        }

        updateUI(weatherData, forecastData, additionalStats);

    } catch (error) {
        hideAllCards();
        errorState.classList.add('active');
        console.error(error);
    }
}

function updateUI(weather, forecast, extra) {
    hideAllCards();
    weatherCard.classList.add('active');

    const condition = weather.weather[0].main;
    const isNight = isItNight(weather.sys.sunrise, weather.sys.sunset, weather.dt);

    cityNameDisplay.textContent = weather.name;
    const temp = weather.main.temp;
    const humidity = weather.main.humidity;
    
    tempDisplay.textContent = `${Math.round(temp)}°C`;
    weatherDescDisplay.textContent = weather.weather[0].description;
    humidityDisplay.textContent = `${humidity}%`;
    windDisplay.textContent = `${Math.round(weather.wind.speed * 3.6)} km/h`;
    pressureDisplay.textContent = `${weather.main.pressure} hPa`;
    
    // Visibility is in meters
    const visKm = weather.visibility ? (weather.visibility / 1000).toFixed(1) : "--";
    visibilityDisplay.textContent = `${visKm} km`;
    
    // Calculate approximate Dew Point
    // Td = T - ((100 - RH)/5)
    let dp = temp - ((100 - humidity) / 5);
    dewPointDisplay.textContent = `${Math.round(dp)}°C`;
    
    // AQI (1=Good, 2=Fair, 3=Mod, 4=Poor, 5=V.Poor)
    const aqiMap = { 1: "Good", 2: "Fair", 3: "Moderate", 4: "Poor", 5: "Very Poor" };
    aqiDisplay.textContent = extra.aqi ? aqiMap[extra.aqi] || extra.aqi : "N/A";
    
    uvDisplay.textContent = extra.uvi !== null ? Math.round(extra.uvi) : "N/A";

    if (weather.sys.sunrise && weather.sys.sunset) {
        const srDate = new Date(weather.sys.sunrise * 1000);
        const ssDate = new Date(weather.sys.sunset * 1000);
        if (sunriseDisplay) sunriseDisplay.textContent = srDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
        if (sunsetDisplay) sunsetDisplay.textContent = ssDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    }

    // Update main icon & bg
    currentIcon.className = 'cat-icon ' + getCatClass(condition, isNight);
    updateBackground(condition, isNight);

    // Update forecast
    updateForecast(forecast);
}

function updateForecast(forecast) {
    forecastContainer.innerHTML = '';
    
    // API returns data every 3 hours (40 items total). We want 1 per day around noon.
    const dailyData = forecast.list.filter(item => item.dt_txt.includes('12:00:00'));
    
    // If not all 5 days are captured (due to time), slice first 5 from daily grouping
    const displayData = dailyData.length === 5 ? dailyData : forecast.list.filter((v,i) => i % 8 === 0).slice(0, 5);

    displayData.forEach(item => {
        const condition = item.weather[0].main;
        
        const date = new Date(item.dt * 1000);
        const dayName = date.toLocaleDateString("en-US", { weekday: 'short' });
        
        const el = document.createElement('div');
        el.className = 'forecast-item';
        el.innerHTML = `
            <span class="forecast-day">${dayName}</span>
            <div class="cat-icon ${getCatClass(condition, false)}" aria-label="${condition}"></div>
            <span class="forecast-temp">${Math.round(item.main.temp)}°</span>
        `;
        forecastContainer.appendChild(el);
    });
}

function isItNight(sunrise, sunset, currentDt) {
    return currentDt < sunrise || currentDt > sunset;
}

function hideAllCards() {
    weatherCard.classList.remove('active');
    loadingState.classList.remove('active');
    errorState.classList.remove('active');
}

searchBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) fetchWeatherData(city);
});

cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const city = cityInput.value.trim();
        if (city) fetchWeatherData(city);
    }
});

// Initial load (Optional)
// fetchWeatherData('Tokyo');
