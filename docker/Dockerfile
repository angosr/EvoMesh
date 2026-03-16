FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git openssh-client curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install ttyd from GitHub releases
RUN curl -sL -o /usr/local/bin/ttyd https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64 \
    && chmod +x /usr/local/bin/ttyd

RUN npm install -g @anthropic-ai/claude-code@latest

ARG USER_UID=1000
ARG USER_GID=1000
RUN groupadd -g ${USER_GID} evomesh 2>/dev/null || true && \
    useradd -m -u ${USER_UID} -g ${USER_GID} -s /bin/bash evomesh 2>/dev/null || true

USER evomesh
WORKDIR /project
EXPOSE 7681

COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
