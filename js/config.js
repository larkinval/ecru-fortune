export const PROMOTERS = [
  { id: 'yana', name: 'Яна', quota: 7, initial: 'Я', color: '#E5197D' },
  { id: 'maria', name: 'Мария', quota: 7, initial: 'М', color: '#1D3FC4' },
  { id: 'vsevolod', name: 'Всеволод', quota: 6, initial: 'В', color: '#74C23F' },
  { id: 'matvey', name: 'Матвей', quota: 6, initial: 'Мт', color: '#F4B81A' },
];
export const TOTAL = PROMOTERS.reduce((s, p) => s + p.quota, 0);
export const PIN = '2609';
export const NETWORKS = ['TikTok', 'Telegram', 'VK', 'Instagram'];
export const SHIFT = { start: '22:00', end: '01:00' };
// Заполняется после развёртывания Apps Script (raffle/SETUP.md).
export const API_URL = 'https://script.google.com/macros/s/AKfycbw09-NhKPQoOnOGcIrVD5iaoRgvK3bBdKoCDxwg24_F7T6HhqAGEDrB39HGjOHiq-S1/exec';
export const TOKEN = 'ecru-2609-fortune';

export const promoterById = (id) => PROMOTERS.find((p) => p.id === id);
