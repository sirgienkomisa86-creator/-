# Сервер онлайна ХУГ СГО
1. `npm install && npm start` — локально слушает ws://localhost:8080
2. Деплой: Render.com → New Web Service → загрузите папку server в GitHub → Build `npm install`, Start `npm start`. Получите адрес вида https://xxx.onrender.com — в игре это `wss://xxx.onrender.com`.
3. Впишите адрес в игру: в HTML найдите `const WS_URL=''` и вставьте туда `wss://xxx.onrender.com`
   (или откройте игру с `?server=wss://xxx.onrender.com` один раз — адрес запомнится).
