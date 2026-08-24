# The server, as an image.
#
# Two things are unusual and both are deliberate.
#
# **No build step.** The server runs TypeScript directly — Node strips the types. That is why
# `server/tests/loadable.test.ts` exists: Vitest is a compiler and will happily resolve things
# Node's own resolver refuses, so every module is imported by real Node in a real process
# before it ships. An image that ran `tsc` first would hide exactly the failures that test
# catches, and a boot is the worst place to find them.
#
# **The editor is built, and it is built outside.** `index.html` is written by `node build.mjs`
# from `builder.html` and the TypeScript core, and the server reads it as a file. A server that
# bundles on boot is a server that fails to boot for bundler reasons, so the build happens in
# its own stage here and the runtime stage only copies the result.
#
# Node 24: type stripping needs no flag from 23.6, and the start script passes
# `--experimental-strip-types` anyway, which is still accepted. Pinning the major matters more
# than the flag — this is the one part of the setup that decides whether the source runs at all.

# ---- stage 1: the editor ----------------------------------------------------
FROM node:24-alpine AS editor
WORKDIR /repo
# esbuild, and nothing else: build.mjs compiles the TypeScript core with it. `--ignore-scripts`
# is off on purpose — esbuild's install script is what fetches its platform binary.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund
# Everything build.mjs reads: the legacy shell, the core, the fonts it inlines, and pubcheck,
# which it imports to report whether the published artifact is still current.
COPY build.mjs ./
COPY builder.html ./
COPY tools ./tools
COPY app ./app
COPY brand ./brand
RUN node build.mjs

# ---- stage 2: the server ----------------------------------------------------
FROM node:24-alpine AS server
WORKDIR /srv

# Dependencies first, so a change to the source does not reinstall pg and nodemailer.
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev --no-audit --no-fund

# The server, and the core it renders with. `render.ts` imports `../../app/src/core`, so the
# app source is part of the runtime image and not only of the build.
COPY server/src ./server/src
COPY app ./app
COPY --from=editor /repo/index.html ./index.html

# `index.ts` resolves the editor as `join(here, '..', '..', 'index.html')` — two levels up from
# `server/src`, which is `/srv`. The layout above is that layout, and the server says so on
# boot if the file is missing.

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

# Not root. The process reads two files and talks to Postgres; nothing it does needs more.
USER node

# No healthcheck instruction: what "healthy" means here is a Postgres connection, and the
# server already refuses to start without one when DATABASE_URL is set. A HEALTHCHECK hitting
# `/` would pass on a box with no sites, which is a green light for a broken deployment.
CMD ["node", "--experimental-strip-types", "server/src/index.ts"]
