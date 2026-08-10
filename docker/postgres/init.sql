-- docker/postgres/init.sql
-- Runs once when the container is first created

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for full-text search

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE itsm_db TO itsm_user;
