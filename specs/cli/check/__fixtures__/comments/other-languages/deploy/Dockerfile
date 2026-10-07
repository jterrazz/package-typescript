# syntax=docker/dockerfile:1
FROM node:24-slim
# outside: the registry mirror refuses an image without a digest
COPY . .
# Copy everything over
RUN npm ci
