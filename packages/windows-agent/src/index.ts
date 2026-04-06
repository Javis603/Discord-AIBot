import express from 'express';
import { exec } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

const apiKey = process.env.WINDOWS_AGENT_API_KEY;

if (!apiKey) {
    console.error('WINDOWS_AGENT_API_KEY is not set. Please create a .env file and set it.');
    process.exit(1);
}

app.use(express.json());

// Authentication middleware
app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send('Unauthorized: Missing or invalid Authorization header.');
    }

    const providedApiKey = authHeader.split(' ')[1];
    if (providedApiKey !== apiKey) {
        return res.status(401).send('Unauthorized: Invalid API Key.');
    }

    next();
});

app.post('/cleanup-temp-files', (req, res) => {
    const command = 'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue';
    exec(command, { 'shell': 'powershell.exe' }, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).send({ error: error.message, stderr });
        }
        res.send({ message: 'Temp files cleanup command executed.', stdout, stderr });
    });
});

app.get('/get-disk-space', (req, res) => {
    const command = 'Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{Name="Used";Expression={$_.Used / 1GB}}, @{Name="Free";Expression={$_.Free / 1GB}} | ConvertTo-Json';
    exec(command, { 'shell': 'powershell.exe' }, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).send({ error: error.message, stderr });
        }
        res.send({ drives: JSON.parse(stdout) });
    });
});

app.listen(port, () => {
  console.log(`Windows agent listening at http://localhost:${port}`);
});
