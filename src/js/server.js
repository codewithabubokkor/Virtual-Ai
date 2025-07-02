import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import pool from './db-config.js';
import dotenv from 'dotenv';
import session from 'express-session';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;


app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'virtual-ai-chat-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));


async function checkDatabaseConnection() {
    try {

        const [rows] = await pool.query('SELECT 1 as connection_test');
        if (rows && rows[0] && rows[0].connection_test === 1) {
            console.log("Database connection successful");


            try {
                const [tables] = await pool.query(`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = ?
                `, [process.env.DB_NAME]);

                const tableNames = tables.map(t => t.table_name);
                console.log("Database tables found:", tableNames.join(', '));

                if (!tableNames.includes('conversations') || !tableNames.includes('messages')) {
                    console.warn("Warning: Required tables may be missing. Run db-setup.js if needed.");
                }
            } catch (tableError) {
                console.error("Error checking tables:", tableError.message);
            }

            return true;
        } else {
            console.error("Database connection test failed");
            return false;
        }
    } catch (error) {
        console.error("Database connection error:", error.message);
        return false;
    }
}


function processSearchResults(rows, res) {

    const conversationMap = new Map();
    rows.forEach(row => {
        if (!conversationMap.has(row.conversation_id)) {
            conversationMap.set(row.conversation_id, {
                id: row.conversation_id,
                title: row.title,
                messages: []
            });
        }


        const conversation = conversationMap.get(row.conversation_id);
        conversation.messages.push({
            id: row.id,
            content: row.content,
            is_user: row.is_user === 1,
            timestamp: row.timestamp
        });
    });

    res.json(Array.from(conversationMap.values()));
}


app.post('/api/conversations', async (req, res) => {
    try {
        const { userId, title, topicId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const [result] = await pool.query(
            'INSERT INTO conversations (user_id, title, topic_id) VALUES (?, ?, ?)',
            [userId, title || 'New Conversation', topicId || null]
        );

        res.status(201).json({
            id: result.insertId,
            userId,
            title: title || 'New Conversation',
            topicId,
            created_at: new Date()
        });
    } catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
});

app.get('/api/conversations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const [rows] = await pool.query(
            'SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC',
            [userId]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

app.post('/api/messages', async (req, res) => {
    try {
        const { conversationId, userId, content, isUser } = req.body;
        console.log("Received message save request:", { conversationId, userId, contentLength: content?.length, isUser });

        if (!conversationId || !userId || !content) {
            console.warn("Message save failed: Missing required fields");
            return res.status(400).json({ error: 'Missing required fields' });
        }


        const [convCheck] = await pool.query(
            'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
            [conversationId, userId]
        );

        if (!convCheck || convCheck.length === 0) {
            console.error("Message save failed: Conversation not found", { conversationId, userId });
            return res.status(404).json({ error: 'Conversation not found' });
        }

        try {

            const [result] = await pool.query(
                'INSERT INTO messages (conversation_id, user_id, content, is_user) VALUES (?, ?, ?, ?)',
                [conversationId, userId, content, isUser]
            );

            console.log(`Message saved successfully with ID: ${result.insertId}`);


            await pool.query(
                'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [conversationId]
            );

            res.status(201).json({
                id: result.insertId,
                conversationId,
                userId,
                content,
                isUser,
                timestamp: new Date()
            });
        } catch (insertError) {
            console.error('Database error when saving message:', insertError);
            res.status(500).json({
                error: 'Failed to save message to database',
                details: insertError.message
            });
        }
    } catch (error) {
        console.error('Error saving message:', error);
        res.status(500).json({ error: 'Failed to save message' });
    }
});

app.get('/api/messages/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;

        const [rows] = await pool.query(
            'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
            [conversationId]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.delete('/api/conversations/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;


        await pool.query('DELETE FROM conversations WHERE id = ?', [conversationId]);

        res.json({ success: true, message: 'Conversation deleted successfully' });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const { userId, term } = req.query;

        if (!userId || !term) {
            return res.status(400).json({ error: 'User ID and search term are required' });
        }


        try {
            const [rows] = await pool.query(
                `SELECT m.*, c.title, c.id as conversation_id 
                 FROM messages m 
                 JOIN conversations c ON m.conversation_id = c.id 
                 WHERE m.user_id = ? 
                 AND MATCH(m.content) AGAINST(? IN NATURAL LANGUAGE MODE)
                 AND c.user_id = ? 
                 ORDER BY m.timestamp DESC 
                 LIMIT 20`,
                [userId, term, userId]
            );


            if (rows && rows.length > 0) {

                processSearchResults(rows, res);
                return;
            }
        } catch (fullTextError) {
            console.log("Fulltext search not available, using LIKE search instead");
        }


        const [rows] = await pool.query(
            `SELECT m.*, c.title, c.id as conversation_id 
             FROM messages m 
             JOIN conversations c ON m.conversation_id = c.id 
             WHERE m.user_id = ? AND m.content LIKE ? AND c.user_id = ? 
             ORDER BY m.timestamp DESC 
             LIMIT 20`,
            [userId, `%${term}%`, userId]);


        processSearchResults(rows, res);
    } catch (error) {
        console.error('Error searching conversations:', error);
        res.status(500).json({ error: 'Failed to search conversations' });
    }
});


app.get('/api/conversations/topic/:topicId', async (req, res) => {
    try {
        const { topicId } = req.params;

        if (!topicId) {
            return res.status(400).json({ error: 'Topic ID is required' });
        }

        const [rows] = await pool.query(
            'SELECT * FROM conversations WHERE topic_id = ? ORDER BY created_at ASC',
            [topicId]
        );

        console.log(`Found ${rows.length} conversations for topic ${topicId}`);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching conversations by topic:', error);
        res.status(500).json({ error: 'Failed to fetch conversations by topic' });
    }
});


app.get('/api/health/database', async (req, res) => {
    try {

        const [tables] = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = ?
        `, [process.env.DB_NAME]);

        const tableNames = tables.map(t => t.table_name);


        const [conversationsCount] = await pool.query('SELECT COUNT(*) as count FROM conversations');
        const [messagesCount] = await pool.query('SELECT COUNT(*) as count FROM messages');

        res.json({
            status: 'ok',
            database: process.env.DB_NAME,
            tables: tableNames,
            stats: {
                conversations: conversationsCount[0].count,
                messages: messagesCount[0].count
            }
        });
    } catch (error) {
        console.error('Database health check failed:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});



app.get('/api/debug/all-conversations', async (req, res) => {
    try {

        const [rows] = await pool.query(
            'SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 100'
        );

        res.json(rows);
    } catch (error) {
        console.error('Error fetching all conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});


app.get('/api/debug/all-messages', async (req, res) => {
    try {

        const [rows] = await pool.query(
            'SELECT * FROM messages ORDER BY timestamp DESC LIMIT 200'
        );

        res.json(rows);
    } catch (error) {
        console.error('Error fetching all messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});


app.get('/api/debug/user-messages/:userId', async (req, res) => {
    try {
        const { userId } = req.params;


        const [rows] = await pool.query(
            'SELECT m.* FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.user_id = ? ORDER BY m.timestamp DESC LIMIT 100',
            [userId]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error fetching user messages:', error);
        res.status(500).json({ error: 'Failed to fetch user messages' });
    }
});

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);


    const dbConnected = await checkDatabaseConnection();
    if (dbConnected) {
        console.log("Database initialized successfully");
    } else {
        console.warn("Warning: Database connection check failed. Chat history may not work correctly.");
    }
});

export default app;
