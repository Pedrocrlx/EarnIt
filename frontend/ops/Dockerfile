FROM node:24.16-slim

# Install tools required by bun installer
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*

# Install bun to a global location readable by everyone
ENV BUN_INSTALL=/usr/local/bun
ENV PATH=$BUN_INSTALL/bin:$PATH
RUN curl -fsSL https://bun.sh/install | bash

# Allow the build to create a non-root user matching the host UID/GID
ARG UID=1000
ARG GID=1000
RUN (groupadd -g ${GID} appgroup || groupadd appgroup) \
 && (useradd -m -u ${UID} -g appgroup appuser || useradd -m -g appgroup appuser)

WORKDIR /app

# Copy only package files first for better cache usage and set ownership to the non-root user
COPY --chown=appuser:appgroup package.json bun.lockb* ./

# Switch to non-root user and install dependencies so node_modules are
# owned by the non-root user (avoids permission issues with bind mounts)
USER appuser

# Copy the rest of the source code as the non-root user
COPY --chown=appuser:appgroup . .
RUN bun install

EXPOSE 5173

CMD ["bun", "run", "dev", "--host", "0.0.0.0"]
