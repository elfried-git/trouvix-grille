# Trouvix Grille — Game Service Dockerfile
# For Railway / Render / Fly.io / any Docker host

FROM oven/bun:1 AS base
WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN bun install --production

# Copy source code
COPY index.ts ./

# The Benchou Ferrari photo is served by the Next.js frontend (Vercel)
# The game service only references it as a URL path — no need to copy it here.

# Expose port (Railway/Render/Fly.io will set PORT env var)
ENV PORT=3003
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:'+process.env.PORT).catch(()=>process.exit(1))" || exit 1

# Start the server
CMD ["bun", "index.ts"]
