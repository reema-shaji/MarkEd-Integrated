# Setup notes


## 0. Prerequisites
- Docker and Docker Compose installed
- Git repository cloned locally

## 1. Docker compose

```bash
# Start everything
docker compose up -d
```

Then you will be able to access the following:
- Back end will be running.
- Front end will be running on: `http://localhost`. 
  - Some requests will be routed to Django REST api 
- Nginx will be running: It will route requests to the Django REST (`/api`) or the React frontend or the outdated Django Templates. Config is on `nginx.config`.
- SQL DB will be running: Use `root` and `new_password` over port `3306` on `localhost` and on db called `markeddb1`.

## 2. Dumping SQL DB

If you want some demo data, you can populate the DB with the script `db-scripts/populate_database.sh`. 

If you want to save the state of the DB use `db-scripts/dump_database.sh`.

## 3. End-to-end types. 

Navigate to  `MarkEd-front` and run `npm run generate-api` to generate types from the Django ORM. 


## 4. Email

If you are using the email system, you will need to give your email credentials on `send_email()` functions



# Useful commands


Other commands: 
```bash
# If you've changed any of Dockerfiles, requirements.txt, package.json, config files that get copied over... you should rebuild the images instead
docker compose up --build

# Stop everything (preserves data)
docker compose down

# Stop and delete everything (complete reset)
docker compose down -v --rmi all

# Rebuild specific service
docker compose build backend  # or frontend/db

# Rebuild and restart specific service
docker compose up -d --build backend  # or frontend/db
```

# New models on DB

When adding, editing or removing tables (or models) on `models.py`, you should also reflect the changes everywhere else. 

Firstly, create and apply the new migrations
```
# Generate migration files.
python manage.py makemigrations

# Apply migrations to database
python manage.py migrate
```

Then, generate the front end types 
```
# Navigate to frontend directory
cd MarkEd-front

# Run type generation script
npm run generate-api
```
If using Docker, youll have to run the commands above within the container or redeploy the containers that need the changes. 

# Lint on NextJS

To force fix all issues:
```
npx eslint --fix .  
```

To test if linting will pass:
```
npm run lint 
```

# Development Setup

## Git Hooks

This project uses git hooks to ensure code quality. To set them up:

```bash
# If using the .githooks directory (recommended):
git config core.hooksPath .githooks

# Or if using the traditional .git/hooks directory:
chmod +x .git/hooks/pre-commit
```

The pre-commit hook will:
- Run backend tests
- Run frontend linting

These checks must pass before you can commit your changes.