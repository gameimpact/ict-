FROM node:22-bookworm-slim
WORKDIR /app
COPY --chown=node:node server.js questions.json ./
COPY --chown=node:node static ./static
ENV PORT=6400 DATA_DIR=/app/data NODE_ENV=production
USER node
EXPOSE 6400
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:6400/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server.js"]
