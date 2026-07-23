#!/bin/bash

# Configuration
CONTAINER_NAME="marked-mysql"
DB_NAME="markeddb1"
DB_USER="root"
DB_PASS="new_password"
DUMP_DIR="Dump$(date +%Y%m%d)"

# Create dump directory
mkdir -p "$DUMP_DIR"

# Get list of tables with MarkEd_ prefix
TABLES=$(docker exec $CONTAINER_NAME mysql -u$DB_USER -p$DB_PASS $DB_NAME -N -e "SHOW TABLES LIKE 'MarkEd_%';")

# Function to escape special characters in table names
escape_table_name() {
    echo "$1" | sed 's/[^a-zA-Z0-9_]/_/g'
}

# Dump each table
for TABLE in $TABLES
do
    echo "Dumping table: $TABLE"
    
    # Escape table name for filename
    SAFE_TABLE_NAME=$(escape_table_name "$TABLE")
    
    # Structure dump (CREATE TABLE statement)
    docker exec $CONTAINER_NAME mysqldump \
        -u$DB_USER \
        -p$DB_PASS \
        --no-data \
        $DB_NAME \
        "$TABLE" > "$DUMP_DIR/${SAFE_TABLE_NAME}_structure.sql"
    
    # Data dump (INSERT statements)
    docker exec $CONTAINER_NAME mysqldump \
        -u$DB_USER \
        -p$DB_PASS \
        --no-create-info \
        $DB_NAME \
        "$TABLE" > "$DUMP_DIR/${SAFE_TABLE_NAME}_data.sql"
    
    # Combine structure and data into final file
    cat "$DUMP_DIR/${SAFE_TABLE_NAME}_structure.sql" \
        "$DUMP_DIR/${SAFE_TABLE_NAME}_data.sql" \
        > "$DUMP_DIR/${SAFE_TABLE_NAME}.sql"
    
    # Remove temporary files
    rm "$DUMP_DIR/${SAFE_TABLE_NAME}_structure.sql" \
       "$DUMP_DIR/${SAFE_TABLE_NAME}_data.sql"
done

echo "Dump completed in directory: $DUMP_DIR"

# Print summary
echo "Summary of dumped files:"
ls -lh "$DUMP_DIR"