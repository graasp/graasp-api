FROM node:24.12-trixie AS base

RUN apt-get update  \
  && apt-get -y --no-install-recommends install  \
  sudo curl git ca-certificates build-essential dumb-init \
  && rm -rf /var/lib/apt/lists/*

SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ENV MISE_INSTALL_PATH="/usr/local/bin/mise"

# Install mise
RUN curl https://mise.run | sh


##############################
### Build Application Step ###
##############################
# This step will build the application
# FROM base AS tools

# # update packages and install the minimal init system "dumb-init"
# RUN apt-get update \
#   && apt-get install -y --no-install-recommends dumb-init \
#   && rm -rf /var/lib/apt/lists/*

# -------------------------------------------------------
FROM base AS build

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml mise.toml ./

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN mise trust && mise install && corepack enable && pnpm install --frozen-lockfile

ENV NODE_ENV=production
COPY . .
RUN pnpm build-ts

# removes non prod dependencies
RUN pnpm install --prod --frozen-lockfile

############################
### Run Application Step ###
############################
# Final step that will run the application
FROM node:24.12-bookworm-slim AS runner

# Variable passed as a build arg. Represents the tag or git sha used for the build
ARG APP_VERSION
# Set APP_VERSION as ENV variable from ARG passed at build step
ENV APP_VERSION=${APP_VERSION:-latest}
# Set BUILD_TIMESTAMP as ENV variable from ARG passed at build step
ARG BUILD_TIMESTAMP
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP:-not-provided}
# Set NODE_ENV to production so we don't trigger .husky/install.mjs
ENV NODE_ENV=production

EXPOSE 3000

WORKDIR /app

# Copy the installed dumb-init system from build image
COPY --from=base /usr/bin/dumb-init /usr/bin/dumb-init

# Copy the dependencies and compiled server code
COPY --chown=node:node --from=build ./app/node_modules ./node_modules
COPY --chown=node:node --from=build ./app/dist ./dist

# Set user to be non-root node
USER node

CMD ["dumb-init", "node", "dist/server.js"]
