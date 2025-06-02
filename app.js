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
app.use(express.json({
  verify: (req, res, buf, encoding) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString(encoding || 'utf8');
    }
  }
}));

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

.button {
  background-color: transparent;
  color: #4a6cf7;
  border: 1px solid #4a6cf7;
  padding: 8px 16px;
}

.button:hover {
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

/* Modal Styles */
.modal {
  display: none;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rgba(0,0,0,0.5); /* Dim background */
}

.modal-content {
  background-color: #fefefe;
  margin: 10% auto;
  padding: 25px 30px;
  border: 1px solid #888;
  width: 80%;
  max-width: 500px;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  position: relative; /* For the close button */
}

.close-button {
  color: #aaa;
  float: right;
  font-size: 28px;
  font-weight: bold;
  position: absolute;
  top: 15px;
  right: 20px;
}

.close-button:hover,
.close-button:focus {
  color: #333;
  text-decoration: none;
  cursor: pointer;
}

.modal-content h2 {
  font-size: 20px;
  margin-bottom: 20px;
  color: #333;
  font-weight: 600;
}

.modal-content label {
  margin-top: 15px;
  margin-bottom: 6px;
}

.modal-content input[type="text"],
.modal-content select {
  width: 100%;
  padding: 10px 14px;
  margin-bottom: 15px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 15px;
}

.modal-content input[type="text"]:focus,
.modal-content select:focus {
  border-color: #4a6cf7;
  outline: none;
  box-shadow: 0 0 0 2px rgba(74, 108, 247, 0.1);
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  margin-top: 25px;
}

.modal-buttons button {
  margin-left: 10px;
  padding: 10px 18px;
}

.modal-buttons .cancel-button {
  background-color: #6c757d; /* Grey */
}
.modal-buttons .cancel-button:hover {
  background-color: #5a6268;
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


function getLogsViewHTML(req, logs = [], availableScripts = []) {
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
      
      const displayCommitHash = log.commitHash && log.commitHash !== 'N/A' ? log.commitHash.substring(0, 7) + '...' : '';

      return `
        <div class="log-entry ${statusClass}">
            <span class="timestamp">${new Date(log.timestamp).toLocaleString()}</span>
            <h3>Status: ${log.status}</h3>
            ${log.projectName ? `<p><strong>Project:</strong> ${log.projectName}</p>` : ''}
            ${log.branchName ? `<p><strong>Branch:</strong> ${log.branchName}</p>` : ''}
            ${log.eventType ? `<p><strong>Event Type:</strong> ${log.eventType}</p>` : ''}
            ${log.committer ? `<p><strong>Committer:</strong> ${log.committer}</p>` : ''}
            ${log.commitHash ? `<p><strong>Commit:</strong> <a href="#" title="${log.commitHash}">${displayCommitHash}</a></p>` : ''} 
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
                        <button type="submit" class="button">Logout</button>
                    </form>
                    <div style="display: flex;">
                        <button type="button" id="forceExecuteBtn" class="button">Force Execute Script</button>
                        <form method="POST" action="/logs" style="margin-left: 10px; margin-bottom: 0;">
                            <input type="hidden" name="secret" value="${process.env.GIT_SECRET || ''}">
                            <input type="hidden" id="logSecret" value="${process.env.GIT_SECRET || ''}">
                            <button type="submit" class="button">Refresh Logs</button>
                        </form>
                    </div>
                </div>
                <div class="logs-container">
                    ${logEntriesHTML}
                </div>
            </div>
        </div>

        <!-- Force Execute Script Modal -->
        <div id="forceExecuteModal" class="modal">
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <h2>Force Execute Script</h2>
                <form id="forceExecuteForm">
                    <label for="projectNameSelect">Project:</label>
                    <select id="projectNameSelect" name="projectName" required>
                        ${availableScripts.map(script => `<option value="${script}">${script}</option>`).join('')}
                        ${availableScripts.length === 0 ? '<option value="" disabled>No scripts found</option>' : ''}
                    </select>

                    <label for="branchNameInput">Branch Name:</label>
                    <input type="text" id="branchNameInput" name="branchName" placeholder="e.g., main, develop">
                    
                    <div id="forceExecuteMessage" style="margin-top: 15px; font-size: 14px;"></div>

                    <div class="modal-buttons">
                        <button type="button" class="cancel-button">Cancel</button>
                        <button type="submit" id="executeScriptBtn">Execute</button>
                    </div>
                </form>
            </div>
        </div>

        <script>
            if (document.querySelector('.logs-container')) {
              document.querySelector('.logs-container').scrollTop = document.querySelector('.logs-container').scrollHeight;
            }

            const modal = document.getElementById('forceExecuteModal');
            const btn = document.getElementById('forceExecuteBtn');
            const span = document.getElementsByClassName('close-button')[0];
            const cancelButton = modal ? modal.querySelector('.cancel-button') : null;
            const forceExecuteForm = document.getElementById('forceExecuteForm');
            const forceExecuteMessage = document.getElementById('forceExecuteMessage');
            const executeScriptBtn = document.getElementById('executeScriptBtn');
            const projectNameSelect = document.getElementById('projectNameSelect');
            const branchNameInput = document.getElementById('branchNameInput');


            if (btn) {
                btn.onclick = function() {
                    if (modal) {
                        modal.style.display = 'block';
                        if (forceExecuteMessage) {
                           forceExecuteMessage.textContent = ''; 
                           forceExecuteMessage.style.color = '';
                        }
                        if (forceExecuteForm) forceExecuteForm.reset(); // Reset form on open
                    }
                }
            }

            if (span) {
                span.onclick = function() {
                    if (modal) modal.style.display = 'none';
                }
            }
            
            if (cancelButton) {
                cancelButton.onclick = function() {
                    if (modal) modal.style.display = 'none';
                }
            }

            window.onclick = function(event) {
                if (event.target == modal) {
                    modal.style.display = 'none';
                }
            }

            if (forceExecuteForm) {
                forceExecuteForm.onsubmit = async function(event) {
                    event.preventDefault();
                    if (executeScriptBtn) {
                        executeScriptBtn.disabled = true;
                        executeScriptBtn.textContent = 'Executing...';
                    }
                    if (forceExecuteMessage) forceExecuteMessage.textContent = '';

                    const projectName = projectNameSelect ? projectNameSelect.value : '';
                    const branchName = branchNameInput ? branchNameInput.value : '';
                    const secret = document.getElementById('logSecret') ? document.getElementById('logSecret').value : '';

                    if (!projectName) {
                        if (forceExecuteMessage) {
                            forceExecuteMessage.textContent = 'Please select a project.';
                            forceExecuteMessage.style.color = 'red';
                        }
                        if (executeScriptBtn) {
                            executeScriptBtn.disabled = false;
                            executeScriptBtn.textContent = 'Execute';
                        }
                        return;
                    }

                    try {
                        const response = await fetch('/execute-script', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                projectName: projectName,
                                branchName: branchName,
                                secret: secret
                            }),
                        });

                        const result = await response.json();

                        if (response.ok) {
                            if (forceExecuteMessage) {
                                forceExecuteMessage.textContent = result.message || 'Script execution initiated successfully.';
                                forceExecuteMessage.style.color = 'green';
                            }
                            setTimeout(() => {
                                if (modal) modal.style.display = 'none';
                                const refreshButton = document.querySelector('form[action="/logs"] button[type="submit"]');
                                if (refreshButton) refreshButton.click();
                            }, 2000);
                        } else {
                            if (forceExecuteMessage) {
                                forceExecuteMessage.textContent = 'Error: ' + (result.error || 'Failed to execute script.');
                                forceExecuteMessage.style.color = 'red';
                            }
                        }
                    } catch (error) {
                        console.error('Error during force execution:', error);
                        if (forceExecuteMessage) {
                            forceExecuteMessage.textContent = 'An unexpected error occurred. Check console.';
                            forceExecuteMessage.style.color = 'red';
                        }
                    } finally {
                         if (executeScriptBtn) {
                            executeScriptBtn.disabled = false;
                            executeScriptBtn.textContent = 'Execute';
                         }
                    }
                }
            }
        </script>
    </body>
    </html>
  `;
}

async function getAvailableScripts() {
  const scriptsFolder = path.join(__dirname, 'scripts');
  let availableScripts = [];
  try {
    if (fs.existsSync(scriptsFolder)) {
      const files = await fsp.readdir(scriptsFolder);
      availableScripts = files
        .filter(file => file.endsWith('.sh'))
        .map(file => file.replace('.sh', ''));
    }
  } catch (scriptReadError) {
    console.error('Error reading scripts folder:', scriptReadError);
  }
  return availableScripts;
}

async function executeSshScript({ scriptFileName, projectName, branchName, isForceExecution = false, executionDetails }) {
  const hostUser = process.env.HOST_USER;
  const scriptsPathOnHost = process.env.SCRIPTS_PATH;

  const { 
    committerName = 'N/A', 
    fullCommitHash = 'N/A',
    eventType = 'N/A', 
    commitMessage = '', 
    initiatedBy = 'Webhook', 
    reqIp = 'N/A' 
  } = executionDetails;

  if (!hostUser || !scriptsPathOnHost) {
    console.error('Error: HOST_USER or SCRIPTS_PATH are not configured for SSH execution.');
    const logMessage = 'HOST_USER or SCRIPTS_PATH environment variables not set for SSH.';
    appendLog({
      timestamp: new Date().toISOString(),
      status: 'CONFIGURATION_ERROR',
      projectName,
      branchName,
      committer: committerName,
      commitHash: fullCommitHash,
      eventType,
      message: logMessage,
      details: { initiatedBy, remoteAddress: reqIp }
    });
    return { success: false, error: 'Server configuration error: SSH host details missing.', stdout: '', stderr: '' };
  }

  const scriptPathForSsh = `${scriptsPathOnHost}/${scriptFileName}`;
  const executionTypeArgs = isForceExecution ? `'${branchName}' FORCE_EXEC` : `'${branchName}'`;
  const sshCommand = `ssh -i /root/.ssh/id_rsa -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${hostUser}@172.17.0.1 "bash ${scriptPathForSsh} ${executionTypeArgs}"`;

  const logStatusPrefix = isForceExecution ? 'FORCE_EXECUTION' : 'EXECUTION';
  const attemptMessage = `${isForceExecution ? 'Forced execution' : 'Execution'} of ${scriptFileName} for project ${projectName} on branch '${branchName}' initiated.`;
  
  const displayCommitHash = fullCommitHash && fullCommitHash !== 'N/A' ? fullCommitHash.substring(0,7) : 'N/A';
  console.log(`Attempting SSH: ${sshCommand} (Project: ${projectName}, Branch: ${branchName}, Commit: ${displayCommitHash}, Event: ${eventType}, Initiated by: ${initiatedBy})`);
  
  appendLog({
    timestamp: new Date().toISOString(),
    status: `${logStatusPrefix}_ATTEMPT`,
    projectName,
    branchName,
    committer: committerName,
    commitHash: fullCommitHash,
    eventType,
    message: attemptMessage,
    details: { command: sshCommand, initiatedBy, remoteAddress: reqIp, commitMessage: commitMessage.substring(0, 200) }
  });

  return new Promise((resolve) => {
    exec(sshCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`SSH Execution Error for ${scriptFileName} (Project: ${projectName}, Branch: ${branchName}, Commit: ${displayCommitHash}):`, error.message);
        if (stderr) console.error(`SSH stderr: ${stderr}`);
        if (stdout) console.error(`SSH stdout: ${stdout}`);
        appendLog({
          timestamp: new Date().toISOString(),
          status: `${logStatusPrefix}_FAILURE`,
          projectName,
          branchName,
          committer: committerName,
          commitHash: fullCommitHash,
          eventType,
          message: `Error during ${isForceExecution ? 'forced ' : ''}execution of ${scriptFileName} for project ${projectName}, branch ${branchName}.`,
          details: { error: error.message, stderr, stdout, initiatedBy, remoteAddress: reqIp, commitMessage: commitMessage.substring(0, 200) }
        });
        resolve({ success: false, error: error.message, stdout, stderr });
      } else {
        console.log(`SSH Execution Success for ${scriptFileName} (Project: ${projectName}, Branch: ${branchName}, Commit: ${displayCommitHash}). Stdout: ${stdout}`);
        appendLog({
          timestamp: new Date().toISOString(),
          status: `${logStatusPrefix}_SUCCESS`,
          projectName,
          branchName,
          committer: committerName,
          commitHash: fullCommitHash,
          eventType,
          message: `${scriptFileName} for project ${projectName}, branch ${branchName} ${isForceExecution ? 'force ' : ''}executed successfully.`,
          details: { stdout, initiatedBy, remoteAddress: reqIp, commitMessage: commitMessage.substring(0, 200) }
        });
        resolve({ success: true, stdout, stderr, error: null });
      }
    });
  });
}

