# Build stage
FROM node:16.14.2-bullseye
# Install NodeJs dependencies
WORKDIR /build
COPY package.json ./
RUN npm install
RUN npm install -g pm2
# Build package
COPY . .
RUN npm run build
# Initialize database
RUN npm run api-knex migrate:latest
# Start the server with 16 instances
ENV NODE_ENV=production
EXPOSE 20001
ENTRYPOINT ["pm2-runtime", "start", "ecosystem.config.js"] 