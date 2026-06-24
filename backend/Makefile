.PHONY: help up-ba down migrate enter-db ruff format lint-fix mail-up mail-down mail-logs clean full-clean test test-api test-all

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-12s\033[0m %s\n", $$1, $$2}'

## Variables

COMPOSE_BUILD := docker compose build
COMPOSE_BUILD_API := docker compose build api
COMPOSE_RUN := docker compose run --rm
COMPOSE_EXEC := docker compose exec

## --- Stack ---

up-ba: ## Build and start the backend stack
	docker compose up --build

down: ## Stop and remove the Docker containers and volumes
	docker compose down -v

## --- Database ---

alembic-upgrade: ## Apply Alembic migrations up to head (needs the db container)
	$(COMPOSE_RUN) api uv run alembic -c /app/alembic.ini upgrade head

alembic-revision: ## Create a new Alembic revision (usage: make alembic-revision msg="your message")
	$(COMPOSE_RUN) api uv run alembic -c /app/alembic.ini revision --autogenerate -m "$(msg)"

enter-db: ## Enter the PostgreSQL database
	$(COMPOSE_EXEC) db psql -U earn_it_user -d earn_it_db

## --- Mail (isolated, see mail/README.md) ---

mail-up: ## Start Mailpit on its own (isolated from db/api)
	docker compose -f mail/compose.yaml up -d

mail-down: ## Stop Mailpit
	docker compose -f mail/compose.yaml down

mail-logs: ## Tail Mailpit logs
	docker compose -f mail/compose.yaml logs -f

## --- Tests (need the db container; mail is mocked) ---

test: ## Run the essential unit suite (critical modules)
	uv run pytest tests --ignore=tests/api

test-api: ## Run the API suite (endpoint flows)
	$(COMPOSE_RUN) api bash -c "find . -type d -name '__pycache__' -exec rm -rf {} + && uv run pytest tests/api"

test-all: ## Run every test (essential + api)
	$(COMPOSE_RUN) api bash -c "find . -type d -name '__pycache__' -exec rm -rf {} + && uv run pytest tests"
## --- Code quality ---

format: ## Run ruff formatting
	$(COMPOSE_BUILD_API)
	$(COMPOSE_RUN) --no-deps api uv run ruff format src

lint-fix: ## Run ruff and apply automatic fixes
	$(COMPOSE_BUILD_API)
	$(COMPOSE_RUN) --no-deps api uv run ruff check --fix src

## --- Cleanup ---

clean: ## Remove Python and tool caches (keeps the virtualenv)
	sudo find . -type d -name __pycache__ -prune -exec rm -rf {} +
	sudo rm -rf .ruff_cache .pytest_cache

full-clean: clean ## Full cleanup — everything in clean plus the local virtualenv
	sudo rm -rf .venv

nuke: ## Deep clean caches, destroy containers/volumes, and force a clean rebuild
	$(MAKE) clean
	$(MAKE) down
	$(MAKE) up-ba