const webhookHelpers = {
  verifySignature: (req, localSecret) => {
    const githubSignature = req.get('X-Hub-Signature-256');
    const gitlabToken = req.get('X-Gitlab-Token');
    const giteaSignature = req.get('X-Gitea-Signature');
    
    const rawBody = req.rawBody;
    const bodyForLog = req.body; 

    const getProjectNameForLog = () => getSafe(bodyForLog, ['repository','name']) || getSafe(bodyForLog, ['project','name']) || 'N/A';

    let effectiveSignature;
    let source;

    if (gitlabToken) {
      effectiveSignature = gitlabToken;
      source = 'GitLab';
    } else if (giteaSignature) {
      effectiveSignature = giteaSignature;
      source = 'Gitea';
    } else if (githubSignature) {
      effectiveSignature = githubSignature;
      source = 'GitHub';
    } else {
      appendLog({ 
          timestamp: new Date().toISOString(), 
          status: 'VALIDATION_ERROR', 
          message: 'Request received without any known signature header (X-Hub-Signature-256, X-Gitlab-Token, X-Gitea-Signature).', 
          details: { project: getProjectNameForLog(), remoteAddress: req.ip, source: 'Unknown' }
      });
      return { isValid: false, source: 'Unknown', error: 'No signature header provided. Access denied.' };
    }

    if (!rawBody && (source === 'GitHub' || source === 'Gitea')) {
        appendLog({ timestamp: new Date().toISOString(), status: 'VALIDATION_ERROR', message: 'Request raw body is missing, cannot verify HMAC signature.', details: { project: getProjectNameForLog(), remoteAddress: req.ip, source } });
        return { isValid: false, source, error: 'Request raw body is missing for HMAC verification.' };
    }

    if (source === 'GitHub' || source === 'Gitea') {
      const hmac = crypto.createHmac('sha256', localSecret);
      hmac.update(rawBody);
      const expectedSignature = `sha256=${hmac.digest('hex')}`;
      try {
        if (crypto.timingSafeEqual(Buffer.from(effectiveSignature), Buffer.from(expectedSignature))) {
          return { isValid: true, source, error: null };
        } else {
          appendLog({ timestamp: new Date().toISOString(), status: 'VALIDATION_ERROR', message: `Invalid webhook signature from ${source}.`, details: { project: getProjectNameForLog(), remoteAddress: req.ip, providedSignature: effectiveSignature, source }});
          return { isValid: false, source, error: 'Invalid signature. Access denied.' };
        }
      } catch (e) {
        appendLog({ timestamp: new Date().toISOString(), status: 'VALIDATION_ERROR', message: `Error comparing signatures for ${source}.`, details: { project: getProjectNameForLog(), remoteAddress: req.ip, error: e.message, source, providedSignature: effectiveSignature }});
        return { isValid: false, source, error: 'Invalid signature format. Access denied.' };
      }
    } else if (source === 'GitLab') {
      if (effectiveSignature === localSecret) {
        return { isValid: true, source, error: null };
      } else {
        appendLog({ timestamp: new Date().toISOString(), status: 'VALIDATION_ERROR', message: 'Invalid X-Gitlab-Token.', details: { project: getProjectNameForLog(), remoteAddress: req.ip, source }});
        return { isValid: false, source, error: 'Invalid token. Access denied.' };
      }
    }
    return { isValid: false, source: 'InternalError', error: 'Internal error in signature verification logic.'}; // Should not be reached
  },

  parsePayload: (body, source) => {
    const projectName = getSafe(body, ['repository', 'name'])
                       || getSafe(body, ['project', 'name'])
                       || getSafe(body, ['repository', 'full_name'])
                       || getSafe(body, ['project', 'path_with_namespace']);

    const pushedBranchWithRef = getSafe(body, ['ref']);
    if (!pushedBranchWithRef) {
      return { data: null, error: 'Branch reference (ref) not found in request body.', logDetails: { projectName, message: 'Branch reference (ref) not found in request body.' } };
    }
    const pushedBranchName = pushedBranchWithRef.replace(/^refs\/(heads|tags)\//, '');


    let commits = getSafe(body, ['commits'], []);
    if (!Array.isArray(commits) || commits.length === 0) {
      const headCommit = getSafe(body, ['head_commit']);
      if (headCommit) commits = [headCommit];
    }

    let committerName = 'N/A';
    let fullCommitHash = 'N/A';
    let eventType = 'Push'; 
    let commitMessage = '';

    if (commits && commits.length > 0) {
      const relevantCommit = commits[commits.length - 1]; 

      fullCommitHash = getSafe(relevantCommit, ['id'])
                     || getSafe(relevantCommit, ['sha']) 
                     || getSafe(body, ['checkout_sha']) 
                     || 'N/A';
      commitMessage = getSafe(relevantCommit, ['message'], '');

      committerName = getSafe(relevantCommit, ['committer', 'name'])
                      || getSafe(relevantCommit, ['author', 'name'])
                      || getSafe(body, ['user_name']) 
                      || getSafe(body, ['pusher', 'name'])
                      || getSafe(body, ['pusher', 'login'])
                      || getSafe(getSafe(body, ['user']), ['name']) 
                      || 'N/A';

      const parents = getSafe(relevantCommit, ['parents']);
      if (Array.isArray(parents) && parents.length > 1) {
        eventType = 'Merge';
      } else if (commitMessage.toLowerCase().startsWith('merge branch') || commitMessage.toLowerCase().startsWith('merge pull request')) {
        eventType = 'Merge';
      } else {
        eventType = 'Commit';
      }
    } else {
        committerName = getSafe(body, ['pusher', 'name'])
                      || getSafe(body, ['user_name'])
                      || getSafe(body, ['pusher', 'login'])
                      || getSafe(getSafe(body, ['user']), ['name'])
                      || 'N/A';
        if (pushedBranchWithRef.startsWith('refs/tags/')) {
            eventType = 'TagPush';
        }
    }
    
    if (!projectName) {
        return { data: null, error: 'Project name not found in request body.', logDetails: { branchName: pushedBranchName, committer: committerName, commitHash: fullCommitHash, eventType, message: 'Project name not found in request body.' } };
    }

    return {
      data: { projectName, pushedBranchName, committerName, fullCommitHash, eventType, commitMessage },
      error: null,
      logDetails: {} 
    };
  }
};

app.get('/', (req, res) => {
  res.send(getLoginFormHTML(req));
});

app.get('/logs', (req, res) => {
  res.redirect('/'); // Redirect to login form if trying to GET /logs
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
    }

    const availableScripts = await getAvailableScripts();
    logs.reverse(); 
    res.send(getLogsViewHTML(req, logs, availableScripts));
  } catch (error) {
    console.error('Error processing log view request:', error);
    res.status(500).send(getLoginFormHTML(req, 'Error retrieving logs.'));
  }
});

