const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 3000;
const LOG_FILE_PATH = path.join(__dirname, 'public', 'logs.json');
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Helper function to safely get nested values
function getSafe(obj, pathArray, defaultValue = null) {
  if (!obj || typeof obj !== 'object') return defaultValue;
  let current = obj;
  for (const key of pathArray) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }
  return current;
}

async function appendLog(logEntry) {
  try {
    let logs = [];
    try {
      const data = await fsp.readFile(LOG_FILE_PATH, 'utf8');
      logs = JSON.parse(data);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error reading log file for appending:', error);
      }
    }
    logs.unshift(logEntry); 
    if (logs.length > 100) {
        logs.length = 100;
    }
    await fsp.writeFile(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

const commonStyles = `
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f7f9fc;
  color: #333;
  margin: 0;
  padding: 0;
  line-height: 1.6;
}

.container {
  width: 80%;
  max-width: 1000px;
  margin: 20px auto;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

header {
  background-color: #4a6cf7;
  color: white;
  padding: 25px 30px;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.content-area {
  padding: 30px;
}

.error {
  color: #e53935;
  background-color: #ffebee;
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 20px;
  font-size: 14px;
  font-weight: 500;
}

.error:before {
  margin-right: 10px;
  font-size: 16px;
}

form {
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
}

label {
  font-weight: 500;
  margin-bottom: 8px;
  color: #555;
  font-size: 14px;
}

input[type="password"] {
  padding: 12px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
  background-color: #f9fafc;
  transition: all 0.3s ease;
  margin-bottom: 20px;
}

input[type="password"]:focus {
  outline: none;
  border-color: #4a6cf7;
  box-shadow: 0 0 0 2px rgba(74, 108, 247, 0.1);
  background-color: #fff;
}

button, input[type="submit"] {
  background-color: #4a6cf7;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 15px;
  align-self: flex-start;
}

button:hover, input[type="submit"]:hover {
  background-color: #2d50e6;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74, 108, 247, 0.2);
}

.logs-container {
  margin-top: 20px;
  max-height: 70vh;
  overflow-y: auto;
  padding: 5px;
}

.log-entry {
  background-color: #f9fafc;
  border-left: 4px solid #4a6cf7;
  border-radius: 6px;
  margin-bottom: 15px;
  padding: 16px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  transition: transform 0.2s ease;
}

.log-entry:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.log-entry.error {
  border-left-color: #e53935;
}

.log-entry.success {
  border-left-color: #43a047;
}

.log-entry.warning {
  border-left-color: #fb8c00;
}

.log-entry h3 {
  display: flex;
  align-items: center;
  font-size: 16px;
  margin-bottom: 12px;
  font-weight: 600;
  color: #333;
}

.log-entry h3:before {
  content: "";
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 10px;
  background-color: #4a6cf7;
}

.log-entry.error h3:before {
  background-color: #e53935;
}

.log-entry.success h3:before {
  background-color: #43a047;
}

.log-entry.warning h3:before {
  background-color: #fb8c00;
}

.log-entry p {
  margin: 8px 0;
  font-size: 14px;
  display: flex;
}

.log-entry strong {
  min-width: 90px;
  font-weight: 500;
  color: #555;
}

.log-entry pre {
  background-color: #f0f2f5;
  padding: 12px;
  border-radius: 6px;
  margin-top: 10px;
  margin-bottom: 5px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  overflow-x: auto;
  color: #333;
  white-space: pre-wrap;
}

.timestamp {
  color: #757575;
  font-size: 12px;
  margin-bottom: 10px;
  display: block;
}

.logout-button {
  background-color: transparent;
  color: #4a6cf7;
  border: 1px solid #4a6cf7;
  padding: 8px 16px;
}

.logout-button:hover {
  background-color: rgba(74, 108, 247, 0.1);
  color: #2d50e6;
  border-color: #2d50e6;
  box-shadow: none;
}

.no-logs {
  text-align: center;
  padding: 40px 20px;
  color: #9e9e9e;
  font-size: 16px;
}

.refresh-button {
  margin-left: 10px;
  background-color: #fff;
  color: #4a6cf7;
  border: 1px solid #4a6cf7;
  padding: 8px 16px;
}

.refresh-button:hover {
  background-color: rgba(74, 108, 247, 0.1);
}

@media (max-width: 768px) {
  .container {
    width: 95%;
    margin: 20px auto;
  }
  
  header, .content-area {
    padding: 20px;
  }
  
  h1 {
    font-size: 20px;
  }
}
`;

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

const getDomainName = (req) => {
  try {
    const url = `${req.protocol}://${req.host}`;
    const { hostname } = new URL(url);
    const cleanHost = hostname.replace(/^www\./, '');
    const parts = cleanHost.split('.');
    if (parts.length === 2) return capitalize(parts[0]);
    return parts.slice(0, -2).map(capitalize).join(' ') + ' ' + capitalize(parts[parts.length - 2]);
  } catch (error) {
    return 'Webhook';
  }
};

function getLoginFormHTML(req, error = '') {
  const siteTitle = getDomainName(req);
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="icon" type="image/x-icon" href="/public/favicon.ico">
        <title>${siteTitle} - Login</title>
        <style>${commonStyles}</style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>${siteTitle}</h1>
            </header>
            <div class="content-area">
                ${error ? `<div class="error">${error}</div>` : ''}
                <form method="POST" action="/logs">
                    <label for="secret">Git secret:</label>
                    <input type="password" id="secret" name="secret" placeholder="Git secret" required>
                    <input type="submit" value="Login">
                </form>
            </div>
        </div>
    </body>
    </html>
  `;
}


function getLogsViewHTML(req, logs = []) {
  let logEntriesHTML = '<div class="no-logs">No logs found.</div>';
  const siteTitle = getDomainName(req);
  
  if (logs.length > 0) {
    logEntriesHTML = logs.map(log => {
      let statusClass = '';
      
      if (log.status === 'EXECUTION_FAILURE' || log.status.includes('ERROR') || log.status.includes('FAILURE')) {
        statusClass = 'error';
      } else if (log.status === 'EXECUTION_SUCCESS' || log.status.includes('SUCCESS')) {
        statusClass = 'success';
      } else if (log.status.includes('IGNORED') || log.status.includes('WARNING')) {
        statusClass = 'warning';
      }
      
      return `
        <div class="log-entry ${statusClass}">
            <span class="timestamp">${new Date(log.timestamp).toLocaleString()}</span>
            <h3>Status: ${log.status}</h3>
            ${log.projectName ? `<p><strong>Project:</strong> ${log.projectName}</p>` : ''}
            ${log.branchName ? `<p><strong>Branch:</strong> ${log.branchName}</p>` : ''}
            ${log.eventType ? `<p><strong>Event Type:</strong> ${log.eventType}</p>` : ''}
            ${log.committer ? `<p><strong>Committer:</strong> ${log.committer}</p>` : ''}
            ${log.commitHash ? `<p><strong>Commit:</strong> <a href="#" title="${log.commitHash}">${log.commitHash.substring(0, 7)}...</a></p>` : ''} 
            <p><strong>Message:</strong> ${log.message}</p>
            ${log.details && Object.keys(log.details).length > 0 ? 
              `<p><strong>Details:</strong></p><pre>${JSON.stringify(log.details, null, 2)}</pre>` : ''}
        </div>
      `;
    }).join('');
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="icon" type="image/x-icon" href="/public/favicon.ico">
        <title>${siteTitle} - Logs</title>
        <style>${commonStyles}</style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>${siteTitle} - Logs</h1>
            </header>
            <div class="content-area">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <form method="GET" action="/">
                        <button type="submit" class="logout-button">Logout</button>
                    </form>
                    <form method="POST" action="/logs">
                        <input type="hidden" name="secret" value="${process.env.GIT_SECRET || ''}">
                        <button type="submit" class="refresh-button">Refresh Logs</button>
                    </form>
                </div>
                <div class="logs-container">
                    ${logEntriesHTML}
                </div>
            </div>
        </div>
        <script>
            // Scroll to the bottom to see the latest logs
            document.querySelector('.logs-container').scrollTop = document.querySelector('.logs-container').scrollHeight;
        </script>
    </body>
    </html>
  `;
}

app.get('/', (req, res) => {
  res.send(getLoginFormHTML(req));
});

app.post('/logs', async (req, res) => {
  const providedSecret = req.body.secret;
  const localSecret = process.env.GIT_SECRET;

  if (!localSecret) {
    console.error('Error: GIT_SECRET is not configured on the server for log access.');
    res.status(500).send(getLoginFormHTML(req, 'Server configuration error: Secret not set.'));
    return;
  }

  if (!providedSecret || providedSecret !== localSecret) {
    console.warn(`Failed attempt to access logs with incorrect secret: ${providedSecret ? 'provided' : 'not provided'}`);
    res.status(403).send(getLoginFormHTML(req, 'Access Denied: Incorrect or missing secret.'));
    return;
  }

  try {
    let logs = [];
    try {
      const data = await fsp.readFile(LOG_FILE_PATH, 'utf8');
      logs = JSON.parse(data);
    } catch (readError) {
      if (readError.code !== 'ENOENT') {
        console.error('Error reading log file for viewing:', readError);
      }
      // If file not found or unparseable, logs remains empty, which is handled
    }
    logs.reverse(); // Show newest logs at the bottom for scroll
    res.send(getLogsViewHTML(req, logs));
  } catch (error) {
    console.error('Error processing log view request:', error);
    res.status(500).send(getLoginFormHTML(req, 'Error retrieving logs.'));
  }
});

app.use(express.json({
  verify: (req, res, buf, encoding) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString(encoding || 'utf8');
    }
  }
}));

