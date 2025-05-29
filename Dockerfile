# Use an official Node.js runtime as a parent image
FROM node:22-alpine

# Install git and openssh
RUN apk add --no-cache git openssh

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./

# Install app dependencies
RUN yarn install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Create the scripts directory
RUN mkdir -p /usr/src/app/scripts

# The application listens on port 3000
EXPOSE 3000

# Define the command to run the application
CMD [ "node", "app.js" ]
