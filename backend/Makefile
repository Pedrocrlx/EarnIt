up-ba: ## Build and start the backend stack
	docker compose up --build

down: ## Stop and remove the Docker containers and volumes
	docker compose down -v

enter-db: ## Enter the PostgreSQL database and list tables
	docker compose exec db psql -U earn_it_user -d earn_it_db -c "\dt"

ruff: ## Run ruff check
	uv run ruff check .

rm-venv:
	sudo rm -rf .venv/

