import axios from 'axios';

const isDev = import.meta.env.DEV;

const API_URL = isDev 
  ? (import.meta.env.VITE_API_URL || 'http://localhost:3000') 
  : '';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: false,
});

export default api;
