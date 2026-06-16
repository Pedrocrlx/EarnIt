.PHONY: help up-ba down enter-db ruff format lint-fix rm-venv mail-up mail-down mail-logs

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-12s\033[0m %s\n", $$1, $$2}'

## --- Stack ---

up-ba: ## Build and start the backend stack
	docker compose up --build

down: ## Stop and remove the Docker containers and volumes
	docker compose down -v

## --- Database ---

enter-db: ## Enter the PostgreSQL database and list tables
	docker compose exec db psql -U earn_it_user -d earn_it_db -c "\dt"

## --- Mail (isolated, see mail/README.md) ---

mail-up: ## Start Mailpit on its own (isolated from db/api)
	docker compose -f mail/compose.yaml up -d

mail-down: ## Stop Mailpit
	docker compose -f mail/compose.yaml down

mail-logs: ## Tail Mailpit logs
	docker compose -f mail/compose.yaml logs -f

## --- Code quality ---

format: ## Run ruff formatting
	uv run ruff format .

lint-fix: ## Run ruff and apply automatic fixes
	uv run ruff check src . --fix

## --- Cleanup ---

cache: ## Remove the local virtualenv and __pycache__ directories
	sudo rm -rf .venv/
	sudo rm -rf */__pycache__
	sudo rm -rf .ruff_cache/
