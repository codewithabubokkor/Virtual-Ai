import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


dotenv.config({ path: path.join(__dirname, '../../.env') });

async function setupDatabase() {
    let connection;

    try {
        console.log('Starting database setup...');


        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT
        });


        console.log(`Creating database ${process.env.DB_NAME} if it doesn't exist...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);


        await connection.query(`USE ${process.env.DB_NAME}`);


        console.log('Creating conversations table...');
        await connection.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        topic_id VARCHAR(255) NULL,
        INDEX (user_id),
        INDEX idx_user_updated (user_id, updated_at),
        INDEX idx_topic_id (topic_id)
      )
    `);


        console.log('Creating messages table...');
        await connection.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        is_user BOOLEAN NOT NULL DEFAULT TRUE,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        INDEX (conversation_id),
        INDEX (user_id, timestamp),
        INDEX idx_user_content (user_id, content(255)),
        INDEX idx_conversation_timestamp (conversation_id, timestamp)
      )
    `);



        try {
            console.log('Attempting to create fulltext index for better searching...');
            await connection.query(`ALTER TABLE messages ADD FULLTEXT INDEX ft_content (content)`);
            console.log('Fulltext index created successfully!');
        } catch (error) {
            console.log('Fulltext index not created. This is optional and requires MySQL 5.6+.');
        }


        try {
            console.log('Checking if topic_id column exists in conversations table...');
            const [columns] = await connection.query(`SHOW COLUMNS FROM conversations LIKE 'topic_id'`);
            if (columns.length === 0) {
                console.log('Adding topic_id column to conversations table...');
                await connection.query(`ALTER TABLE conversations ADD COLUMN topic_id VARCHAR(255) NULL, ADD INDEX idx_topic_id (topic_id)`);
                console.log('topic_id column added successfully!');
            } else {
                console.log('topic_id column already exists.');
            }
        } catch (error) {
            console.error('Error checking or adding topic_id column:', error);
        }

        console.log('Database setup completed successfully!');
    } catch (error) {
        console.error('Error setting up database:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed.');
        }
    }
}


setupDatabase();
