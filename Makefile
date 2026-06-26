.PHONY: help up down pre-commit-install pre-commit-run

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-6s\033[0m %s\n", $$1, $$2}'

## --- Full stack (proxy + db + mailpit + api + frontend) ---

up: ## Build and start the full stack (detached)
	docker compose up --build -d

down: ## Stop and remove the full stack, including volumes (wipes the db)
	docker compose down

## --- Code quality ---

pre-commit-install: ## Install the repository pre-commit hook
	uvx pre-commit install

pre-commit-run: ## Run every pre-commit check against the repository
	uvx pre-commit run --all-files
