#
# This is a script to set up the database.
#  It is never used again.
#

import mysql.connector as mysql

dataBase = mysql.connect(
    host = 'localhost',
    user = 'root',
    passwd = 'new_password'
)

cursorObject = dataBase.cursor()

cursorObject.execute("CREATE DATABASE markeddb1")

print("Database 'MarkEd' set up.")
