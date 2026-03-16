FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    git openssh-client curl ca-certificates ttyd nodejs npm gosu python3 python3-pip tmux \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages websockets
RUN npm install -g @anthropic-ai/claude-code@latest

WORKDIR /project
EXPOSE 7681

COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
