FROM node:22 AS base
WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

RUN set -eux; apt-get update; \
    apt-get install curl gnupg -y; \
    curl --location --silent https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -; \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'; \
    apt-get update; \
    apt-get install google-chrome-stable -y --no-install-recommends; \
    rm -rf /var/lib/apt/lists/*

FROM base as publish-base
COPY ./ ./
RUN set -eux; npm install

FROM publish-base AS dev
VOLUME /app
ENTRYPOINT set -eux; npm install; node ./retrieve-token.js

FROM publish-base as publish
ENTRYPOINT node ./retrieve-token.js