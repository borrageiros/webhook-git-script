const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  const repoUrl = process.argv[2];
  const projectPath = process.argv[3];

  if (!repoUrl || !projectPath) {
    console.error('Usage: yarn create <repository_url> <project_path>');
    process.exit(1);
  }

  const scriptsFolder = path.join(__dirname, 'scripts');
  if (!fs.existsSync(scriptsFolder)) {
    fs.mkdirSync(scriptsFolder, { recursive: true });
    console.log(`Created directory: ${scriptsFolder}`);
  }

  const repoName = path.basename(repoUrl, '.git');
  const scriptFileName = `${repoName}.sh`;
  const scriptFilePath = path.join(scriptsFolder, scriptFileName);

  const scriptContent = `#!/bin/bash
# This script is executed when a webhook is triggered for the repository: ${repoUrl}
# The path to the project on the server is: ${projectPath}
# The name of the branch that triggered the webhook is passed as the first argument ($1).

PROJECT_PATH="${projectPath}"
PUSHED_BRANCH="$1"

echo "Webhook received for project: ${repoName}"
echo "Project path:      $PROJECT_PATH"
echo "Branch pushed:     $PUSHED_BRANCH"

# --- Custom script logic below --- #
# Example: Only pull if the push was to 'main' or 'develop'

cd "$PROJECT_PATH"

if [ "$PUSHED_BRANCH" == "main" ]; then
  echo "Branch is 'main'. Pulling changes..."
  git pull origin main
  # Add other commands for main branch here
elif [ "$PUSHED_BRANCH" == "develop" ]; then
  echo "Branch is 'develop'. Pulling changes..."
  git pull origin develop
  # Add other commands for develop branch here
else
  echo "Push was to branch '$PUSHED_BRANCH'. No specific actions defined for this branch in the script, but pulling default branch as a fallback."
  # As a fallback, you might want to pull the default branch or a specific one
  # git pull
fi

echo "Script finished for branch $PUSHED_BRANCH."
`;

  fs.writeFileSync(scriptFilePath, scriptContent);
  execSync(`chmod +x ${scriptFilePath}`);
  console.log(`Successfully created script: ${scriptFilePath}`);
}

main(); 