# EarnIt


# Architecture

The app is a React SPA served by Vite, talking to a FastAPI backend. FastAPI persists data in PostgreSQL. In the full stack setup, Nginx is the single public entrypoint on port 80: it routes `/` to the Vite dev server for the SPA, and `/api`, `/docs`, and `/openapi.json` to FastAPI. FastAPI then reads/writes to PostgreSQL on the internal Docker network, while the browser only ever talks to Nginx.

For development, you can run the full stack or run the backend and frontend separately (as shown below). Backend-only runs expose the API directly on port 8000 for `/docs`, while frontend-only runs expose the Vite dev server on port 3000.

```mermaid
graph TD
    %% External Client / User
    User((User / Browser)) -->|Port 80| Proxy

    %% Services Block
    subgraph Docker_Compose [Docker Compose Network]
        
        %% Proxy Service
        Proxy[nginx-proxy <br> nginx:1.25-alpine]
        
        %% Frontend Service
        Frontend[frontend <br> Bun + Vite]
        
        %% API Service
        API[earnIt_api <br> FastAPI]
        
        %% Database Service
        DB[(earnIt_db <br> postgres:17-alpine)]
        
        %% Named Volumes
        PostgresVolume[(postgres_data)]
    end

    %% Internal routing from Proxy
    Proxy -->|Routes Traffic| Frontend
    Proxy -->|Routes Traffic| API

    %% Internal service dependencies
    API -->|Depends on Healthy DB| DB
    DB -.->|Persists Data| PostgresVolume

    %% Styling
    style User fill:#f9f,stroke:#333,stroke-width:2px
    style Proxy fill:#bbf,stroke:#333,stroke-width:2px
    style DB fill:#ffb,stroke:#333,stroke-width:2px
    style PostgresVolume fill:#ddd,stroke:#333,stroke-width:1px,stroke-dasharray: 5 5
```

# Development Architecture Backend
```mermaid
graph TD
    %% External Developer Access
    Dev([Developer / API Client]) -->|Port 8000| API
    Dev -->|Port 5432| DB

    %% Backend Environment Subgraph
    subgraph Backend_Stack [Backend Dev Environment]
        
        %% API Service
        API[earnIt_api <br> FastAPI Container]
        
        %% DB Service
        DB[(earnIt_db <br> postgres:17-alpine)]
        
        %% Data and Init Configs
        PostgresVolume[(postgres_data Volume)]
        InitSQL["./ops/postgres/init.sql"]
    end

    %% Dependencies and Mounts
    API -->|Depends on Healthy DB| DB
    DB -.->|Persists Data| PostgresVolume
    InitSQL -.->|Initializes schema| DB

    %% Styling
    style Dev fill:#f9f,stroke:#333,stroke-width:2px
    style API fill:#bbf,stroke:#333,stroke-width:2px
    style DB fill:#ffb,stroke:#333,stroke-width:2px
    style PostgresVolume fill:#ddd,stroke:#333,stroke-width:1px,stroke-dasharray: 5 5
    style InitSQL fill:#e1f5fe,stroke:#0288d1,stroke-width:1px
```

# Development Architecture Frontend
```mermaid
graph TD
    %% External Browser Access
    Browser([User / Browser]) -->|Port 3000| Frontend

    %% Frontend Environment Subgraph
    subgraph Frontend_Stack [Frontend Dev Environment]
        
        %% Frontend Service
        Frontend[frontend <br> Bun + Vite Dev Server]
    end

    %% Styling
    style Browser fill:#f9f,stroke:#333,stroke-width:2px
    style Frontend fill:#bbf,stroke:#333,stroke-width:2px
```

# Contribution Guide

See [docs/contribute_guide.md](docs/contribute_guide.md).

# AI Usage section

## Phase 1
- **Gemini** helped in all documentation (deliverables of Phase 1).
- **Google Stich** is being used to generate the wireframes and low-fidelity prototypes of the application.
- **Gemini** helped configure the project folder structure and create compose-yaml with the servicos defined by the Product Owner.
- **NootbookLM** is being used for its sources to be the source of truth, for any question about the current state of the project, stack, which epic is being attacked...etc.

## Phase 2
- **GPT-5.2-Codex** helps build the CI pipelines, documentation, and compose services to run the full stack, following my guides.
