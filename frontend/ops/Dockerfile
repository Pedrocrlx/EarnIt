FROM node:24.16-slim

RUN curl -fsSL https://bun.sh/install | bash

WORKDIR /app

COPY package.json bun.lock ./

COPY . .

EXPOSE 3000