FROM node:22-alpine

WORKDIR /app

ENV HOST=0.0.0.0
ENV PORT=3000

COPY package.json ./
COPY server.mjs ./
COPY scripts ./scripts
COPY public ./public
COPY Data ./Data

RUN node scripts/build-data.mjs

EXPOSE 3000

CMD ["node", "server.mjs"]
