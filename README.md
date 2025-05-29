# 🎣⚙️ webhook-git-script

This project provides a simple webhook server to automatically execute scripts with changes in Git repositories.

## ✨ Features

- **🚀 Dynamic Script Generation**: Create shell scripts on the fly for different projects.
- **🔌 Webhook Endpoint**: A simple Express server listens for POST requests to trigger these scripts.
- **🔒 Secure**: Verifies webhook signatures to ensure requests are genuine.
- **🔧 Configurable**: Uses environment variables for port and secret configuration.
- **🐳 Dockerized**: Easy to deploy with Docker, with images available on Docker Hub.

## 🐳 Docker Deployment

> **Pre-built images are available on Docker Hub:** > [borrageiros/webhook-git-server on Docker Hub](https://hub.docker.com/repository/docker/borrageiros/webhook-git-server/tags)

- `latest`: For amd64 distributions.
  ```
  borrageiros/webhook-git-server:latest
  ```
- `arm64`: For arm64 distributions (e.g., Raspberry Pi).
  ```
  borrageiros/webhook-git-server:arm64
  ```

### ⚙️ Docker Setup & Run

1.  **(Recommended) Create a persistent volume for scripts on your HOST machine:**
    This ensures your generated scripts (which are created by `add-proyect` inside the container but point to host paths for execution) are stored where the SSH command from the container can find them on the host.

    ```bash
    mkdir -p /path/to/your/host_scripts_folder
    ```

    Replace `/path/to/your/host_scripts_folder` with your desired absolute path on the host (e.g., `/home/ubuntu/webhook_scripts`).

2.  **Prepare SSH Key for Container-to-Host Communication:**

    - On your **host machine**, generate a dedicated SSH key pair. This key will allow the Docker container to SSH into your host to execute scripts.
      ```bash
      ssh-keygen -t ed25519 -f ~/.ssh/webhook_container_to_host_key -N ""
      ```
      (This creates `~/.ssh/webhook_container_to_host_key` and `~/.ssh/webhook_container_to_host_key.pub`)
    - Authorize this new public key on your host by adding its content to your user's `authorized_keys` file:
      ```bash
      cat ~/.ssh/webhook_container_to_host_key.pub >> ~/.ssh/authorized_keys
      ```
    - **Security Note:** For enhanced security, consider restricting the commands this specific SSH key can execute on the host. (See [Important Notes](#️-important-notes) section below).

3.  **Run the Docker container:**
    The container will SSH to `172.17.0.1` on the host (default IP of the Linux Docker network).
    ```bash
    docker run -d \
      --restart always \
      -e GIT_SECRET="your_super_secret_string_here" \
      -e PORT="3000" \ # Port the app inside container listens on.
      -e HOST_USER="your_username_on_host" \ # e.g., ubuntu
      -e SCRIPTS_PATH="/path/to/your/host_scripts_folder" \ # Must match the host path created in step 1
      -v ~/.ssh:/root/.ssh:ro \ # Mount the private SSH key for host access (this needs permissions over the git repos too)
      # The following volume mounts the container's internal /usr/src/app/scripts to the host path.
      # This is where create-script.js (run via docker exec) will place newly generated .sh files.
      # The SSH command will then execute them from this same path on the host.
      -v /path/to/your/host_scripts_folder:/usr/src/app/scripts \
      --name webhook-git-server \
      borrageiros/webhook-git-server:latest # Or :arm64 for ARM
    ```
    - Replace `"your_super_secret_string_here"` with a strong secret.
    - Replace `"your_username_on_host"` with the username on your host machine that the container will SSH into (e.g., `ubuntu`).
    - Set `SCRIPTS_PATH` to the **absolute path** you created in step 1 (e.g., `/home/ubuntu/webhook_scripts`). This variable tells `app.js` where to find the scripts on the host when constructing the SSH command.
    - The `-v /path/to/your/host_scripts_folder:/usr/src/app/scripts` volume mount is crucial. It ensures that when `create-script.js` (run via `docker exec ... yarn add-proyect ...`) writes a script to `/usr/src/app/scripts` _inside the container_, that script also appears at `/path/to/your/host_scripts_folder` _on the host_. This is the path from which the SSH command will execute it.
    - The `PORT` variable now defines the port the Node.js app _tries_ to listen on. With `--network host`, if you set `PORT=3000`, the application will be accessible directly on port 3000 of your host machine. You wouldn't need `-p 3000:3000` in this mode (it might even cause errors).

## 💻 Manual Node.js Installation & Usage

### ✅ Prerequisites

- Node.js (v18 or later recommended; project uses v22)
- Yarn
- Git installed on the server.
- SSH keys configured for the user running the application, allowing access to the Git repositories.

### 🚀 Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url> webhook-git-script
    cd webhook-git-script
    ```
2.  **Install dependencies:**
    ```bash
    yarn install
    ```
3.  **Create a `.env` file:**
    In the root of the project, create a `.env` file:
    ```env
    PORT=3000
    GIT_SECRET=your_super_secret_string_here
    ```
    - Replace `your_super_secret_string_here` (see [Generating a Secure Secret](#generating-a-secure-secret)).

### ▶️ Running the Server

```bash
yarn start
```

The server will start, by default on port 3000, unless specified otherwise by the `PORT` environment variable.

## 🛠️ Usage

### ➕ 1. Adding a New Project Script

This command generates a shell script in the `scripts/` directory that will be executed when the corresponding webhook is triggered.

- **If using Docker:**

  ```bash
  docker exec -it webhook-git-server yarn add-proyect <repository_url> <project_path_on_server_INSIDE_HOST>
  ```

  - `<repository_url>`: The SSH or HTTPS URL of the Git repository (e.g., `git@github.com:user/repo.git`).
  - `<project_path_on_server_INSIDE_CONTAINER>`: The absolute path to the cloned repository in your host machine.

- **If using Node.js directly:**
  ```bash
  yarn add-proyect <repository_url> <project_path_on_server>
  ```
  - `<repository_url>`: The SSH or HTTPS URL of the Git repository.
  - `<project_path_on_server>`: The absolute path to the cloned repository on the server.

**Example (Node.js):**

```bash
yarn add-proyect https://github.com/your-name/your-repo /home/user/projects/your-repo
```

### **🚨 Important:** This will create a script like `scripts/your-repo.sh`, **edit it to your needs**.

### 🎣 2. Configuring Your Webhook (e.g., on GitHub)

1.  **Navigate to Webhook Settings:**

    - Go to your repository on GitHub -> Settings -> Webhooks.
    - Click "Add webhook" or "Edit" an existing one.

2.  **Configure Payload URL:**

    - `http://your-server-ip-or-domain:PORT/`
    - **Branch Filtering (Optional):** You can control which branches trigger script execution by adding `refs` query parameters to the URL. The script will only run if the pushed branch matches one of the provided `refs`.
      - For a single branch: `http://your-server-ip-or-domain:PORT/?refs=main`
      - For multiple branches: `http://your-server-ip-or-domain:PORT/?refs=main&refs=develop&refs=release`
    - If no `refs` parameters are provided, the script will be triggered for pushes to _any_ branch (default behavior).
    - Replace `PORT` with the port your application is listening on (e.g., 3000).

3.  **Set Content Type:**

    - Select `application/json`.

4.  **Set Secret:** 🔑

    - In the "Secret" field, enter the same secure string you used for `GIT_SECRET` in your `.env` file or Docker environment variable.
    - The server uses this to verify the `X-Hub-Signature-256` header sent by GitHub.

5.  **Save the webhook.**

### 🔑 Generating a Secure Secret

It's crucial to use a strong, unique secret for your webhooks. Here are a few ways to generate one:

- **Using OpenSSL (Linux/macOS):**

  ```bash
  openssl rand -hex 32
  ```

  This will output a 64-character hexadecimal string.

- **Using `/dev/urandom` (Linux/macOS):**

  ```bash
  </dev/urandom tr -dc 'A-Za-z0-9!@#$%^&*()_+-=[]{}|;:,.<>?' | head -c32
  ```

  This generates a 32-character string with a mix of alphanumeric and special characters. Adjust `head -c32` for different lengths. For more restricted character sets (e.g. only alphanumeric):

  ```bash
  </dev/urandom tr -dc 'A-Za-z0-9' | head -c32
  ```

- **Using a Password Manager:**
  Most password managers have a built-in strong password/passphrase generator.

**Choose one method, generate your secret, and use it consistently in your GitHub webhook configuration and your server's `GIT_SECRET` environment variable.**

### 📩 Example JSON Payload from GitHub

The server expects a JSON payload containing a `repository` object with a `name` property, and a `ref` property indicating the branch:

```json
{
  "ref": "refs/heads/main", // Example for a push to the main branch
  "repository": {
    "name": "your-repo-name"
  }
  // ... other payload data ...
}
```

The `your-repo-name` should match the name derived from the `<repository_url>` used when creating the script. When the server receives a valid webhook for "your-repo-name" (and the branch matches the `refs` filter, if used), it executes the corresponding `scripts/your-repo-name.sh` script, passing the branch name (e.g., "main") as the first argument to the script.

**Generated Script Content Example:**

When you use `yarn add-proyect` (or its Docker equivalent), the generated `.sh` script in the `scripts/` directory will now look something like this:

```bash
#!/bin/bash
# This script is executed when a webhook is triggered for the repository: <your_repo_url>
# The path to the project on the server is: <your_project_path>
# The name of the branch that triggered the webhook is passed as the first argument ($1).

PROJECT_PATH="<your_project_path>"
PUSHED_BRANCH="$1"

echo "Webhook received for project: <your_repo_name>"
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
  echo "Push was to branch '$PUSHED_BRANCH'. No specific actions defined, but pulling default branch."
  # git pull # Fallback action, if desired
fi

echo "Script finished for branch $PUSHED_BRANCH."
```

### **🚨 Important:** This will create a script like `scripts/your-repo.sh`, **edit it to your needs** to define actions for specific branches or default behavior.

## 📦 Project Structure

```
.
├── scripts/            # Dynamically generated shell scripts (Gitignored, mounted in Docker)
├── app.js              # Express server logic with webhook verification
├── create-script.js    # Utility to generate .sh files for projects
├── package.json        # Project dependencies and npm/yarn scripts
├── yarn.lock           # Yarn lock file
├── .gitignore          # Specifies intentionally untracked files
├── README.md           # This file
└── Dockerfile          # Defines the Docker image
```

## ⚠️ Important Notes

- **Permissions**: Ensure the user running the application (or the user inside the Docker container, typically `root` unless changed) has:
  - Necessary permissions to execute `git pull` in the specified project paths.
  - SSH key access (via the mounted `~/.ssh` directory) to the repositories if you are using SSH URLs.
- **Scripts Directory**: The `scripts/` directory is gitignored by default. Generated scripts are specific to the deployment environment and should be managed via the persistent volume in Docker or be present on the Node.js host.
- **SSH Key for Host Access (Security Note)**: If you are using the SSH-to-host method, ensure the SSH key used (`~/.ssh/webhook_container_to_host_key` in the Docker example) is properly secured and ideally restricted in `authorized_keys` on the host to only allow necessary commands. This is less relevant for direct Node.js usage unless you adapt a similar SSH execution pattern.
- **Network Configuration for SSH to Host**: The use of `127.0.0.1` for the host IP in `app.js` (when running via Docker) relies on specific Docker network configurations (like `--network host` on Linux). If not using `--network host`, the container will need the actual host IP address accessible from its bridge network.