app.post('/', async (req, res) => {
  const localSecret = process.env.GIT_SECRET;
  
  if (!req.rawBody) {
    console.warn('Request received without rawBody. Ensure that Content-Type is application/json.');
    appendLog({ timestamp: new Date().toISOString(), status: 'VALIDATION_ERROR', message: 'Request body is missing or not in expected format (no rawBody).', details: { remoteAddress: req.ip } });
    return res.status(400).send({ error: 'Request body is missing or not in expected format.' });
  }

  if (!localSecret) {
    console.error('Error: GIT_SECRET is not configured on the server.');
    appendLog({ 
        timestamp: new Date().toISOString(), 
        status: 'CONFIGURATION_ERROR', 
        message: 'GIT_SECRET is not configured for webhook validation.', 
        details: { project: getSafe(req.body, ['repository','name']) || getSafe(req.body, ['project','name']) || 'N/A' }
    });
    return res.status(500).send({ error: 'Internal Server Configuration Error' });
  }

  const signatureResult = webhookHelpers.verifySignature(req, localSecret);
  if (!signatureResult.isValid) {
    console.warn(`Webhook validation failed: ${signatureResult.error} (Source: ${signatureResult.source})`);
    return res.status(401).send({ error: signatureResult.error });
  }
  const source = signatureResult.source;

  const payloadResult = webhookHelpers.parsePayload(req.body, source);
  if (payloadResult.error) {
    appendLog({
        timestamp: new Date().toISOString(),
        status: 'VALIDATION_ERROR',
        message: `Webhook payload parsing error: ${payloadResult.error}`,
        projectName: getSafe(req.body, ['repository','name']) || getSafe(req.body, ['project','name']) || 'N/A',
        details: { 
            parsingError: payloadResult.error,
            specificParserDetails: payloadResult.logDetails,
            remoteAddress: req.ip, 
            source 
        }
    });
    return res.status(400).send({ error: `Webhook payload parsing error: ${payloadResult.error}` });
  }

  const { projectName, pushedBranchName, committerName, fullCommitHash, eventType, commitMessage } = payloadResult.data;

  let allowedBranches = req.query.refs || [];
  if (typeof allowedBranches === 'string') {
    allowedBranches = [allowedBranches];
  }

  if (allowedBranches.length > 0 && !allowedBranches.includes(pushedBranchName)) {
    const displayCommitHashShort = fullCommitHash && fullCommitHash !== 'N/A' ? fullCommitHash.substring(0,7) : 'N/A';
    const ignoreMessage = `Push to branch '${pushedBranchName}' for project '${projectName}' (commit: ${displayCommitHashShort}, by: ${committerName}, type: ${eventType}) ignored. Not in allowed list: [${allowedBranches.join(', ')}].`;
    console.log(ignoreMessage);
    appendLog({ 
        timestamp: new Date().toISOString(), 
        status: 'IGNORED_BRANCH',
        projectName, 
        branchName: pushedBranchName, 
        committer: committerName, 
        commitHash: fullCommitHash, 
        eventType, 
        message: ignoreMessage, 
        details: { allowedBranches, remoteAddress: req.ip, source } 
    });
    return res.status(200).send({ 
      message: `Push to branch '${pushedBranchName}' ignored. Not in allowed list.`,
      project: projectName,
      branch: pushedBranchName
    });
  }
  
  const displayCommitHashShortLog = fullCommitHash && fullCommitHash !== 'N/A' ? fullCommitHash.substring(0,7) : 'N/A';
  console.log(`Processing ${eventType} to branch '${pushedBranchName}' for project '${projectName}' (commit: ${displayCommitHashShortLog}, by: ${committerName}). Source: ${source}. Allowed branches: ${allowedBranches.length > 0 ? '[' + allowedBranches.join(', ') + ']' : 'any'}.`);

  const scriptsFolder = path.join(__dirname, 'scripts');

  try {
    if (!fs.existsSync(scriptsFolder)) {
      fs.mkdirSync(scriptsFolder, { recursive: true });
    }
    const files = await fsp.readdir(scriptsFolder);
    const scriptFile = files.find(file => file.startsWith(projectName) && file.endsWith('.sh'));

    if (!scriptFile) {
      appendLog({ 
          timestamp: new Date().toISOString(), 
          status: 'SCRIPT_NOT_FOUND',
          projectName, 
          branchName: pushedBranchName, 
          committer: committerName, 
          commitHash: fullCommitHash, 
          eventType, 
          message: `Script not found for project '${projectName}'.`,
          details: { remoteAddress: req.ip, source }
      });
      return res.status(404).send({ error: 'Script not found for project.' });
    }

    const scriptFileName = path.basename(scriptFile);

    const executionDetails = {
      committerName,
      fullCommitHash,
      eventType,
      commitMessage,
      initiatedBy: `Webhook-${source}`,
      reqIp: req.ip
    };

    const sshResult = await executeSshScript({
      scriptFileName,
      projectName,
      branchName: pushedBranchName,
      isForceExecution: false,
      executionDetails
    });

    if (sshResult.success) {
      res.status(200).send({
        message: 'Script executed successfully via webhook.',
        project: projectName,
        branch: pushedBranchName,
        eventType: eventType,
        committer: committerName,
        commitHash: fullCommitHash, // Send full hash in response
        output: sshResult.stdout
      });
    } else {
      res.status(500).send({
        error: 'Internal Server Error during remote script execution',
        details: sshResult.stderr || sshResult.error,
        stdout_from_ssh: sshResult.stdout
      });
    }

  } catch (err) {
    appendLog({ 
        timestamp: new Date().toISOString(), 
        status: 'SERVER_ERROR', 
        projectName, 
        branchName: pushedBranchName, 
        committer: committerName, 
        commitHash: fullCommitHash, 
        eventType, 
        message: 'Error processing webhook (e.g., reading scripts folder).', 
        details: { error: err.message, remoteAddress: req.ip, source } 
    });
    return res.status(500).send({ error: 'Internal Server Error while processing webhook.' });
  }
});

