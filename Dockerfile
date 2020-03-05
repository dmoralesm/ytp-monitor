FROM node:10-alpine

WORKDIR /app

COPY package*.json ./
COPY start.sh ./
COPY src ./src

RUN npm install
RUN chmod +x ./start.sh

CMD ["sh", "start.sh"]
