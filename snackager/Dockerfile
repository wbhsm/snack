ARG node_version

FROM mhart/alpine-node:${node_version} as dev

RUN apk --no-cache add git openssh-client

# Workspace files
WORKDIR /app
COPY package.json yarn.lock .eslintrc.base.js .prettierrc ./

# snack-sdk
WORKDIR /app/packages/snack-sdk
COPY packages/snack-sdk/src ./src
COPY packages/snack-sdk/package.json packages/snack-sdk/tsconfig.json ./

# snackager
WORKDIR /app/snackager
COPY snackager/jest ./jest
COPY snackager/src ./src
COPY snackager/structure-tests ./structure-tests
COPY snackager/package.json ./
COPY snackager/tsconfig*.json ./
COPY snackager/.prettier* snackager/.eslint* ./

# Install dependencies
RUN yarn install --frozen-lockfile --production=false

# Build snack-sdk
WORKDIR /app/packages/snack-sdk
RUN yarn build

# Snackager
WORKDIR /app/snackager

CMD ["yarn", "start"]

FROM dev as build

# Build
RUN yarn run build

# Remove development dependencies
RUN yarn install --frozen-lockfile --offline --production

FROM mhart/alpine-node:${node_version}

RUN apk --no-cache add git openssh-client

# Get built code and dependencies
COPY --from=build /app/snackager/package.json ./
COPY --from=build /app/snackager/build build
COPY --from=build /app/node_modules node_modules

# Start
CMD ["node", "--max-old-space-size=8192", "--async-stack-traces", "."]
