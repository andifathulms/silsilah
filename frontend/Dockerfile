# Dev-mode image: NEXT_PUBLIC_* is read at runtime so the API port can be
# changed via compose env without a rebuild.
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
