const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 3000;

app.use(express.json({
  verify: (req, res, buf, encoding) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString(encoding || 'utf8');
    }
  }
}));

app.post('/', (req, res) => {
  const githubSignature = req.get('X-Hub-Signature-256');
  const localSecret = process.env.GIT_SECRET;

  if (!req.rawBody) {
    console.warn('Request received without rawBody. Ensure that Content-Type is application/json.');
    return res.status(400).send({ error: 'Request body is missing or not in expected format.' });
  }

  if (!localSecret) {
    console.error('Error: GIT_SECRET is not configured on the server.');
    return res.status(500).send({ error: 'Internal Server Configuration Error' });
  }

  if (!githubSignature) {
    console.warn('Request received without X-Hub-Signature-256 header.');
    return res.status(401).send({ error: 'No signature provided. Access denied.' });
  }

  const hmac = crypto.createHmac('sha256', localSecret);
  hmac.update(req.rawBody);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  try {
    if (!crypto.timingSafeEqual(Buffer.from(githubSignature), Buffer.from(expectedSignature))) {
      console.warn('Invalid webhook signature.');
      return res.status(401).send({ error: 'Invalid signature. Access denied.' });
    }
  } catch (error) {
    console.warn('Error comparing signatures (possibly incompatible formats):', error.message);
    return res.status(401).send({ error: 'Invalid signature format. Access denied.' });
  }

  const projectName = req.body.repository.name;
  const pushedBranchWithRef = req.body.ref;

  if (!pushedBranchWithRef) {
    return res.status(400).send({ error: 'Branch reference (req.body.ref) not found in request body.' });
  }
  const pushedBranchName = pushedBranchWithRef.replace('refs/heads/', '');

  let allowedBranches = req.query.refs || [];
  if (typeof allowedBranches === 'string') {
    allowedBranches = [allowedBranches];
  }

  if (!projectName) {
    return res.status(400).send({ error: 'Project name not found in request body after signature validation' });
  }

  // If allowed branches are specified and the pushed branch is not in the list, do nothing.
  if (allowedBranches.length > 0 && !allowedBranches.includes(pushedBranchName)) {
    console.log(`Push to branch '${pushedBranchName}' for project '${projectName}' ignored. Not in allowed list: [${allowedBranches.join(', ')}].`);
    return res.status(200).send({ 
      message: `Push to branch '${pushedBranchName}' ignored. Not in allowed list.`,
      project: projectName,
      branch: pushedBranchName
    });
  }
  // If no branches are specified (allowedBranches.length === 0), process all branches by default.
  // Or if the branch is in the allowed list.
  console.log(`Processing push to branch '${pushedBranchName}' for project '${projectName}'. Allowed branches: [${allowedBranches.join(', ')}].`);

  const scriptsFolder = path.join(__dirname, 'scripts');

  if (!fs.existsSync(scriptsFolder)) {
    fs.mkdirSync(scriptsFolder, { recursive: true });
  }

  fs.readdir(scriptsFolder, (err, files) => {
    if (err) {
      res.status(500).send({ error: 'Internal Server Error' });
      return;
    }

    const scriptPath = files.find(file => file.startsWith(projectName));

    if (!scriptPath) {
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
      return res.status(500).send({ error: 'Server configuration error: SSH host details missing.' });
    }

    const sshCommand = `ssh -i /root/.ssh/id_rsa -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${hostUser}@172.17.0.1 "bash ${scriptPathOnHost} '${pushedBranchName}'"`;

    console.log(`Attempting to execute on host via SSH: ${sshCommand}`);

    exec(sshCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing script on host via SSH for ${scriptNameOnly}, branch ${pushedBranchName}:`, error);
        console.error(`SSH stderr: ${stderr}`);
        console.error(`SSH stdout: ${stdout}`); // stdout también puede contener errores si el comando ssh en sí falla antes de ejecutar el script remoto
        return res.status(500).send({ 
          error: 'Internal Server Error during remote script execution', 
          details: stderr || error.message,
          stdout_from_ssh: stdout
        });
      }
      console.log(`Script ${scriptNameOnly} executed successfully on host for branch '${pushedBranchName}'. Stdout: ${stdout}`);
      res.status(200).send({
        message: 'Script executed successfully',
        project: projectName,
        branch: pushedBranchName,
        output: stdout
      });
    });
  });
});


app.listen(port, () => {
  console.log(`Server at port ${port}`);
});