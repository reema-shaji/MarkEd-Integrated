#!/bin/bash

# Check if dump directory parameter is provided
if [ -z "$1" ]; then
    echo "Error: Please provide the dump directory path as a parameter"
    echo "Could be like this: $0 ./Dump20241217"
    echo "Usage: $0 <dump_directory_path>"
    exit 1
fi

# Check if dump directory exists
if [ -d "$1" ]; then
    echo "Found dump directory $1, importing data..."
    
    # Wait for database to be ready
    until mysqladmin ping -h"127.0.0.1" -u"root" -p"new_password" --silent; do
        echo "Waiting for database connection..."
        sleep 2
    done
    
    # Import all SQL files
    for file in "$1"/*.sql; do
        echo "Importing $file..."
        mysql -h"127.0.0.1" -u"root" -p"new_password" markeddb1 < "$file"
    done
    
    echo "Data import complete!"
else
    echo "Error: Directory $1 does not exist"
    exit 1
fi