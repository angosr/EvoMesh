FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    git openssh-client curl ca-certificates ttyd nodejs npm gosu \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code@latest

WORKDIR /project
EXPOSE 7681

COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
