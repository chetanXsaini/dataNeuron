const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const PORT = process.env.PORT || 10000;

const app = express();
app.use(cors());
app.use(bodyParser.json());

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mail4spamcontrol:GZ6x00vCO2CifJC7@cluster0.xthuov3.mongodb.net/';

const mongoClient = new MongoClient(MONGODB_URI);

mongoClient.connect((err, client) => {
    if (err){
        console.error('Failed to connect to MongoDB:', err);
        return;
    }
})

const windowsCollection = mongoClient.db('windows').collection('windows');

async function updateDocument(collection, identifier, isAdded, number) {
    try {
        let doc = await collection.findOne({ identifier });

        if (isAdded) {
            const keys = Object.keys(doc.versions).map(Number).filter(key => !isNaN(key));
            const largestKey = Math.max(...keys, -1);
            const newKey = largestKey + 1;
            doc.versions[newKey] = number;
            doc.number = number;
            doc.add_count++;
        } else {
            const keys = Object.keys(doc.versions).map(Number).filter(key => !isNaN(key));
            const largestKey = Math.max(...keys, -1);
            doc.versions[largestKey] = number;
            doc.number = number;
            doc.update_count++;
        }

        const updatedDocument = await collection.findOneAndUpdate(
            { identifier },
            { $set: doc },
            { returnDocument: 'after', upsert: true }
        );

        return updatedDocument;
    } catch (err) {
        console.error(`Failed to update document: ${err}`);
    }
}

app.get('/', (req, res) => {
    res.send('Hello World');
})


app.get('/:identifier', async (req, res) => {
    try {
        const identifier = req.params.identifier;
        const window = await windowsCollection.findOne({ identifier: identifier });

        if (!window) {
            return res.status(404).send({ error: 'Window not found' });
        }

        const response = {
            number: window.number,
            updateCount: window.update_count,
            addCount: window.add_count,
            previousValue: getPreviousValue(window.versions)
        };

        res.send(response);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


app.put('/:identifier', async (req, res) => {
    try {
        const identifier = req.params.identifier;
        const data = req.body;

        const number = Number(data.number);
        const isAdded = Number(data.isAdded);

        const updatedDoc = await updateDocument(windowsCollection, identifier, isAdded, number);

        const response = {
            number: updatedDoc.number,
            updateCount: updatedDoc.update_count,
            addCount: updatedDoc.add_count,
            previousValue: getPreviousValue(updatedDoc.versions)
        };

        res.send(response);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port: ${PORT}`);
});

function getPreviousValue(obj) {
    const keys = Object.keys(obj).map(Number).filter(key => !isNaN(key));
    const sortedKeys = keys.sort((a, b) => b - a);
    return sortedKeys.length > 1 ? obj[sortedKeys[1].toString()] : null;
}