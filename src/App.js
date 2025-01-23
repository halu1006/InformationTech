import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import styles from './styles/app.module.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]); // 履歴の状態
  const apiKey = process.env.REACT_APP_WEATHER_API_KEY;
  const translationApiKey = process.env.REACT_APP_TRANSLATION_API_KEY;

  // 地名を漢字に翻訳する関数
  const translateCityName = useCallback(async (cityName) => {
    const url = `https://translation.googleapis.com/language/translate/v2`;

    try {
      const response = await axios.post(
        url,
        new URLSearchParams({
          q: cityName,
          target: 'ja',
          key: translationApiKey,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      return response.data.data.translations[0].translatedText;
    } catch (err) {
      console.error('地名の翻訳に失敗しました', err);
      return cityName;
    }
  }, [translationApiKey]);

  // 天気情報を取得する関数
  const fetchWeather = useCallback(async (lat, lon, city = null) => {
    try {
      setError('');
      let url;

      if (lat && lon) {
        url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=ja`;
      } else if (city) {
        lat = city.coord.lat;
        lon = city.coord.lon;
        url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&la`;
      } else {
        throw new Error('位置情報が不足しています。');
      }
      console.log(url);

      const [weatherResponse, forecastResponse] = await Promise.all([
        axios.get(url),
        axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`)
      ]);

      const weatherData = weatherResponse.data;
      const forecastData = forecastResponse.data;

      // 都市名を漢字に変換
      const translatedCityName = city ? await translateCityName(city.name) : weatherData.name;

      setWeather({ ...weatherData, name: translatedCityName });
      setForecast(forecastData);

      // 履歴に追加
      setHistory((prevHistory) => [
        ...prevHistory,
        {
          id: Date.now(),
          name: translatedCityName,
          weather: weatherData,
          forecast: forecastData,
        },
      ]);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'APIエラー';
      setError(`天気データの取得に失敗しました: ${errorMessage}`);
      setWeather(null);
      setForecast(null);
    }
  }, [apiKey, translateCityName]);

  useEffect(() => {
    const fetchCurrentLocationWeather = async () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            fetchWeather(lat, lon);
          },
          () => {
            setError('位置情報が取得できませんでした。設定を確認してください。');
          }
        );
      } else {
        setError('ブラウザが位置情報APIに対応していません。');
      }
    };

    fetchCurrentLocationWeather();
  }, [fetchWeather]);

  useEffect(() => {
    const fetchCities = async () => {
      if (!searchTerm.trim()) {
        setCities([]);
        return;
      }

      try {
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/find?q=${searchTerm}&appid=${apiKey}&units=metric&cnt=5`);
        setCities(response.data.list);
      } catch (err) {
        const errorMessage = err.response?.data?.message || '都市データの取得に失敗しました';
        setError(errorMessage);
      }
    };

    fetchCities();
  }, [searchTerm, apiKey]);

  const getWeatherIcon = (weatherDescription) => {
    const iconMap = {
      'clear sky': '☀️',
      'few clouds': '⛅',
      'scattered clouds': '☁️',
      'broken clouds': '☁️',
      'shower rain': '🌧️',
      rain: '🌧️',
      thunderstorm: '⛈️',
      snow: '❄️',
      mist: '🌫️',
    };

    return iconMap[weatherDescription.toLowerCase()] || '🌡️';
  };

  const getBackgroundClass = (weather) => {
    const mainWeather = weather.weather[0].main.toLowerCase();
    return styles[mainWeather] || '';
  };

  const getChartData = () => {
    if (!forecast) return {};

    const labels = forecast.list.filter((_, index) => index % 8 === 0).map((day) => new Date(day.dt * 1000).toLocaleTimeString());
    const temperatures = forecast.list.filter((_, index) => index % 8 === 0).map((day) => day.main.temp);

    return {
      labels,
      datasets: [
        {
          label: '気温 (°C)',
          data: temperatures,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          fill: true,
        },
      ],
    };
  };

  return (
    <div className={`${styles.App} ${weather ? getBackgroundClass(weather) : ''}`}>
      <div>
        <h1>天気予報App</h1>
        {!searchTerm && !selectedCity && weather && (
          <p>現在地の天気情報を表示中です。</p>
        )}
      </div>

      <input
        type="text"
        placeholder="都市名を検索"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {cities.length > 0 && (
        <div>
          {cities.map((city) => (
            <button
              key={city.id}
              onClick={() => fetchWeather(null, null, city)}
              className={selectedCity?.id === city.id ? styles.selectedCity : ''}
            >
              {city.name}, {city.sys.country}
            </button>
          ))}
        </div>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {weather && forecast && (
        <div className={styles.weatherContainer}>
          <div className={styles.currentWeather}>
            <h2>{weather.name}</h2>
            <p>{getWeatherIcon(weather.weather[0].description)} {weather.weather[0].description}</p>
            <p>気温: {weather.main.temp}°C</p>
            <p>最高気温: {weather.main.temp_max}°C</p>
            <p>最低気温: {weather.main.temp_min}°C</p>
            <p>体感気温: {weather.main.feels_like}°C</p>
            <p>湿度: {weather.main.humidity}%</p>
            <p>風速: {weather.wind.speed}m/s</p>
          </div>

          <div className={styles.forecast}>
            <h2>5日間の天気予報</h2>
            {forecast.list.slice(0, 5).map((day, index) => (
              <div key={index} className={styles.forecastItem}>
                <p>{new Date(day.dt * 1000).toLocaleDateString()}</p>
                <p>{getWeatherIcon(day.weather[0].description)} {day.weather[0].description}</p>
                <p>最高気温: {day.main.temp_max}°C</p>
                <p>最低気温: {day.main.temp_min}°C</p>
              </div>
            ))}
          </div>

          <div className={styles.chart}>
            <h2>気温の変化</h2>
            {forecast && <Line data={getChartData()} />}
          </div>
        </div>
      )}

      <div className={styles.history}>
        <h2>天気検索履歴</h2>
        <div className={styles.historyContainer}>
          {history.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setWeather(item.weather);
                setForecast(item.forecast);
              }}
              className={styles.historyButton}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