app.post('/execute-script', async (req, res) => {
  const { projectName, branchName, secret } = req.body;
  const localSecret = process.env.GIT_SECRET;

  if (!localSecret) {
    console.error('Error: GIT_SECRET is not configured for forced execution.');
    appendLog({
      timestamp: new Date().toISOString(),
      status: 'CONFIGURATION_ERROR',
      message: 'GIT_SECRET is not configured for forced execution endpoint.',
      details: { projectName, branchName, remoteAddress: req.ip, initiatedBy: 'ManualForceExecution' }
    });
    return res.status(500).json({ error: 'Server configuration error: Secret not set.' });
  }

  if (secret !== localSecret) {
    console.warn(`Failed attempt to force execute script with incorrect secret for project ${projectName}.`);
    appendLog({
      timestamp: new Date().toISOString(),
      status: 'VALIDATION_ERROR',
      message: 'Incorrect secret provided for forced script execution.',
      details: { projectName, branchName, remoteAddress: req.ip, initiatedBy: 'ManualForceExecution' }
    });
    return res.status(403).json({ error: 'Access Denied: Incorrect secret.' });
  }

  if (!projectName) {
    appendLog({
      timestamp: new Date().toISOString(),
      status: 'VALIDATION_ERROR',
      message: 'Project name or branch name missing in force execution request.',
      details: { projectName, branchName, remoteAddress: req.ip, initiatedBy: 'ManualForceExecution' }
    });
    return res.status(400).json({ error: 'Project name and branch name are required.' });
  }

  const scriptFileName = `${projectName}.sh`;
  const scriptPathOnServer = path.join(__dirname, 'scripts', scriptFileName);

  if (!fs.existsSync(scriptPathOnServer)) {
    appendLog({
      timestamp: new Date().toISOString(),
      status: 'NOT_FOUND', // Changed from SCRIPT_NOT_FOUND to align with original
      projectName,
      branchName,
      message: `Script ${scriptFileName} not found on server for forced execution.`,
      details: { remoteAddress: req.ip, initiatedBy: 'ManualForceExecution' }
    });
    return res.status(404).json({ error: `Script ${scriptFileName} not found.` });
  }

  const executionDetails = {
    committerName: 'ManualExecution', 
    fullCommitHash: 'N/A',
    eventType: 'ManualForceExecution',
    commitMessage: `Forced execution for ${projectName} on ${branchName}`,
    initiatedBy: 'ManualForceExecution', 
    reqIp: req.ip
  };
  
  const result = await executeSshScript({
    scriptFileName,
    projectName,
    branchName,
    isForceExecution: true,
    executionDetails
  });

  if (result.success) {
    res.status(200).json({
      message: `Forced execution of ${scriptFileName} on branch '${branchName}' initiated successfully.`,
      output: result.stdout
    });
  } else {
    res.status(500).json({
      error: result.error || 'Error during remote script execution',
      details: result.stderr || result.error,
      stdout_from_ssh: result.stdout
    });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});