app.post('/', (req, res) => {
  const githubSignature = req.get('X-Hub-Signature-256');
  const gitlabToken = req.get('X-Gitlab-Token');
  const giteaSignature = req.get('X-Gitea-Signature'); // Common for Gitea, but might vary

  const localSecret = process.env.GIT_SECRET;
  const body = req.body;

  if (!req.rawBody) {
    console.warn('Request received without rawBody. Ensure that Content-Type is application/json.');
    appendLog({ timestamp: new Date().toISOString(), status: 'VALIDATION_ERROR', message: 'Request body is missing or not in expected format.', details: { remoteAddress: req.ip } });
    return res.status(400).send({ error: 'Request body is missing or not in expected format.' });
  }

  if (!localSecret) {
    console.error('Error: GIT_SECRET is not configured on the server.');
    appendLog({ 
        timestamp: new Date().toISOString(), 
        status: 'CONFIGURATION_ERROR', 
        message: 'GIT_SECRET is not configured.', 
        details: { project: getSafe(body, ['repository','name']) || getSafe(body, ['project','name']) || 'N/A' }
    });
    return res.status(500).send({ error: 'Internal Server Configuration Error' });
  }

  let signatureToVerify = githubSignature;
  let source = 'GitHub'; // Assume GitHub by default

  if (gitlabToken) {
    signatureToVerify = gitlabToken; // GitLab uses a token directly, not HMAC in the same way for 'secret'
    source = 'GitLab';
  } else if (giteaSignature) {
    signatureToVerify = giteaSignature;
    source = 'Gitea';
  } // If neither, it's likely GitHub or a similar HMAC-based system

  if (!signatureToVerify && source !== 'GitLab') { // GitLab might not send a signature if secret isn't set on GitLab side
    console.warn(`Request received from potential source ${source} without X-Hub-Signature-256 or equivalent header.`);
    appendLog({ 
        timestamp: new Date().toISOString(), 
        status: 'VALIDATION_ERROR', 
        message: 'Request received without signature header.', 
        details: { project: getSafe(body, ['repository','name']) || getSafe(body, ['project','name']) || 'N/A', remoteAddress: req.ip, source }
    });
    return res.status(401).send({ error: 'No signature provided. Access denied.' });
  }

  // Signature validation logic
  if (source === 'GitHub' || source === 'Gitea') {
    const hmac = crypto.createHmac('sha256', localSecret);
    hmac.update(req.rawBody);
    const expectedSignature = `sha256=${hmac.digest('hex')}`;
    try {
      if (!crypto.timingSafeEqual(Buffer.from(signatureToVerify), Buffer.from(expectedSignature))) {
        console.warn(`Invalid webhook signature from ${source}.`);
        appendLog({ 
            timestamp: new Date().toISOString(), 
            status: 'VALIDATION_ERROR', 
            message: 'Invalid webhook signature.', 
            details: { project: getSafe(body,['repository','name']) || getSafe(body, ['project','name']) || 'N/A', remoteAddress: req.ip, providedSignature: signatureToVerify, source }
        });
        return res.status(401).send({ error: 'Invalid signature. Access denied.' });
      }
    } catch (error) {
      console.warn(`Error comparing signatures for ${source} (possibly incompatible formats):`, error.message);
      appendLog({ 
          timestamp: new Date().toISOString(), 
          status: 'VALIDATION_ERROR', 
          message: 'Error comparing signatures.', 
          details: { project: getSafe(body,['repository','name']) || getSafe(body, ['project','name']) || 'N/A', remoteAddress: req.ip, error: error.message, source }
      });
      return res.status(401).send({ error: 'Invalid signature format. Access denied.' });
    }
  } else if (source === 'GitLab') {
    if (signatureToVerify !== localSecret) {
      console.warn('Invalid X-Gitlab-Token.');
      appendLog({ 
          timestamp: new Date().toISOString(), 
          status: 'VALIDATION_ERROR', 
          message: 'Invalid GitLab token.', 
          details: { project: getSafe(body,['repository','name']) || getSafe(body, ['project','name']) || 'N/A', remoteAddress: req.ip, source }
      });
      return res.status(401).send({ error: 'Invalid token. Access denied.' });
    }
  }

  // Extract common information
  const projectName = getSafe(body, ['repository', 'name'])
                     || getSafe(body, ['project', 'name'])
                     || getSafe(body, ['repository', 'full_name'])
                     || getSafe(body, ['project', 'path_with_namespace']);

  const pushedBranchWithRef = getSafe(body, ['ref']);
  
  let commits = getSafe(body, ['commits'], []);
  if (!Array.isArray(commits) || commits.length === 0) {
    const headCommit = getSafe(body, ['head_commit']);
    if (headCommit) commits = [headCommit]; // Standardize to array
  }

  let committerName = 'N/A';
  let commitHash = 'N/A';
  let eventType = 'Push'; // Default to Push, can be refined to Commit/Merge
  let commitMessage = '';

  if (commits && commits.length > 0) {
    const lastCommit = commits[commits.length - 1]; // Process the last commit in the push
    commitHash = getSafe(lastCommit, ['id'])
                 || getSafe(lastCommit, ['sha']) 
                 || 'N/A';
    commitMessage = getSafe(lastCommit, ['message'], '');

    committerName = getSafe(lastCommit, ['committer', 'name'])
                    || getSafe(lastCommit, ['author', 'name'])
                    || getSafe(body, ['pusher', 'name'])
                    || getSafe(body, ['user_name']) // GitLab pusher
                    || getSafe(body, ['pusher', 'login'])
                    || 'N/A';

    // Try to determine if it's a merge commit
    const parents = getSafe(lastCommit, ['parents']);
    if (Array.isArray(parents) && parents.length > 1) {
      eventType = 'Merge';
    } else if (commitMessage.toLowerCase().startsWith('merge branch') || commitMessage.toLowerCase().startsWith('merge pull request')) {
      eventType = 'Merge';
    } else {
      eventType = 'Commit';
    }
  } else {
      // Fallback for pusher name if no commit data (e.g. new branch creation without commits in payload immediately)
      committerName = getSafe(body, ['pusher', 'name'])
                    || getSafe(body, ['user_name'])
                    || getSafe(body, ['pusher', 'login'])
                    || 'N/A';
  }

  if (!pushedBranchWithRef) {
    appendLog({ timestamp: new Date().toISOString(), status: 'VALIDATION_ERROR', projectName, committer: committerName, commitHash, eventType, message: 'Branch reference (ref) not found in request body.' });
    return res.status(400).send({ error: 'Branch reference (ref) not found in request body.' });
  }
  const pushedBranchName = pushedBranchWithRef.replace('refs/heads/', '').replace('refs/tags/', '');

  let allowedBranches = req.query.refs || [];
  if (typeof allowedBranches === 'string') {
    allowedBranches = [allowedBranches];
  }

  if (!projectName) {
    appendLog({ timestamp: new Date().toISOString(), status: 'VALIDATION_ERROR', projectName: 'N/A', branchName: pushedBranchName, committer: committerName, commitHash, eventType, message: 'Project name not found in request body after signature validation' });
    return res.status(400).send({ error: 'Project name not found in request body after signature validation' });
  }

  if (allowedBranches.length > 0 && !allowedBranches.includes(pushedBranchName)) {
    const message = `Push to branch '${pushedBranchName}' for project '${projectName}' (commit: ${commitHash.substring(0,7)}, by: ${committerName}, type: ${eventType}) ignored. Not in allowed list: [${allowedBranches.join(', ')}].`;
    console.log(message);
    appendLog({ timestamp: new Date().toISOString(), status: 'IGNORED', projectName, branchName: pushedBranchName, committer: committerName, commitHash, eventType, message, details: { allowedBranches } });
    return res.status(200).send({ 
      message: `Push to branch '${pushedBranchName}' ignored. Not in allowed list.`,
      project: projectName,
      branch: pushedBranchName
    });
  }
  
  console.log(`Processing ${eventType} to branch '${pushedBranchName}' for project '${projectName}' (commit: ${commitHash.substring(0,7)}, by: ${committerName}). Allowed branches: [${allowedBranches.join(', ')}].`);

  const scriptsFolder = path.join(__dirname, 'scripts');

  if (!fs.existsSync(scriptsFolder)) {
    fs.mkdirSync(scriptsFolder, { recursive: true });
  }

  fs.readdir(scriptsFolder, (err, files) => {
    if (err) {
      appendLog({ timestamp: new Date().toISOString(), status: 'SERVER_ERROR', projectName, branchName: pushedBranchName, committer: committerName, commitHash, eventType, message: 'Error reading scripts folder.', details: { error: err.message } });
      res.status(500).send({ error: 'Internal Server Error' });
      return;
    }

    const scriptPath = files.find(file => file.startsWith(projectName));

    if (!scriptPath) {
      appendLog({ timestamp: new Date().toISOString(), status: 'NOT_FOUND', projectName, branchName: pushedBranchName, committer: committerName, commitHash, eventType, message: 'Script not found for project.' });
      res.status(404).send({ error: 'Script not found' });
      return;
    }

    const fullPath = path.join(scriptsFolder, scriptPath);
    const scriptNameOnly = path.basename(fullPath);

    const hostUser = process.env.HOST_USER;
    const scriptsPath = process.env.SCRIPTS_PATH;
    const scriptPathOnHost = `${scriptsPath}/${scriptNameOnly}`;

    if (!hostUser || !scriptsPath) {
      console.error('Error: HOST_USER or SCRIPTS_PATH are not configured as environment variables for the container.');
      appendLog({ timestamp: new Date().toISOString(), status: 'CONFIGURATION_ERROR', projectName, branchName: pushedBranchName, committer: committerName, commitHash, eventType, message: 'HOST_USER or SCRIPTS_PATH are not configured for the container.' });
      return res.status(500).send({ error: 'Server configuration error: SSH host details missing.' });
    }

    const sshCommand = `ssh -i /root/.ssh/id_rsa -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${hostUser}@172.17.0.1 "bash ${scriptPathOnHost} '${pushedBranchName}'"`;

    console.log(`Attempting to execute ${scriptNameOnly} on host via SSH for ${eventType} by ${committerName} (commit ${commitHash.substring(0,7)}) on branch ${pushedBranchName}: ${sshCommand}`);
    appendLog({ timestamp: new Date().toISOString(), status: 'EXECUTION_ATTEMPT', projectName, branchName: pushedBranchName, committer: committerName, commitHash, eventType, message: `Attempting to execute ${scriptNameOnly} on host.`, details: { command: sshCommand } });

    exec(sshCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing script on host via SSH for ${scriptNameOnly}, branch ${pushedBranchName}:`, error);
        console.error(`SSH stderr: ${stderr}`);
        console.error(`SSH stdout: ${stdout}`);
        appendLog({ timestamp: new Date().toISOString(), status: 'EXECUTION_FAILURE', projectName, branchName: pushedBranchName, committer: committerName, commitHash, eventType, message: `Error executing script ${scriptNameOnly} on host.`, details: { error: error.message, stderr, stdout, commitMessage } });
        return res.status(500).send({ 
          error: 'Internal Server Error during remote script execution', 
          details: stderr || error.message,
          stdout_from_ssh: stdout
        });
      }
      console.log(`Script ${scriptNameOnly} executed successfully on host for branch '${pushedBranchName}'. Stdout: ${stdout}`);
      appendLog({ timestamp: new Date().toISOString(), status: 'EXECUTION_SUCCESS', projectName, branchName: pushedBranchName, committer: committerName, commitHash, eventType, message: `Script ${scriptNameOnly} executed successfully on host.`, details: { stdout, commitMessage } });
      res.status(200).send({
        message: 'Script executed successfully',
        project: projectName,
        branch: pushedBranchName,
        eventType: eventType,
        committer: committerName,
        commitHash: commitHash,
        output: stdout
      });
    });
  });
});

app.listen(port, () => {
  console.log(`Server at port ${port}`);
});