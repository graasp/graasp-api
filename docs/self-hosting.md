# Self hosting Graasp

This guide describes the steps to self host the Graasp project.

This guide requires technical knowledge. If you are interested in using the Graasp platform you can use our public instance at: [https://graasp.org](https://graasp.org). If you have questions or need help regarding hosting Graasp on your own hardware, the Graasp Association is happy to help you, please send us an email at: hosting@graasp.org

We officially support hosting Graasp via docker compose.
We provide pre-built images hosted in the AWS public registry.

## Compose file

The compose file below creates the following services:

- web: Elixir admin and landing full-stack server
- api: Nodejs backend API
- db: Postgres database
- redis: Redis as a key-value store
-

```Dockerfile
name: Graasp self-hosted

volumes:
  postgres_data:
  meilisearch_data:
  caddy_config:

x-shared_environment: &shared_env
  # The connection string is of the shape:
  # postgres://user:password@host:port/db_name?sslmode=disable
  DB_CONNECTION: postgres://graasper:graasper@db:5432/graasp?sslmode=disable
  # the Mailer config is set by the "mailer" service below
  MAILER_CONNECTION: smtp://docker:docker@mailer:1025
  # shared secret between backend and admin
  ADMIN_SHARED_SECRET: CHANGE_ME

services:
  web:
    image: public.ecr.aws/graasp/admin:v0.10.8
    hostname: admin
    environement:
      <<: [*shared_env]

      DATABASE_URL: postgres://graasper:graasper@db:5432/graasp
      PHX_HOST: localhost
      PORT: 4000
      PUBLIC_PORT: 4000
      PROTOCOL: http
      SECRET_KEY_BASE: CHANGE_ME
      RELEASE_COOKIE: CHANGE_ME
      FILE_ITEMS_BUCKET_NAME: file-items
      H5P_CONTENT_BUCKET_NAME: h5p-items
      AWS_ACCESS_KEY_ID: CHANGE_ME
      AWS_SECRET_ACCESS_KEY: CHANGE_ME
      AWS_REGION: garage
      AWS_S3_SCHEME: http://
      AWS_S3_HOST: s3.garage.localhost
      AWS_S3_PORT: 3900
      AWS_S3_USE_PATH_STYLE: true
      SENTRY_DSN: CHANGE_ME
      RECAPTCHA_SITE_KEY: CHANGE_ME
    # Ports are not exposed by default
    # ports:
    #   - "4000:4000"
    links:
      - garage:s3.garage.localhost
    depends_on:
      - api
    restart: unless-stopped


  meilisearch:
    image: getmeili/meilisearch:v1.8
    hostname: meilisearch
    restart: on-failure
    ports:
      - "7700:7700"
    environment:
      - MEILI_MASTER_KEY=masterKey # Change this !
      - MEILI_NO_ANALYTICS=true
      - MEILI_ENV=development
      - MEILI_LOG_LEVEL
    volumes:
      - meilisearch_data:/meili_data

  etherpad:
    image: etherpad/etherpad
    hostname: etherpad
    # start the server with dev API key
    # https://hub.docker.com/r/etherpad/etherpad/dockerfile
    # https://github.com/ether/etherpad-lite/issues/3849
    volumes:
      # bind copy the dev API key
      - ./etherpad/devApiKey.txt:/opt/etherpad-lite/APIKEY.txt
    ports:
      - "9002:9001"
    environment:
      DB_TYPE: postgres
      DB_HOST: db
      DB_PORT: 5432
      # These credentials are created by the init script run on the DB, if the container goes into a restart loop
      # ensure that the correct database and users have been created. (You should ensure the init script is run)
      DB_NAME: etherpad
      DB_USER: etherpad
      DB_PASS: etherpad
      # only API can create pads
      EDIT_ONLY: true
    # restart the container until db has created tables
    restart: on-failure
    depends_on:
      - db



  db:
    image: postgres:16.11-alpine
    hostname: db
    restart: on-failure
    # Ports are not exposed by default
    # ports:
    #   - "5432:5432"
    volumes:
      # a docker volume to persist the postgres data
      # Delete this volume if you want to reset your DB
      - postgres_data:/var/lib/postgresql/data
      # copy the init script inside the docker container where it will be executed
      # WARNING: It will only be executed when there is no data mounted to the container
      # If you want to execute it, down the container, delete the volume associated to it and up the container again, it should execute.
      - ./postgresql:/docker-entrypoint-initdb.d
    environment:
      POSTGRES_DB: docker
      POSTGRES_USER: docker
      POSTGRES_PASSWORD: docker
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis
    restart: on-failure
    hostname: redis
    # Ports are not exposed by default
    # ports:
    #   - "6379:6379"

  meilisearch:
    image: getmeili/meilisearch:v1.8
    hostname: meilisearch
    restart: on-failure
    # Ports are not exposed by default
    # ports:
    #   - "7700:7700"
    environment:
      - MEILI_MASTER_KEY=masterKey # Change this !
      - MEILI_NO_ANALYTICS=true
      - MEILI_ENV=development
      - MEILI_LOG_LEVEL
    volumes:
      - meilisearch_data:/meili_data

```

## Support files

We need to create some supporting files.

- compose.yml
- caddy/
  - Caddyfile
- postgresql/
  - init.sql
- garage/
  - garage.toml

caddy/Caddyfile

```Caddyfile
# caddy/Caddyfile

:3000 {
    handle /admin* {
        reverse_proxy web:4000
    }

    handle {
        rewrite * /api{uri}
        reverse_proxy api:3000
    }
}
:4001 {
    handle /api* {
        reverse_proxy api:3000
      }
    handle {
        reverse_proxy web:4000
      }
  }

```

postgresql/init.sql

```sql
-- postgresql/init.sql

-- Umami
create user umami with password 'umami';
create database umami with owner umami;
-- Backend
create user graasper with password 'graasper';
create database graasp with owner graasper;
--Etherpad
create user etherpad with password 'etherpad';
create database etherpad with owner etherpad;

-- set timeout settings for postgres
-- should avoid transactions to hang for too long
set idle_in_transaction_session_timeout = '3600000'; -- in milliseconds, 1h
set statement_timeout = '3600000'; -- in milliseconds, 1h
```

garage/garage.toml

```toml
# garage/garage.toml

metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"

replication_factor = 1

rpc_bind_addr = "[::]:3901"
rpc_public_addr = "127.0.0.1:3901"
# generate with: $(openssl rand -hex 32)
rpc_secret = "CHANGE_ME"

[s3_api]
s3_region = "garage"
api_bind_addr = "[::]:3900"
root_domain = ".s3.garage.localhost"

[s3_web]
bind_addr = "[::]:3902"
root_domain = ".web.garage.localhost"
index = "index.html"

[k2v_api]
api_bind_addr = "[::]:3904"

[admin]
api_bind_addr = "[::]:3903"
# generate with: $(openssl rand -base64 32)
admin_token = "CHANGE_ME"
# generate with: $(openssl rand -base64 32)
metrics_token = "CHANGE_ME"

```

Replace the `CHANGE_ME` values with results from the commands in comment above.

Persistance

https

reverse proxy

Database migrations
